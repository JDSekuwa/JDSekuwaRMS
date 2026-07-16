import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { superuserPrisma } from "@/lib/prisma";
import { createMenuItem } from "@/services/menu.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const createItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.number().positive("Price must be positive"),
  categoryId: z.string().uuid("Invalid category ID"),
  imageUrl: z.string().nullable().optional()
});

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

/**
 * POST /api/menu-items: create a new menu item.
 * Restricted to ADMIN and SUPER_ADMIN.
 */
export async function POST(request: Request) {
  try {
    const caller = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const body = await request.json();

    const result = createItemSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { name, price, categoryId, imageUrl } = result.data;
    const item = await createMenuItem(caller.id, name, price, categoryId, imageUrl);
    return NextResponse.json(item);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
