import { requireRole } from "@/services/auth.service";
import { upsertRecipe, computeCostPerUnit } from "@/services/inventory.service";
import { Role } from "@/generated/prisma/client";
import { superuserPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const recipeSchema = z.object({
  lines: z.array(
    z.object({
      rawItemId: z.string().uuid(),
      qtyPerUnit: z.number().positive(),
    })
  ),
});

// GET /api/menu-items/:id/recipe: retrieves recipe details and calculates total cost
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: menuItemId } = await params;
    
    // Costing and recipe data is restricted to ADMIN and SUPER_ADMIN
    await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const recipe = await superuserPrisma.recipe.findUnique({
      where: { menuItemId },
      include: {
        lines: {
          include: {
            rawItem: {
              select: {
                id: true,
                name: true,
                unit: true,
                currentStock: true,
                costPrice: true,
              },
            },
          },
        },
      },
    });

    const costPerUnit = await computeCostPerUnit(menuItemId);

    return NextResponse.json({ recipe, costPerUnit });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}

// PUT /api/menu-items/:id/recipe: updates or creates a menu item recipe
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: menuItemId } = await params;
    
    // Updates are restricted to ADMIN and SUPER_ADMIN
    await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const body = await request.json();
    const result = recipeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { lines } = result.data;

    const data = await upsertRecipe(menuItemId, lines);
    return NextResponse.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
