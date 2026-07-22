import { prisma, superuserPrisma } from "../lib/prisma";
import { Role } from "../generated/prisma/client";
import { setSessionContext, getCachedProfile } from "./auth.service";
import { logAction } from "./audit.service";
import { ForbiddenError } from "../lib/errors";
import { serverCache } from "../lib/cache";

export interface PurchaseFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  rawItemId?: string;
}

/**
 * Records a new raw item purchase, increments stock levels, and logs the transaction.
 * Gated to Admin/Super Admin only.
 */
export async function recordPurchase(
  rawItemId: string,
  qty: number,
  unitCost: number,
  supplierName: string | null | undefined,
  recordedById: string
): Promise<any> {
  const profile = await getCachedProfile(recordedById);
  if (!profile) {
    throw new Error("Recorder profile not found");
  }

  if (profile.role !== Role.ADMIN && profile.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Only Admins and Super Admins can record purchases");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, recordedById);

    const totalCost = qty * unitCost;

    // 1. Create the purchase log entry
    const purchase = await tx.purchase.create({
      data: {
        rawItemId,
        qty,
        unitCost,
        totalCost,
        supplierName: supplierName || null,
        recordedById
      }
    });

    // 2. Fetch raw item to get current stock and verify existence
    const rawItem = await tx.rawItem.findUnique({
      where: { id: rawItemId },
      select: { currentStock: true }
    });
    if (!rawItem) {
      throw new Error("Raw ingredient not found");
    }

    // 3. Increment the stock level
    await tx.rawItem.update({
      where: { id: rawItemId },
      data: {
        currentStock: Number(rawItem.currentStock) + qty
      },
      select: {
        id: true,
        currentStock: true
      }
    });

    // 4. Log the action to audit
    await logAction(
      recordedById,
      "RECORD_PURCHASE",
      "Purchase",
      purchase.id,
      { qty, unitCost, totalCost, rawItemId },
      tx
    );

    // Invalidate caches
    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return purchase;
  }, { maxWait: 5000, timeout: 15000 });
}

export interface PurchaseInput {
  rawItemId: string;
  qty: number;
  unitCost: number;
}

/**
 * Records multiple raw item purchases, increments stock levels, and logs transactions.
 * Gated to Admin/Super Admin only.
 */
export async function recordPurchases(
  items: PurchaseInput[],
  supplierName: string | null | undefined,
  recordedById: string
): Promise<any[]> {
  const profile = await getCachedProfile(recordedById);
  if (!profile) {
    throw new Error("Recorder profile not found");
  }

  if (profile.role !== Role.ADMIN && profile.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Only Admins and Super Admins can record purchases");
  }

  if (!items || items.length === 0) {
    throw new Error("At least one purchase item is required");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, recordedById);

    const purchases = [];

    for (const item of items) {
      const { rawItemId, qty, unitCost } = item;
      const totalCost = qty * unitCost;

      // 1. Create the purchase log entry
      const purchase = await tx.purchase.create({
        data: {
          rawItemId,
          qty,
          unitCost,
          totalCost,
          supplierName: supplierName || null,
          recordedById
        }
      });

      // 2. Fetch raw item to get current stock and verify existence
      const rawItem = await tx.rawItem.findUnique({
        where: { id: rawItemId },
        select: { currentStock: true }
      });
      if (!rawItem) {
        throw new Error("Raw ingredient not found");
      }

      // 3. Increment the stock level
      await tx.rawItem.update({
        where: { id: rawItemId },
        data: {
          currentStock: Number(rawItem.currentStock) + qty
        },
        select: {
          id: true,
          currentStock: true
        }
      });

      // 4. Log the action to audit
      await logAction(
        recordedById,
        "RECORD_PURCHASE",
        "Purchase",
        purchase.id,
        { qty, unitCost, totalCost, rawItemId },
        tx
      );

      purchases.push(purchase);
    }

    // Invalidate caches
    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return purchases;
  }, { maxWait: 5000, timeout: 15000 });
}


/**
 * Lists purchase records based on filters.
 * Gated to Admin/Super Admin only.
 */
export async function listPurchases(
  filters: PurchaseFilters & { skip?: number; take?: number; search?: string },
  userId: string
): Promise<any[] | { purchases: any[]; total: number }> {
  const profile = await getCachedProfile(userId);
  if (!profile) {
    throw new Error("User profile not found");
  }

  if (profile.role !== Role.ADMIN && profile.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Only Admins and Super Admins can view purchase records");
  }

  const whereClause: any = {};

  if (filters.rawItemId) {
    whereClause.rawItemId = filters.rawItemId;
  }

  if (filters.dateRange) {
    whereClause.purchasedAt = {
      gte: filters.dateRange.start,
      lte: filters.dateRange.end
    };
  }

  if (filters.search) {
    whereClause.rawItem = {
      name: {
        contains: filters.search,
        mode: "insensitive"
      }
    };
  }

  const includeClause = {
    rawItem: {
      select: {
        name: true,
        unit: true
      }
    },
    recordedBy: {
      select: {
        role: true
      }
    }
  };

  if (filters.skip !== undefined && filters.take !== undefined) {
    const total = await prisma.purchase.count({ where: whereClause });
    const purchases = await prisma.purchase.findMany({
      where: whereClause,
      include: includeClause,
      orderBy: {
        purchasedAt: "desc"
      },
      skip: filters.skip,
      take: filters.take
    });
    return { purchases, total };
  }

  return await prisma.purchase.findMany({
    where: whereClause,
    include: includeClause,
    orderBy: {
      purchasedAt: "desc"
    }
  });
}

