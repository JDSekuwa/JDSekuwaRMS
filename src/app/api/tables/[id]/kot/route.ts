import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { buildKotPayload } from "@/services/print.service";
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
    const { id: tableOrderId } = await params;

    const payload = await buildKotPayload(tableOrderId);
    return NextResponse.json(payload);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
