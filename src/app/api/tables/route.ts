import { requireRole } from "@/services/auth.service";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { createTable } from "@/services/tables.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const createTableSchema = z.object({
  name: z.string().min(1, "Table name is required"),
  imageUrl: z.string().nullable().optional()
});

/**
 * GET /api/tables — returns all tables with active order totals and imageUrl.
 */
export async function GET() {
  try {
    await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const tables = await prisma.restaurantTable.findMany({
      include: {
        orders: {
          where: { status: "OPEN" },
          include: { items: { where: { isVoid: false } } }
        }
      },
      orderBy: { name: "asc" }
    });

    const mappedTables = tables.map((t) => {
      const activeOrder = t.orders[0];
      const openOrderTotal = activeOrder
        ? activeOrder.items.reduce((sum, item) => sum + Number(item.qty) * Number(item.unitPrice), 0)
        : 0;
      return {
        id: t.id,
        name: t.name,
        status: t.status,
        currentTag: t.currentTag,
        version: t.version,
        imageUrl: t.imageUrl,
        openOrderTotal
      };
    });

    return NextResponse.json(mappedTables);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}

/**
 * POST /api/tables — creates a new restaurant table.
 * Restricted to ADMIN and SUPER_ADMIN.
 */
export async function POST(request: Request) {
  try {
    const caller = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const body = await request.json();

    const result = createTableSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid input", details: result.error.format() }, { status: 400 });
    }

    const { name, imageUrl } = result.data;
    const table = await createTable(caller.id, name, imageUrl);
    return NextResponse.json(table);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
