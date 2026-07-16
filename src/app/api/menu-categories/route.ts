import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { createMenuCategory } from "@/services/menu.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  isKitchen: z.boolean().default(false)
});

/**
 * POST /api/menu-categories: Create a new category sector.
 * Restricted to ADMIN and SUPER_ADMIN.
 */
export async function POST(request: Request) {
  try {
    const caller = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const body = await request.json();

    const result = categorySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { name, isKitchen } = result.data;
    const category = await createMenuCategory(caller.id, name, isKitchen);
    return NextResponse.json(category);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
