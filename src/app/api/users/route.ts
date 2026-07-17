import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { listStaffUsers, createStaffUser } from "@/services/users.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.nativeEnum(Role),
  name: z.string().min(1, "Name is required"),
  imageUrl: z.string().nullable().optional()
});

/**
 * GET /api/users: list all staff users.
 * Strictly gated to SUPER_ADMIN.
 */
import { getPaginationParams, paginateResults } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const caller = await requireRole([Role.SUPER_ADMIN]);

    const { skip, take, search, page, limit } = getPaginationParams(request);
    const result = await listStaffUsers(caller.id, { skip, take, search });

    if (result && typeof result === "object" && "data" in result) {
      return NextResponse.json(paginateResults(result.data, result.total, page, limit));
    }
    return NextResponse.json(result);
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

    const { email, password, role, name, imageUrl } = result.data;
    const user = await createStaffUser(caller.id, email, password, role, name, imageUrl || null);
    return NextResponse.json(user);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
