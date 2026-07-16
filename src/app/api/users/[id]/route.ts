import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { deleteStaffUser } from "@/services/users.service";
import { NextResponse } from "next/server";

/**
 * DELETE /api/users/[id]: delete a staff user.
 * Strictly gated to SUPER_ADMIN.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireRole([Role.SUPER_ADMIN]);
    const { id: targetUserId } = await params;

    const res = await deleteStaffUser(caller.id, targetUserId);
    return NextResponse.json(res);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
