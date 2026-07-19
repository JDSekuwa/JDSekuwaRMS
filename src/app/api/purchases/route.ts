import { requireRole } from "@/services/auth.service";
import { recordPurchase, recordPurchases, listPurchases, PurchaseFilters } from "@/services/purchase.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverCache } from "@/lib/cache";

const purchaseSchema = z.object({
  rawItemId: z.string().uuid("Invalid rawItemId format").optional(),
  qty: z.number().positive("Quantity must be positive").optional(),
  unitCost: z.number().positive("Unit cost must be positive").optional(),
  supplierName: z.string().optional().nullable(),
  items: z.array(
    z.object({
      rawItemId: z.string().uuid("Invalid rawItemId format"),
      qty: z.number().positive("Quantity must be positive"),
      unitCost: z.number().positive("Unit cost must be positive"),
    })
  ).optional(),
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

    const { rawItemId, qty, unitCost, supplierName, items } = result.data;
    let purchase;
    if (items && items.length > 0) {
      purchase = await recordPurchases(items, supplierName, profile.id);
    } else if (rawItemId && qty && unitCost) {
      purchase = await recordPurchase(rawItemId, qty, unitCost, supplierName, profile.id);
    } else {
      return NextResponse.json(
        { error: "Must provide either a single purchase rawItemId, qty, and unitCost, or a list of items." },
        { status: 400 }
      );
    }
    
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
