import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { updateRoom, deleteRoom } from "@/services/rooms.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateRoomSchema = z.object({
  name: z.string().min(1, "Room name is required"),
  nightlyRate: z.number().positive("Nightly rate must be positive"),
  imageUrl: z.string().nullable().optional()
});

/**
 * PUT /api/rooms/[id] — Updates a room's details.
 * Restricted to ADMIN and SUPER_ADMIN.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const { id } = await params;
    const body = await request.json();

    const result = updateRoomSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { name, nightlyRate, imageUrl } = result.data;
    const room = await updateRoom(caller.id, id, name, nightlyRate, imageUrl);
    return NextResponse.json(room);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}

/**
 * DELETE /api/rooms/[id] — Deletes a room.
 * Restricted to ADMIN and SUPER_ADMIN.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const { id } = await params;

    const result = await deleteRoom(caller.id, id);
    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
