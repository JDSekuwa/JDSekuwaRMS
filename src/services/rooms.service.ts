import { superuserPrisma } from "../lib/prisma";
import { Role } from "../generated/prisma/client";
import { logAction } from "./audit.service";
import { ForbiddenError } from "../lib/errors";

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

  const room = await superuserPrisma.room.create({
    data: { name, nightlyRate, imageUrl }
  });

  await logAction(callerUserId, "CREATE_ROOM", "Room", room.id, { name, nightlyRate, imageUrl });
  return room;
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
