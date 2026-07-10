import { requireRole } from "@/services/auth.service";
import { listCreditCustomers } from "@/services/credit.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);
    const summaries = await listCreditCustomers();
    return NextResponse.json(summaries);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
