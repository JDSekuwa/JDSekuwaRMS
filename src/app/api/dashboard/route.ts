import { requireRole } from "@/services/auth.service";
import { getDashboardData } from "@/services/dashboard.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { serverCache } from "@/lib/cache";

export async function GET() {
  try {
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);
    
    const cacheKey = `dashboard:${profile.role}:${profile.id}`;
    const cachedData = serverCache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const data = await getDashboardData(profile.role, profile.id);
    serverCache.set(cacheKey, data, 5); // Cache dashboard for 5 seconds
    
    return NextResponse.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
