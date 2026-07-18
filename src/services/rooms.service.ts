import { prisma, superuserPrisma } from "../lib/prisma";
import { Role, RoomStatus, RoomStayStatus, PaymentType, CreditSource } from "../generated/prisma/client";
import { setSessionContext } from "./auth.service";
import { logAction } from "./audit.service";
import { deductForSale } from "./inventory.service";
import { upsertCreditEntry } from "./credit.service";
import { RoomConflictError, ForbiddenError } from "../lib/errors";

export interface GuestDetails {
  guestName: string;
  phone: string;
  idProof: string;
  numGuests: number;
  expectedCheckOut: Date;
}

async function requireAdmin(callerUserId: string) {
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: callerUserId }
  });
  if (!profile || (profile.role !== Role.ADMIN && profile.role !== Role.SUPER_ADMIN)) {
    throw new ForbiddenError("Only Admins and Super Admins can manage lodging rooms.");
  }
  return profile;
}

/**
 * Creates a new Room.
 */
export async function createRoom(
  callerUserId: string,
  name: string,
  nightlyRate: number,
  imageUrl?: string | null
): Promise<any> {
  await requireAdmin(callerUserId);

  try {
    const room = await superuserPrisma.room.create({
      data: { name, nightlyRate, imageUrl }
    });

    await logAction(callerUserId, "CREATE_ROOM", "Room", room.id, { name, nightlyRate, imageUrl });
    return room;
  } catch (error: any) {
    if (error.code === "P2002") {
      throw new Error(`A room named "${name}" already exists. Please choose a different name.`);
    }
    throw error;
  }
}

/**
 * Updates an existing Room name, nightly rate and/or image.
 */
export async function updateRoom(
  callerUserId: string,
  roomId: string,
  name: string,
  nightlyRate: number,
  imageUrl?: string | null
): Promise<any> {
  await requireAdmin(callerUserId);

  const room = await superuserPrisma.room.update({
    where: { id: roomId },
    data: { name, nightlyRate, imageUrl }
  });

  await logAction(callerUserId, "UPDATE_ROOM", "Room", roomId, { name, nightlyRate, imageUrl });
  return room;
}

/**
 * Deletes a Room. Blocked if the room is currently OCCUPIED or has stay history.
 */
export async function deleteRoom(
  callerUserId: string,
  roomId: string
): Promise<any> {
  await requireAdmin(callerUserId);

  // Block deletion if room is currently occupied
  const room = await superuserPrisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new Error("Room not found.");
  if (room.status === "OCCUPIED") {
    throw new Error("Cannot delete an occupied room. Check the guest out first.");
  }

  try {
    const deleted = await superuserPrisma.room.delete({ where: { id: roomId } });
    await logAction(callerUserId, "DELETE_ROOM", "Room", roomId, {});
    return { success: true, id: deleted.id };
  } catch (error: any) {
    if (error.code === "P2003" || error.message?.includes("foreign key constraint")) {
      throw new Error(
        "This room cannot be deleted because it has past guest stay records. You can rename or update it instead."
      );
    }
    throw error;
  }
}

/**
 * Checks a guest into a room, updating the room status and logging the action.
 */
export async function checkIn(
  roomId: string,
  guestDetails: GuestDetails,
  userId: string
): Promise<any> {
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: userId }
  });
  if (!profile) {
    throw new Error("User not found");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, userId);

    const room = await tx.room.findUnique({
      where: { id: roomId }
    });
    if (!room) {
      throw new Error("Room not found");
    }
    if (room.status !== RoomStatus.VACANT) {
      throw new RoomConflictError("Room is not vacant");
    }

    const checkInDate = new Date();
    const nights = Math.max(1, Math.ceil((guestDetails.expectedCheckOut.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Optimistic lock room status change
    const updatedRoom = await tx.room.updateMany({
      where: {
        id: roomId,
        version: room.version
      },
      data: {
        status: RoomStatus.OCCUPIED,
        version: { increment: 1 }
      }
    });

    if (updatedRoom.count === 0) {
      throw new RoomConflictError("Room status was updated by another session");
    }

    const roomStay = await tx.roomStay.create({
      data: {
        roomId,
        guestName: guestDetails.guestName,
        phone: guestDetails.phone,
        idProof: guestDetails.idProof,
        numGuests: guestDetails.numGuests,
        checkIn: checkInDate,
        expectedCheckOut: guestDetails.expectedCheckOut,
        numNights: nights,
        status: RoomStayStatus.ACTIVE,
        createdById: userId,
        version: 1
      }
    });

    await logAction(userId, "CHECK_IN_ROOM", "RoomStay", roomStay.id, { roomId }, tx);

    return roomStay;
  });
}

