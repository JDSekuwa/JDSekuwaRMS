import { requireRole } from "@/services/auth.service";
import { addItemsToTableOrder } from "@/services/sales.service";
import { prisma } from "@/lib/prisma";
import { TableOrderStatus, Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const addItemsSchema = z.object({
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      qty: z.number().int().positive(),
      rawQtyOverride: z.number().positive().optional(),
    })
  ).min(1, "At least one item is required"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tableId } = await params;
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const body = await request.json();
    const result = addItemsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

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

    const created = await addItemsToTableOrder(
      openOrder.id,
      result.data.items,
      profile.id
    );

    return NextResponse.json(created);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
