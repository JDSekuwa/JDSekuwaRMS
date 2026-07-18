import { requireRole } from "@/services/auth.service";
import { recordPurchase, listPurchases, PurchaseFilters } from "@/services/purchase.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverCache } from "@/lib/cache";

const purchaseSchema = z.object({
  rawItemId: z.string().uuid("Invalid rawItemId format"),
  qty: z.number().positive("Quantity must be positive"),
  unitCost: z.number().positive("Unit cost must be positive"),
  supplierName: z.string().optional().nullable(),
});

import { getPaginationParams, paginateResults } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const { skip, take, search, page, limit } = getPaginationParams(request);
    const { searchParams } = new URL(request.url);
    const rawItemId = searchParams.get("rawItemId") || undefined;
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    const filters: PurchaseFilters & { skip?: number; take?: number; search?: string } = {
      rawItemId,
      skip,
      take,
      search
    };

    if (startDateStr && endDateStr) {
      filters.dateRange = {
        start: new Date(startDateStr),
        end: new Date(endDateStr)
      };
    }

    const result = await listPurchases(filters, profile.id);

    if (result && typeof result === "object" && "purchases" in result) {
      return NextResponse.json(paginateResults(result.purchases, result.total, page, limit));
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
    
    // Invalidate caches
    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return NextResponse.json(purchase);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