/**
 * Adds a room service charge (food/drink item) to an active room stay.
 */
export async function addRoomServiceCharge(
  roomStayId: string,
  menuItemId: string,
  qty: number,
  userId: string
): Promise<any> {
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: userId }
  });
  if (!profile) {
    throw new Error("User not found");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, userId);

    const roomStay = await tx.roomStay.findUnique({
      where: { id: roomStayId }
    });
    if (!roomStay) {
      throw new Error("Room stay not found");
    }
    if (roomStay.status !== RoomStayStatus.ACTIVE) {
      throw new Error("Cannot add charges to a non-active room stay");
    }

    // Optimistic lock roomStay version
    const updatedStay = await tx.roomStay.updateMany({
      where: {
        id: roomStayId,
        version: roomStay.version
      },
      data: {
        version: { increment: 1 }
      }
    });
    if (updatedStay.count === 0) {
      throw new RoomConflictError("Room stay was updated by another session");
    }

    const menu = await tx.menuItem.findUnique({
      where: { id: menuItemId }
    });
    if (!menu) {
      throw new Error(`Menu item not found: ${menuItemId}`);
    }

    // Deduct raw ingredients atomically
    const deductions = await deductForSale(menuItemId, qty, undefined, tx);

    const orderItem = await tx.orderItem.create({
      data: {
        roomStayId,
        menuItemId,
        qty,
        unitPrice: menu.price,
        rawDeductions: deductions,
      }
    });

    await logAction(userId, "ADD_ROOM_SERVICE_CHARGE", "RoomStay", roomStayId, { menuItemId, qty }, tx);

    return orderItem;
  });
}

/**
 * Adds multiple room service charges (food/drink items) to an active room stay in a single transaction.
 */
export async function addRoomServiceCharges(
  roomStayId: string,
  charges: Array<{ menuItemId: string; qty: number }>,
  userId: string
): Promise<any> {
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: userId }
  });
  if (!profile) {
    throw new Error("User not found");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, userId);

    const roomStay = await tx.roomStay.findUnique({
      where: { id: roomStayId }
    });
    if (!roomStay) {
      throw new Error("Room stay not found");
    }
    if (roomStay.status !== RoomStayStatus.ACTIVE) {
      throw new Error("Cannot add charges to a non-active room stay");
    }

    // Optimistic lock roomStay version
    const updatedStay = await tx.roomStay.updateMany({
      where: {
        id: roomStayId,
        version: roomStay.version
      },
      data: {
        version: { increment: 1 }
      }
    });
    if (updatedStay.count === 0) {
      throw new RoomConflictError("Room stay was updated by another session");
    }

    const createdItems = [];

    for (const charge of charges) {
      const { menuItemId, qty } = charge;
      const menu = await tx.menuItem.findUnique({
        where: { id: menuItemId }
      });
      if (!menu) {
        throw new Error(`Menu item not found: ${menuItemId}`);
      }

      // Deduct raw ingredients atomically
      const deductions = await deductForSale(menuItemId, qty, undefined, tx);

      const orderItem = await tx.orderItem.create({
        data: {
          roomStayId,
          menuItemId,
          qty,
          unitPrice: menu.price,
          rawDeductions: deductions,
        }
      });
      createdItems.push(orderItem);
    }

    await logAction(userId, "ADD_ROOM_SERVICE_CHARGES", "RoomStay", roomStayId, { charges }, tx);

    return createdItems;
  });
}

