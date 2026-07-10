import { requireRole } from "@/services/auth.service";
import { addRoomServiceCharge } from "@/services/rooms.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const chargeSchema = z.object({
  menuItemId: z.string().uuid(),
  qty: z.number().int().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomStayId } = await params;
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const body = await request.json();
    const result = chargeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { menuItemId, qty } = result.data;
    const orderItem = await addRoomServiceCharge(roomStayId, menuItemId, qty, profile.id);
    return NextResponse.json(orderItem);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
