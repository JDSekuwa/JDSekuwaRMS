import "dotenv/config";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { prisma, superuserPrisma } from "../lib/prisma";
import { checkIn, addRoomServiceCharge, checkOut, updateRoomStayDates, createRoom, updateRoom, deleteRoom, vacateRoomStay } from "./rooms.service";
import { RoomStatus, RoomStayStatus, PaymentType, Role } from "../generated/prisma/client";
import { RoomConflictError, ForbiddenError } from "../lib/errors";

describe("Room Management Service Integration Tests (Stage B-4)", () => {
  let workerId: string;
  let adminId: string;
  let testRoomId: string;
  let porkMenuItemId: string;
  let rawPorkId: string;
  let rawSpiceId: string;

  beforeAll(async () => {
    // 1. Fetch test profiles
    const worker = await superuserPrisma.profile.findFirst({ where: { role: Role.WORKER } });
    const admin = await superuserPrisma.profile.findFirst({ where: { role: Role.SUPER_ADMIN } });
    if (!worker || !admin) {
      throw new Error("Seeded profiles not found. Run seed-profiles.ts first.");
    }
    workerId = worker.id;
    adminId = admin.id;

    // 2. Fetch test room (Room 101)
    let room = await superuserPrisma.room.findFirst({ where: { name: "Room 101" } });
    if (!room) {
      room = await superuserPrisma.room.create({
        data: { name: "Room 101", nightlyRate: 2500.00, status: RoomStatus.VACANT, version: 1 }
      });
    }
    testRoomId = room.id;

    // 3. Fetch menu item and raw items
    const porkItem = await superuserPrisma.menuItem.findFirst({ where: { name: "Pork Sekuwa (Plate)" } });
    const porkRaw = await superuserPrisma.rawItem.findFirst({ where: { name: "Pork Meat" } });
    const spiceRaw = await superuserPrisma.rawItem.findFirst({ where: { name: "House Sekuwa Spice Mix" } });

    if (!porkItem || !porkRaw || !spiceRaw) {
      throw new Error("Seeded menu items and raw ingredients not found. Run seed.ts first.");
    }
    porkMenuItemId = porkItem.id;
    rawPorkId = porkRaw.id;
    rawSpiceId = spiceRaw.id;
  });

  afterEach(async () => {
    // Reset test room to VACANT state
    await superuserPrisma.room.update({
      where: { id: testRoomId },
      data: { status: RoomStatus.VACANT }
    });

    // Clean up created RoomStays and OrderItems
    const stays = await superuserPrisma.roomStay.findMany({
      where: { roomId: testRoomId }
    });
    for (const stay of stays) {
      await superuserPrisma.orderItem.deleteMany({ where: { roomStayId: stay.id } });
      await superuserPrisma.creditLedger.deleteMany({ where: { sourceId: stay.id } });
      await superuserPrisma.roomStay.delete({ where: { id: stay.id } });
    }
  });

  it("should successfully check in a guest and optimistic-lock against concurrent checkins", async () => {
    const guestDetails1 = {
      guestName: "Alice Guest",
      phone: "9811111111",
      idProof: "Passport A12345",
      numGuests: 2,
      expectedCheckOut: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days
    };

    const guestDetails2 = {
      guestName: "Bob Guest",
      phone: "9822222222",
      idProof: "Passport B67890",
      numGuests: 1,
      expectedCheckOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
    };

    // Parallel check-in calls
    const promise1 = checkIn(testRoomId, guestDetails1, workerId);
    const promise2 = checkIn(testRoomId, guestDetails2, workerId);

    const results = await Promise.allSettled([promise1, promise2]);

    const fulfilled = results.filter(r => r.status === "fulfilled");
    const rejected = results.filter(r => r.status === "rejected");

    // Exactly one check-in must succeed, and the other must throw RoomConflictError
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error).toBeInstanceOf(RoomConflictError);
  });

  it("should handle full stay check-in, room service charge, date updates, and checkout with credit merging", async () => {
    // 1. Fetch stock levels before service charge
    const porkBefore = await superuserPrisma.rawItem.findUnique({ where: { id: rawPorkId } });
    const spiceBefore = await superuserPrisma.rawItem.findUnique({ where: { id: rawSpiceId } });

    // 2. Check in guest for 2 nights expected
    const guestDetails = {
      guestName: "John Doe",
      phone: "9833333333",
      idProof: "ID-9999",
      numGuests: 2,
      expectedCheckOut: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    };
    const stay = await checkIn(testRoomId, guestDetails, workerId);
    expect(stay.status).toBe(RoomStayStatus.ACTIVE);
    expect(stay.numNights).toBe(2);

    // Verify room status changed to OCCUPIED
    const roomOccupied = await superuserPrisma.room.findUnique({ where: { id: testRoomId } });
    expect(roomOccupied!.status).toBe(RoomStatus.OCCUPIED);

    // 3. Add room service food charge (1 plate of Pork Sekuwa)
    const serviceItem = await addRoomServiceCharge(stay.id, porkMenuItemId, 1, workerId);
    expect(serviceItem.roomStayId).toBe(stay.id);

    // Verify ingredients stock decremented
    const porkAfter = await superuserPrisma.rawItem.findUnique({ where: { id: rawPorkId } });
    const spiceAfter = await superuserPrisma.rawItem.findUnique({ where: { id: rawSpiceId } });
    expect(Number(porkAfter!.currentStock)).toBe(Number(porkBefore!.currentStock) - 0.333);
    expect(Number(spiceAfter!.currentStock)).toBe(Number(spiceBefore!.currentStock) - 0.050);

    // 4. Update expectedCheckOut and numNights (extend to 3 nights)
    const newExpectedOut = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const updateResult = await updateRoomStayDates(stay.id, newExpectedOut, 3, workerId);
    expect(updateResult.success).toBe(true);

    // Verify stay dates updated
    const stayUpdated = await superuserPrisma.roomStay.findUnique({ where: { id: stay.id } });
    expect(stayUpdated!.numNights).toBe(3);

    // 5. Checkout settling stay total on CREDIT
    const checkoutResult = await checkOut(stay.id, PaymentType.CREDIT, workerId);
    
    // Total room rate: 3 nights * 2500.00 = 7500.00
    // Service charge (1 plate Pork Sekuwa): 1 * Pork Sekuwa Price
    const menuItem = await superuserPrisma.menuItem.findUnique({ where: { id: porkMenuItemId } });
    const foodCost = Number(menuItem!.price);
    const expectedTotal = 7500.00 + foodCost;
    
    expect(checkoutResult.total).toBe(expectedTotal);
    expect(checkoutResult.roomCharge).toBe(7500.00);
    expect(checkoutResult.foodCharges).toBe(foodCost);

    // Verify room is released to VACANT
    const roomVacant = await superuserPrisma.room.findUnique({ where: { id: testRoomId } });
    expect(roomVacant!.status).toBe(RoomStatus.VACANT);

    // Verify stay is marked CHECKED_OUT
    const stayCheckedOut = await superuserPrisma.roomStay.findUnique({ where: { id: stay.id } });
    expect(stayCheckedOut!.status).toBe(RoomStayStatus.CHECKED_OUT);
    expect(stayCheckedOut!.actualCheckOut).not.toBeNull();

    // Verify CreditLedger record is created/merged
    const credit = await superuserPrisma.creditLedger.findFirst({
      where: { phone: guestDetails.phone }
    });
    expect(credit).toBeDefined();
    expect(credit!.customerName).toBe(guestDetails.guestName);
    expect(Number(credit!.amount)).toBe(expectedTotal);

    // Clean up stock level to avoid test pollution
    await superuserPrisma.rawItem.update({
      where: { id: rawPorkId },
      data: { currentStock: porkBefore!.currentStock }
    });
    await superuserPrisma.rawItem.update({
      where: { id: rawSpiceId },
      data: { currentStock: spiceBefore!.currentStock }
    });
  });

  describe("Room Administration CRUD Tests", () => {
    let createdRoomId: string | null = null;

    afterEach(async () => {
      if (createdRoomId) {
        await superuserPrisma.room.delete({
          where: { id: createdRoomId }
        }).catch(() => {});
        createdRoomId = null;
      }
    });

    it("should successfully create a room for ADMIN", async () => {
      const room = await createRoom(adminId, "Room test-99", 3500.00, "http://example.com/room.jpg");
      expect(room).toBeDefined();
      expect(room.name).toBe("Room test-99");
      expect(Number(room.nightlyRate)).toBe(3500.00);
      expect(room.imageUrl).toBe("http://example.com/room.jpg");
      createdRoomId = room.id;
    });

    it("should block WORKER role from creating a room", async () => {
      await expect(
        createRoom(workerId, "Attacker Room", 1000.00)
      ).rejects.toThrow(ForbiddenError);
    });

    it("should successfully update an existing room name, rate, and image", async () => {
      const room = await createRoom(adminId, "Room test-100", 3500.00);
      createdRoomId = room.id;

      const updated = await updateRoom(adminId, room.id, "Room test-100-updated", 4000.00, "http://example.com/new-room.jpg");
      expect(updated.name).toBe("Room test-100-updated");
      expect(Number(updated.nightlyRate)).toBe(4000.00);
      expect(updated.imageUrl).toBe("http://example.com/new-room.jpg");
    });

    it("should block WORKER role from updating room details", async () => {
      const room = await createRoom(adminId, "Room test-101-gated", 3500.00);
      createdRoomId = room.id;

      await expect(
        updateRoom(workerId, room.id, "Room hacked", 100.00)
      ).rejects.toThrow(ForbiddenError);
    });

    it("should successfully delete a vacant room", async () => {
      const room = await createRoom(adminId, "Room test-102-delete", 3500.00);
      const res = await deleteRoom(adminId, room.id);
      expect(res.success).toBe(true);
      expect(res.id).toBe(room.id);
    });

    it("should block deleting an occupied room", async () => {
      const room = await createRoom(adminId, "Room test-103-occupied-block", 3500.00);
      createdRoomId = room.id;

      // Set status to OCCUPIED
      await superuserPrisma.room.update({
        where: { id: room.id },
        data: { status: RoomStatus.OCCUPIED }
      });

      await expect(
        deleteRoom(adminId, room.id)
      ).rejects.toThrow(/cannot delete an occupied room/i);
    });

    it("should successfully vacate an active room stay when customer fails to arrive (no-show), restoring stock and resetting room to VACANT", async () => {
      // 1. Fetch raw item stock level before service charge
      const porkBefore = await superuserPrisma.rawItem.findUnique({ where: { id: rawPorkId } });

      // 2. Check in phone booking guest
      const guestDetails = {
        guestName: "No-Show Phone Guest",
        phone: "9844444444",
        idProof: "ID-NOSHOW",
        numGuests: 1,
        expectedCheckOut: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
      };
      const stay = await checkIn(testRoomId, guestDetails, workerId);
      expect(stay.status).toBe(RoomStayStatus.ACTIVE);

      // Add service charge prior to customer cancelling
      await addRoomServiceCharge(stay.id, porkMenuItemId, 1, workerId);

      // Verify stock was deducted
      const porkDeducted = await superuserPrisma.rawItem.findUnique({ where: { id: rawPorkId } });
      expect(Number(porkDeducted!.currentStock)).toBe(Number(porkBefore!.currentStock) - 0.333);

      // 3. Vacate the room stay (No-Show reset)
      const vacateRes = await vacateRoomStay(stay.id, workerId, "Guest did not arrive after phone booking");
      expect(vacateRes.success).toBe(true);

      // Verify room status returned to VACANT
      const roomVacant = await superuserPrisma.room.findUnique({ where: { id: testRoomId } });
      expect(roomVacant!.status).toBe(RoomStatus.VACANT);

      // Verify stay status marked CANCELLED
      const stayCancelled = await superuserPrisma.roomStay.findUnique({ where: { id: stay.id } });
      expect(stayCancelled!.status).toBe(RoomStayStatus.CANCELLED);

      // Verify raw ingredient stock restored back to original level!
      const porkRestored = await superuserPrisma.rawItem.findUnique({ where: { id: rawPorkId } });
      expect(Number(porkRestored!.currentStock)).toBe(Number(porkBefore!.currentStock));
    });
  });
});

