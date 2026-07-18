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
