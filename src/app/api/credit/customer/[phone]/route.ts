import { requireRole } from "@/services/auth.service";
import { getCustomerLedger } from "@/services/credit.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone } = await params;
    await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);
    const ledger = await getCustomerLedger(phone);
    return NextResponse.json(ledger);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
