import { requireRole } from "@/services/auth.service";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { updateTable, deleteTable } from "@/services/tables.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateTableSchema = z.object({
  name: z.string().min(1, "Table name is required"),
  imageUrl: z.string().nullable().optional()
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require standard staff role authentication
    await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);
    const { id } = await params;

    const table = await prisma.restaurantTable.findUnique({
      where: { id },
      include: {
        orders: {
          where: { status: "OPEN" },
          include: {
            items: {
              include: {
                menuItem: true
              },
              orderBy: { createdAt: "asc" }
            }
          }
        }
      }
    });

    if (!table) {
      return NextResponse.json(
        { error: "Restaurant table not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(table);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}

/**
 * PUT /api/tables/[id] — Updates table name and/or image.
 * Restricted to ADMIN and SUPER_ADMIN.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const { id } = await params;
    const body = await request.json();

    const result = updateTableSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { name, imageUrl } = result.data;
    const table = await updateTable(caller.id, id, name, imageUrl);
    return NextResponse.json(table);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}

/**
 * DELETE /api/tables/[id] — Deletes a table.
 * Restricted to ADMIN and SUPER_ADMIN.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const { id } = await params;

    const result = await deleteTable(caller.id, id);
    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
