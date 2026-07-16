import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { updateStaffUserRole } from "@/services/users.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateRoleSchema = z.object({
  role: z.nativeEnum(Role)
});

/**
 * PUT /api/users/[id]/role: update user role.
 * Strictly gated to SUPER_ADMIN.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireRole([Role.SUPER_ADMIN]);
    const { id: targetUserId } = await params;
    const body = await request.json();

    const result = updateRoleSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { role: newRole } = result.data;
    const updated = await updateStaffUserRole(caller.id, targetUserId, newRole);
    return NextResponse.json(updated);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
