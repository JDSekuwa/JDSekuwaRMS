import { requireRole } from "@/services/auth.service";
import { getDailySalesSummary } from "@/services/reports.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const summary = await getDailySalesSummary(profile.id);
    return NextResponse.json(summary);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
