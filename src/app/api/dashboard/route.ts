import { requireRole } from "@/services/auth.service";
import { getDashboardData } from "@/services/dashboard.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);
    const data = await getDashboardData(profile.role, profile.id);
    return NextResponse.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
