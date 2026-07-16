import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { deleteMenuCategory } from "@/services/menu.service";
import { NextResponse } from "next/server";

/**
 * DELETE /api/menu-categories/[id]: Delete a menu category.
 * Restricted to ADMIN and SUPER_ADMIN.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const { id: categoryId } = await params;

    const res = await deleteMenuCategory(caller.id, categoryId);
    return NextResponse.json(res);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
