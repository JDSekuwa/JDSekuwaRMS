import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { resetStaffUserPassword } from "@/services/users.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters")
});

/**
 * POST /api/users/[id]/reset-password: reset user password.
 * Strictly gated to SUPER_ADMIN.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireRole([Role.SUPER_ADMIN]);
    const { id: targetUserId } = await params;
    const body = await request.json();

    const result = resetPasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { password } = result.data;
    const res = await resetStaffUserPassword(caller.id, targetUserId, password);
    return NextResponse.json(res);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
