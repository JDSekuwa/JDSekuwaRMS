import { requireRole } from "@/services/auth.service";
import { recordPurchase, listPurchases, PurchaseFilters } from "@/services/purchase.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const purchaseSchema = z.object({
  rawItemId: z.string().uuid("Invalid rawItemId format"),
  qty: z.number().positive("Quantity must be positive"),
  unitCost: z.number().positive("Unit cost must be positive"),
  supplierName: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const { searchParams } = new URL(request.url);
    const rawItemId = searchParams.get("rawItemId") || undefined;
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    const filters: PurchaseFilters = { rawItemId };

    if (startDateStr && endDateStr) {
      filters.dateRange = {
        start: new Date(startDateStr),
        end: new Date(endDateStr)
      };
    }

    const purchases = await listPurchases(filters, profile.id);
    return NextResponse.json(purchases);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const body = await request.json();
    const result = purchaseSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { rawItemId, qty, unitCost, supplierName } = result.data;
    const purchase = await recordPurchase(rawItemId, qty, unitCost, supplierName, profile.id);
    return NextResponse.json(purchase);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
