import { requireRole } from "@/services/auth.service";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

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
