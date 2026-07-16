import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { listStaffUsers, createStaffUser } from "@/services/users.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.nativeEnum(Role)
});

/**
 * GET /api/users: list all staff users.
 * Strictly gated to SUPER_ADMIN.
 */
export async function GET() {
  try {
    const caller = await requireRole([Role.SUPER_ADMIN]);
    const users = await listStaffUsers(caller.id);
    return NextResponse.json(users);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}

/**
 * POST /api/users: create a new staff account.
 * Strictly gated to SUPER_ADMIN.
 */
export async function POST(request: Request) {
  try {
    const caller = await requireRole([Role.SUPER_ADMIN]);
    const body = await request.json();
    
    const result = createUserSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { email, password, role } = result.data;
    const user = await createStaffUser(caller.id, email, password, role);
    return NextResponse.json(user);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
