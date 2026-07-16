import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { updateMenuItem, deleteMenuItem } from "@/services/menu.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.number().positive("Price must be positive"),
  categoryId: z.string().uuid("Invalid category ID"),
  imageUrl: z.string().nullable().optional()
});

/**
 * PUT /api/menu-items/[id]: update menu item details.
 * Restricted to ADMIN and SUPER_ADMIN.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const { id: menuItemId } = await params;
    const body = await request.json();

    const result = updateItemSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { name, price, categoryId, imageUrl } = result.data;
    const item = await updateMenuItem(caller.id, menuItemId, name, price, categoryId, imageUrl);
    return NextResponse.json(item);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}

/**
 * DELETE /api/menu-items/[id]: delete a menu item.
 * Restricted to ADMIN and SUPER_ADMIN.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const { id: menuItemId } = await params;

    const res = await deleteMenuItem(caller.id, menuItemId);
    return NextResponse.json(res);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
