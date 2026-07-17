import { requireRole } from "@/services/auth.service";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Authenticate user
    await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    // Fetch all raw items
    const rawItems = await prisma.rawItem.findMany({
      orderBy: { name: "asc" }
    });

    // Filter down to low stock items in memory (safe and fast for standard inventory sizes)
    const lowStockItems = rawItems
      .filter((item) => Number(item.currentStock) < Number(item.minThreshold))
      .map((item) => ({
        id: item.id,
        name: item.name,
        currentStock: Number(item.currentStock),
        minThreshold: Number(item.minThreshold),
        unit: item.unit
      }));

    return NextResponse.json(lowStockItems);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Failed to fetch low stock alerts." },
      { status }
    );
  }
}