/**
 * Retrieves a single purchase record by ID.
 * Gated to Admin/Super Admin only.
 */
export async function getPurchase(id: string, userId: string): Promise<any> {
  const profile = await getCachedProfile(userId);
  if (!profile) {
    throw new Error("User profile not found");
  }

  if (profile.role !== Role.ADMIN && profile.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Only Admins and Super Admins can view purchase records");
  }

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      rawItem: {
        select: {
          id: true,
          name: true,
          unit: true,
          costPrice: true
        }
      },
      recordedBy: {
        select: {
          id: true,
          role: true
        }
      }
    }
  });

  if (!purchase) {
    throw new Error("Purchase record not found");
  }

  return purchase;
}

export interface UpdatePurchaseInput {
  rawItemId?: string;
  qty?: number;
  unitCost?: number;
  supplierName?: string | null;
}

/**
 * Updates an existing purchase record, reconciles inventory stock, and logs the audit event.
 * Gated to Admin/Super Admin only.
 */
export async function updatePurchase(
  id: string,
  data: UpdatePurchaseInput,
  userId: string
): Promise<any> {
  const profile = await getCachedProfile(userId);
  if (!profile) {
    throw new Error("User profile not found");
  }

  if (profile.role !== Role.ADMIN && profile.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Only Admins and Super Admins can edit purchase records");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, userId);

    // 1. Fetch existing purchase record
    const existing = await tx.purchase.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new Error("Purchase record not found");
    }

    const oldQty = Number(existing.qty);
    const oldUnitCost = Number(existing.unitCost);
    const newRawItemId = data.rawItemId || existing.rawItemId;
    const newQty = data.qty !== undefined ? data.qty : oldQty;
    const newUnitCost = data.unitCost !== undefined ? data.unitCost : oldUnitCost;
    const newTotalCost = newQty * newUnitCost;
    const newSupplierName = data.supplierName !== undefined ? data.supplierName : existing.supplierName;

    // 2. Adjust inventory stock delta
    if (existing.rawItemId === newRawItemId) {
      const qtyDelta = newQty - oldQty;
      if (qtyDelta !== 0) {
        const rawItem = await tx.rawItem.findUnique({
          where: { id: newRawItemId },
          select: { currentStock: true }
        });
        if (rawItem) {
          await tx.rawItem.update({
            where: { id: newRawItemId },
            data: { currentStock: Number(rawItem.currentStock) + qtyDelta }
          });
        }
      }
    } else {
      // Raw item changed: deduct old qty from old item, add new qty to new item
      const oldItem = await tx.rawItem.findUnique({
        where: { id: existing.rawItemId },
        select: { currentStock: true }
      });
      if (oldItem) {
        await tx.rawItem.update({
          where: { id: existing.rawItemId },
          data: { currentStock: Number(oldItem.currentStock) - oldQty }
        });
      }

      const newItem = await tx.rawItem.findUnique({
        where: { id: newRawItemId },
        select: { currentStock: true }
      });
      if (!newItem) {
        throw new Error("New raw ingredient not found");
      }
      await tx.rawItem.update({
        where: { id: newRawItemId },
        data: { currentStock: Number(newItem.currentStock) + newQty }
      });
    }

    // 3. Update purchase record
    const updated = await tx.purchase.update({
      where: { id },
      data: {
        rawItemId: newRawItemId,
        qty: newQty,
        unitCost: newUnitCost,
        totalCost: newTotalCost,
        supplierName: newSupplierName ? newSupplierName.trim() : null
      },
      include: {
        rawItem: {
          select: {
            name: true,
            unit: true
          }
        },
        recordedBy: {
          select: {
            role: true
          }
        }
      }
    });

    // 4. Log audit action
    await logAction(
      userId,
      "UPDATE_PURCHASE",
      "Purchase",
      id,
      { oldQty, newQty, oldUnitCost, newUnitCost, newTotalCost },
      tx
    );

    // Invalidate caches
    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return updated;
  }, { maxWait: 5000, timeout: 15000 });
}

/**
 * Deletes a purchase record, reverses stock addition, and logs the audit event.
 * Gated to Admin/Super Admin only.
 */
export async function deletePurchase(id: string, userId: string): Promise<{ success: boolean }> {
  const profile = await getCachedProfile(userId);
  if (!profile) {
    throw new Error("User profile not found");
  }

  if (profile.role !== Role.ADMIN && profile.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Only Admins and Super Admins can delete purchase records");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, userId);

    // 1. Fetch existing purchase record
    const existing = await tx.purchase.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new Error("Purchase record not found");
    }

    // 2. Revert inventory stock
    const rawItem = await tx.rawItem.findUnique({
      where: { id: existing.rawItemId },
      select: { currentStock: true }
    });

    if (rawItem) {
      const newStock = Number(rawItem.currentStock) - Number(existing.qty);
      await tx.rawItem.update({
        where: { id: existing.rawItemId },
        data: { currentStock: newStock }
      });
    }

    // 3. Delete purchase entry
    await tx.purchase.delete({
      where: { id }
    });

    // 4. Log audit action
    await logAction(
      userId,
      "DELETE_PURCHASE",
      "Purchase",
      id,
      { rawItemId: existing.rawItemId, qty: existing.qty, totalCost: existing.totalCost },
      tx
    );

    // Invalidate caches
    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return { success: true };
  }, { maxWait: 5000, timeout: 15000 });
}

