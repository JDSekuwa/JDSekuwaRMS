import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { buildReceiptPayload } from "@/services/print.service";
import { NextResponse } from "next/server";

/**
 * GET /api/pos/receipt/[id]: builds and returns the receipt payload for POS or Table order.
 * Accessible to WORKER, ADMIN, and SUPER_ADMIN.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);
    const { id } = await params;

    const payload = await buildReceiptPayload(id);
    return NextResponse.json(payload);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
