import { requireRole } from "@/services/auth.service";
import { addRoomServiceCharge, addRoomServiceCharges } from "@/services/rooms.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const chargeSchema = z.object({
  menuItemId: z.string().uuid(),
  qty: z.number().int().positive(),
});

const chargesArraySchema = z.array(
  z.object({
    menuItemId: z.string().uuid(),
    qty: z.number().int().positive(),
  })
);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomStayId } = await params;
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const body = await request.json();

    if (Array.isArray(body)) {
      const result = chargesArraySchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json(
          { error: "Invalid input array", details: result.error.format() },
          { status: 400 }
        );
      }
      const orderItems = await addRoomServiceCharges(roomStayId, result.data, profile.id);
      return NextResponse.json(orderItems);
    } else {
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
    }
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
