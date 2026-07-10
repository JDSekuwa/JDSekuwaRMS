import { requireRole } from "@/services/auth.service";
import { mergeTableOrders } from "@/services/sales.service";
import { prisma } from "@/lib/prisma";
import { TableOrderStatus, Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const mergeSchema = z.object({
  targetTableId: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceTableId } = await params;
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const body = await request.json();
    const result = mergeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { targetTableId } = result.data;

    // Find the open TableOrder for the source table
    const sourceOrder = await prisma.tableOrder.findFirst({
      where: { tableId: sourceTableId, status: TableOrderStatus.OPEN }
    });

    if (!sourceOrder) {
      return NextResponse.json(
        { error: "No open order found on source table" },
        { status: 404 }
      );
    }

    // Find the open TableOrder for the target table
    const targetOrder = await prisma.tableOrder.findFirst({
      where: { tableId: targetTableId, status: TableOrderStatus.OPEN }
    });

    if (!targetOrder) {
      return NextResponse.json(
        { error: "No open order found on target table" },
        { status: 404 }
      );
    }

    const data = await mergeTableOrders(sourceOrder.id, targetOrder.id, profile.id);
    return NextResponse.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
