import { requireRole } from "@/services/auth.service";
import { getPurchaseCostReport } from "@/services/reports.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: "startDate and endDate query parameters are required" },
        { status: 400 }
      );
    }

    const purchasesReport = await getPurchaseCostReport(
      { start: new Date(startDateStr), end: new Date(endDateStr) },
      profile.id
    );
    return NextResponse.json(purchasesReport);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
