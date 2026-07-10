import { requireRole } from "@/services/auth.service";
import { createQuickSale } from "@/services/sales.service";
import { PaymentType, Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const quickSaleSchema = z.object({
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      qty: z.number().int().positive(),
      rawQtyOverride: z.number().positive().optional(),
    })
  ).min(1, "At least one item is required"),
  paymentType: z.nativeEnum(PaymentType),
  discount: z.number().nonnegative().default(0),
  customerInfo: z.object({
    customerName: z.string().min(1, "Name is required"),
    phone: z.string().min(1, "Phone is required"),
  }).optional(),
});

export async function POST(request: Request) {
  try {
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]); // All roles allowed (WORKER, ADMIN, SUPER_ADMIN)
    
    const body = await request.json();
    const result = quickSaleSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { items, paymentType, discount, customerInfo } = result.data;

    const quickSale = await createQuickSale(
      profile.id,
      items,
      paymentType,
      discount,
      customerInfo
    );

    return NextResponse.json(quickSale);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
