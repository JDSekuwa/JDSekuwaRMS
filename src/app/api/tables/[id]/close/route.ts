import { requireRole } from "@/services/auth.service";
import { closeTableOrder } from "@/services/sales.service";
import { prisma } from "@/lib/prisma";
import { TableOrderStatus, PaymentType, Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const closeSchema = z.object({
  paymentType: z.nativeEnum(PaymentType),
  discount: z.number().nonnegative().default(0),
  customerInfo: z.object({
    customerName: z.string().min(1, "Name is required"),
    phone: z.string().min(1, "Phone is required"),
  }).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tableId } = await params;
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const body = await request.json();
    const result = closeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { paymentType, discount, customerInfo } = result.data;

    // Find the open TableOrder for this table
    const openOrder = await prisma.tableOrder.findFirst({
      where: { tableId, status: TableOrderStatus.OPEN }
    });

    if (!openOrder) {
      return NextResponse.json(
        { error: "No open order found on this table" },
        { status: 404 }
      );
    }

    const data = await closeTableOrder(
      openOrder.id,
      profile.id,
      paymentType,
      discount,
      customerInfo
    );

    return NextResponse.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
