import { requireRole } from "@/services/auth.service";
import { getPurchase, updatePurchase, deletePurchase } from "@/services/purchase.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverCache } from "@/lib/cache";

const updatePurchaseSchema = z.object({
  rawItemId: z.string().uuid("Invalid rawItemId format").optional(),
  qty: z.number().positive("Quantity must be positive").optional(),
  unitCost: z.number().positive("Unit cost must be positive").optional(),
  supplierName: z.string().optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const resolvedParams = await params;
    const purchase = await getPurchase(resolvedParams.id, profile.id);
    return NextResponse.json(purchase);
  } catch (error: any) {
    const status = error.statusCode || (error.message?.includes("not found") ? 444 : 500);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: status === 444 ? 404 : status }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const resolvedParams = await params;

    const body = await request.json();
    const result = updatePurchaseSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const updated = await updatePurchase(resolvedParams.id, result.data, profile.id);

    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return NextResponse.json(updated);
  } catch (error: any) {
    const status = error.statusCode || (error.message?.includes("not found") ? 404 : 500);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const resolvedParams = await params;

    const res = await deletePurchase(resolvedParams.id, profile.id);

    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return NextResponse.json(res);
  } catch (error: any) {
    const status = error.statusCode || (error.message?.includes("not found") ? 404 : 500);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
