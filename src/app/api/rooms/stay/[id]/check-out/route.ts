import { requireRole } from "@/services/auth.service";
import { checkOut } from "@/services/rooms.service";
import { Role, PaymentType } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const checkOutSchema = z.object({
  paymentType: z.nativeEnum(PaymentType),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomStayId } = await params;
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const body = await request.json();
    const result = checkOutSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const checkoutData = await checkOut(roomStayId, result.data.paymentType, profile.id);
    return NextResponse.json(checkoutData);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
