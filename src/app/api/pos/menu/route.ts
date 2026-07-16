import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/pos/menu: returns all categories and menu items for POS grid.
 * Accessible to WORKER, ADMIN, and SUPER_ADMIN.
 */
export async function GET() {
  try {
    // All authenticated users can retrieve POS menu items
    await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const categories = await prisma.menuCategory.findMany({
      orderBy: { name: "asc" }
    });

    const menuItems = await prisma.menuItem.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        categoryId: true,
        imageUrl: true,
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json({ categories, menuItems });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
