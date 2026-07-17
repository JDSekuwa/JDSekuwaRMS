import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { buildKotPayload } from "@/services/print.service";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/tables/[id]/kot: builds and returns the KOT kitchen print payload.
 * Accessible to WORKER, ADMIN, and SUPER_ADMIN.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);
    const { id: tableId } = await params;

    const openOrder = await prisma.tableOrder.findFirst({
      where: { tableId, status: "OPEN" }
    });

    if (!openOrder) {
      return NextResponse.json(
        { error: "No open order found for this table" },
        { status: 404 }
      );
    }

    const payload = await buildKotPayload(openOrder.id);
    return NextResponse.json(payload);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