/**
 * Direct editing of stay nights/checkout dates prior to final checkout.
 */
export async function updateRoomStayDates(
  roomStayId: string,
  expectedCheckOut: Date,
  numNights: number,
  userId: string
): Promise<any> {
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: userId }
  });
  if (!profile) {
    throw new Error("User not found");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, userId);

    const roomStay = await tx.roomStay.findUnique({
      where: { id: roomStayId }
    });
    if (!roomStay) {
      throw new Error("Room stay not found");
    }
    if (roomStay.status !== RoomStayStatus.ACTIVE) {
      throw new Error("Cannot edit dates of a checked out room stay");
    }

    const updatedStay = await tx.roomStay.updateMany({
      where: {
        id: roomStayId,
        version: roomStay.version
      },
      data: {
        expectedCheckOut,
        numNights,
        version: { increment: 1 }
      }
    });
    if (updatedStay.count === 0) {
      throw new RoomConflictError("Room stay was updated by another session");
    }

    await logAction(userId, "UPDATE_ROOM_STAY_DATES", "RoomStay", roomStayId, { expectedCheckOut, numNights }, tx);

    return { success: true };
  });
}

/**
 * Checks a guest out of a room, calculating the total stay price, freeing the room,
 * and recording credit if required.
 */
export async function checkOut(
  roomStayId: string,
  paymentType: PaymentType,
  userId: string
): Promise<any> {
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: userId }
  });
  if (!profile) {
    throw new Error("User not found");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, userId);

    const roomStay = await tx.roomStay.findUnique({
      where: { id: roomStayId },
      include: {
        room: true,
        orderItems: {
          where: { isVoid: false }
        }
      }
    });

    if (!roomStay) {
      throw new Error("Room stay not found");
    }
    if (roomStay.status !== RoomStayStatus.ACTIVE) {
      throw new Error("Room stay is not active");
    }

    // Calculate actual nights dynamically from checkIn to now
    const checkOutDate = new Date();
    const diffTime = checkOutDate.getTime() - roomStay.checkIn.getTime();
    const calculatedNights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const actualNights = Math.max(roomStay.numNights, calculatedNights);

    // 1. Calculate stay total using actual nights stayed
    const roomCharge = Number(roomStay.room.nightlyRate) * actualNights;
    let foodCharges = 0;
    for (const item of roomStay.orderItems) {
      foodCharges += Number(item.unitPrice) * item.qty;
    }
    const total = roomCharge + foodCharges;

    // 2. Optimistic-lock stay checkout status update
    const updatedStay = await tx.roomStay.updateMany({
      where: {
        id: roomStayId,
        version: roomStay.version
      },
      data: {
        status: RoomStayStatus.CHECKED_OUT,
        actualCheckOut: checkOutDate,
        numNights: actualNights, // Save dynamic actual nights stayed
        version: { increment: 1 }
      }
    });
    if (updatedStay.count === 0) {
      throw new RoomConflictError("Room stay was modified by another session");
    }

    // 3. Optimistic-lock release room to VACANT
    const updatedRoom = await tx.room.updateMany({
      where: {
        id: roomStay.roomId,
        version: roomStay.room.version
      },
      data: {
        status: RoomStatus.VACANT,
        version: { increment: 1 }
      }
    });
    if (updatedRoom.count === 0) {
      throw new RoomConflictError("Room was modified by another session");
    }

    // 4. Record credit entry if required
    if (paymentType === PaymentType.CREDIT) {
      await upsertCreditEntry(
        tx,
        roomStay.guestName,
        roomStay.phone,
        CreditSource.ROOM_STAY,
        roomStayId,
        total
      );
    }

    await logAction(
      userId,
      "CHECK_OUT_ROOM",
      "RoomStay",
      roomStayId,
      { total, paymentType },
      tx
    );

    return {
      roomStayId,
      total,
      paymentType,
      roomCharge,
      foodCharges
    };
  });
}
