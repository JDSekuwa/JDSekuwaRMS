import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { superuserPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/menu-items: returns all menu items with category and recipe lines.
 * Restricted to ADMIN and SUPER_ADMIN for recipe building.
 */
export async function GET() {
  try {
    await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const items = await superuserPrisma.menuItem.findMany({
      include: {
        category: true,
        recipe: {
          include: {
            lines: true
          }
        }
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json(items);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
