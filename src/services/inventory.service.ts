import { prisma, superuserPrisma } from "../lib/prisma";
import { Role } from "../generated/prisma/client";
import { setSessionContext } from "./auth.service";
import { logAction } from "./audit.service";
import { InsufficientStockError } from "../lib/errors";

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minThreshold: number;
  costPrice: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Returns list of inventory raw items.
 * If the role is WORKER, it queries raw_items_worker_view (which excludes cost_price).
 * If the role is ADMIN or SUPER_ADMIN, it queries the base table using superuserPrisma.
 */
export async function getInventoryList(role: Role): Promise<InventoryItem[]> {
  if (role === Role.WORKER) {
    // Workers use the restricted view. View is queried under standard app_user connection.
    const items: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name, unit, current_stock, min_threshold, created_at, updated_at FROM public.raw_items_worker_view`
    );

    return items.map((item) => ({
      id: item.id,
      name: item.name,
      unit: item.unit,
      currentStock: Number(item.current_stock),
      minThreshold: Number(item.min_threshold),
      costPrice: null, // Omitted
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    }));
  }

  // Admins/Super Admins read base table using the superuser connection (to read cost_price)
  const items = await superuserPrisma.rawItem.findMany();
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    currentStock: Number(item.currentStock),
    minThreshold: Number(item.minThreshold),
    costPrice: Number(item.costPrice),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

/**
 * Performs stock adjustments and registers them inside a transaction.
 */
export async function adjustStock(
  rawItemId: string,
  qtyDelta: number,
  reason: string,
  userId: string
): Promise<any> {
  // Use superuser client to resolve the user profile bypass RLS
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: userId },
  });

  if (!profile) {
    throw new Error("Profile not found.");
  }

  // Run updates on the standard connection.
  // The app_user role has SELECT/UPDATE privileges on raw_items, but RLS gates it.
  return await prisma.$transaction(async (tx) => {
    // Set RLS variables
    await setSessionContext(tx, profile.role, userId);

    // Atomic increment/decrement
    const rawItem = await tx.rawItem.update({
      where: { id: rawItemId },
      data: {
        currentStock: {
          increment: qtyDelta,
        },
      },
      select: {
        id: true,
        name: true,
        unit: true,
        currentStock: true,
        minThreshold: true,
      }
    });

    const adjustment = await tx.stockAdjustment.create({
      data: {
        rawItemId,
        qtyDelta,
        reason,
        adjustedById: userId,
      },
    });

    // Write audit log inside the same transaction
    await logAction(
      userId,
      "ADJUST_STOCK",
      "RawItem",
      rawItemId,
      { qtyDelta, reason, adjustmentId: adjustment.id },
      tx
    );

    return { rawItem, adjustment };
  });
}

/**
 * Creates or updates recipe ingredient lines. Admin/Super Admin only.
 */
export async function upsertRecipe(
  menuItemId: string,
  lines: { rawItemId: string; qtyPerUnit: number }[]
): Promise<any> {
  // Recipes costing requires administrative superuser permissions
  return await superuserPrisma.$transaction(async (tx) => {
    // Find or create recipe for the MenuItem
    let recipe = await tx.recipe.findUnique({
      where: { menuItemId },
    });

    if (!recipe) {
      recipe = await tx.recipe.create({
        data: { menuItemId },
      });
    }

    // Delete existing lines to perform clean replacement
    await tx.recipeLine.deleteMany({
      where: { recipeId: recipe.id },
    });

    // Bulk insert new recipe lines
    await tx.recipeLine.createMany({
      data: lines.map((line) => ({
        recipeId: recipe.id,
        rawItemId: line.rawItemId,
        qtyPerUnit: line.qtyPerUnit,
      })),
    });

    // Retrieve full recipe with new lines
    return await tx.recipe.findUnique({
      where: { id: recipe.id },
      include: {
        lines: true,
      },
    });
  });
}

/**
 * Calculates total ingredient cost for a menu item.
 */
export async function computeCostPerUnit(menuItemId: string): Promise<number> {
  const recipe = await superuserPrisma.recipe.findUnique({
    where: { menuItemId },
    include: {
      lines: {
        include: {
          rawItem: true,
        },
      },
    },
  });

  if (!recipe) {
    return 0;
  }

  let totalCost = 0;
  for (const line of recipe.lines) {
    const cost = Number(line.rawItem.costPrice || 0);
    const qty = Number(line.qtyPerUnit);
    totalCost += cost * qty;
  }

  return totalCost;
}

/**
 * Deducts stock from RawItems when a MenuItem is sold.
 * Accepts an optional Prisma transaction client `tx` so sales flows can group it.
 */
export async function deductForSale(
  menuItemId: string,
  qty: number,
  overrideRawQty?: number,
  tx?: any
): Promise<Array<{ rawItemId: string; name: string; qtyDeducted: number }>> {
  const client = tx || prisma;

  // Retrieve recipe. We explicitly SELECT columns that WORKER role has access to,
  // preventing PostgreSQL from throwing column-level SELECT permission errors on cost_price.
  const recipe = await client.recipe.findUnique({
    where: { menuItemId },
    select: {
      id: true,
      menuItemId: true,
      lines: {
        select: {
          id: true,
          recipeId: true,
          rawItemId: true,
          qtyPerUnit: true,
          rawItem: {
            select: {
              id: true,
              name: true,
              unit: true,
              currentStock: true,
              minThreshold: true,
            },
          },
        },
      },
    },
  });

  if (!recipe) {
    return []; // No recipe defined, no stock to deduct
  }

  const deductions: Array<{ rawItemId: string; name: string; qtyDeducted: number }> = [];

  for (const line of recipe.lines) {
    // Determine target quantity to deduct
    const deductQty = overrideRawQty !== undefined && overrideRawQty !== null
      ? overrideRawQty
      : Number(line.qtyPerUnit) * qty;

    const currentStock = Number(line.rawItem.currentStock);

    if (currentStock - deductQty < 0) {
      throw new InsufficientStockError(
        `Insufficient stock for ingredient '${line.rawItem.name}'. Required: ${deductQty}, Available: ${currentStock}`
      );
    }

    // Decrement stock using update with select to exclude cost_price from return selection
    await client.rawItem.update({
      where: { id: line.rawItemId },
      data: {
        currentStock: {
          decrement: deductQty,
        },
      },
      select: {
        id: true,
        currentStock: true,
      }
    });

    deductions.push({
      rawItemId: line.rawItemId,
      name: line.rawItem.name,
      qtyDeducted: deductQty,
    });
  }

  return deductions;
}

/**
 * Restores raw inventory stock when an order item is voided.
 */
export async function restoreForVoid(orderItemId: string, tx?: any): Promise<void> {
  const client = tx || prisma;

  // Fetch the order item including its raw deductions snapshot
  const orderItem = await client.orderItem.findUnique({
    where: { id: orderItemId },
  });

  if (!orderItem || !orderItem.rawDeductions) {
    return; // No order item or no saved stock deductions snapshot
  }

  const deductions = orderItem.rawDeductions as Array<{
    rawItemId: string;
    qtyDeducted: number;
  }>;

  for (const deduction of deductions) {
    // Increment stock back
    await client.rawItem.update({
      where: { id: deduction.rawItemId },
      data: {
        currentStock: {
          increment: deduction.qtyDeducted,
        },
      },
      select: {
        id: true,
        currentStock: true,
      }
    });
  }
}
