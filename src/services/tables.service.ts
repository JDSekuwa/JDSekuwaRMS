import { superuserPrisma, prisma } from "../lib/prisma";
import { Role, TableOrderStatus } from "../generated/prisma/client";
import { logAction } from "./audit.service";
import { ForbiddenError } from "../lib/errors";
import { getCachedProfile } from "./auth.service";

async function requireAdmin(callerUserId: string) {
  const profile = await getCachedProfile(callerUserId);
  if (!profile || (profile.role !== Role.ADMIN && profile.role !== Role.SUPER_ADMIN)) {
    throw new ForbiddenError("Only Admins and Super Admins can manage floor tables.");
  }
  return profile;
}

/**
 * Creates a new RestaurantTable.
 */
export async function createTable(
  callerUserId: string,
  name: string,
  imageUrl?: string | null
): Promise<any> {
  await requireAdmin(callerUserId);

  try {
    const table = await superuserPrisma.restaurantTable.create({
      data: { name, imageUrl }
    });

    await logAction(callerUserId, "CREATE_TABLE", "RestaurantTable", table.id, { name, imageUrl });
    return table;
  } catch (error: any) {
    if (error.code === "P2002") {
      throw new Error(`A table named "${name}" already exists. Please choose a different name.`);
    }
    throw error;
  }
}

/**
 * Updates an existing RestaurantTable name and/or image.
 */
export async function updateTable(
  callerUserId: string,
  tableId: string,
  name: string,
  imageUrl?: string | null
): Promise<any> {
  await requireAdmin(callerUserId);

  const table = await superuserPrisma.restaurantTable.update({
    where: { id: tableId },
    data: { name, imageUrl }
  });

  await logAction(callerUserId, "UPDATE_TABLE", "RestaurantTable", tableId, { name, imageUrl });
  return table;
}

/**
 * Deletes a RestaurantTable. Blocked if it has any linked TableOrder history.
 */
export async function deleteTable(
  callerUserId: string,
  tableId: string
): Promise<any> {
  await requireAdmin(callerUserId);

  // Block deletion if table currently has an OPEN order
  const openOrder = await superuserPrisma.tableOrder.findFirst({
    where: { tableId, status: "OPEN" }
  });
  if (openOrder) {
    throw new Error("This table currently has an open order. Close the bill before deleting.");
  }

  try {
    const table = await superuserPrisma.restaurantTable.delete({
      where: { id: tableId }
    });
    await logAction(callerUserId, "DELETE_TABLE", "RestaurantTable", tableId, {});
    return { success: true, id: table.id };
  } catch (error: any) {
    if (error.code === "P2003" || error.message?.includes("foreign key constraint")) {
      throw new Error(
        "This table cannot be deleted because it has past sales transaction records. You can rename it instead."
      );
    }
    throw error;
  }
}

export interface HistoryFilter {
  tableId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  page?: number;
  limit?: number;
}

/**
 * Returns paginated closed TableOrder visits, sorted newest first.
 */
export async function getTableOrderHistory(filter: HistoryFilter) {
  const page = Math.max(1, filter.page || 1);
  const limit = Math.min(100, Math.max(1, filter.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = {
    status: TableOrderStatus.CLOSED,
  };

  if (filter.tableId) {
    where.tableId = filter.tableId;
  }

  if (filter.startDate || filter.endDate) {
    where.closedAt = {};
    if (filter.startDate) {
      where.closedAt.gte = new Date(filter.startDate);
    }
    if (filter.endDate) {
      const end = new Date(filter.endDate);
      if (typeof filter.endDate === "string" && filter.endDate.length === 10) {
        end.setHours(23, 59, 59, 999);
      }
      where.closedAt.lte = end;
    }
  }

  const [totalCount, orders] = await prisma.$transaction([
    prisma.tableOrder.count({ where }),
    prisma.tableOrder.findMany({
      where,
      include: {
        table: {
          select: { id: true, name: true }
        },
        items: {
          select: { id: true }
        }
      },
      orderBy: { closedAt: "desc" },
      skip,
      take: limit,
    })
  ]);

  const visits = orders.map((order) => ({
    id: order.id,
    table: {
      id: order.table.id,
      name: order.table.name,
    },
    customer: {
      name: order.customerName,
      phone: order.customerPhone,
    },
    times: {
      openedAt: order.openedAt,
      closedAt: order.closedAt,
    },
    paymentType: order.paymentType,
    totals: {
      subtotal: order.subtotal ? Number(order.subtotal) : 0,
      discount: order.discount ? Number(order.discount) : 0,
      total: order.total ? Number(order.total) : 0,
    },
    itemCount: order.items.length,
  }));

  return {
    visits,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    }
  };
}

/**
 * Returns detail for a specific closed TableOrder visit, with items grouped by round.
 * Falls back to minute-grouping if round is null.
 */
export async function getTableOrderHistoryDetail(orderId: string) {
  const order = await prisma.tableOrder.findUnique({
    where: { id: orderId },
    include: {
      table: {
        select: { id: true, name: true }
      },
      openedBy: {
        select: { id: true, role: true }
      },
      items: {
        include: {
          menuItem: {
            select: { id: true, name: true, price: true }
          }
        },
        orderBy: [
          { round: "asc" },
          { createdAt: "asc" }
        ]
      }
    }
  });

  if (!order) {
    return null;
  }

  type GroupedRound = {
    key: string;
    roundNumber: number | null;
    earliestAt: number;
    items: Array<{
      id: string;
      item: string;
      menuItemId: string;
      qty: number;
      unitPrice: number;
      lineTotal: number;
      isVoid: boolean;
      createdAt: Date;
    }>;
  };

  const groupsMap = new Map<string, GroupedRound>();

  for (const item of order.items) {
    // If round is not null use it, otherwise fall back to calendar minute grouping
    const key = item.round !== null
      ? `round-${item.round}`
      : `minute-${item.createdAt.toISOString().slice(0, 16)}`;

    let group = groupsMap.get(key);
    if (!group) {
      group = {
        key,
        roundNumber: item.round,
        earliestAt: item.createdAt.getTime(),
        items: []
      };
      groupsMap.set(key, group);
    } else {
      if (item.createdAt.getTime() < group.earliestAt) {
        group.earliestAt = item.createdAt.getTime();
      }
    }

    const unitPrice = Number(item.unitPrice);
    group.items.push({
      id: item.id,
      item: item.menuItem?.name || "Unknown item",
      menuItemId: item.menuItemId,
      qty: item.qty,
      unitPrice,
      lineTotal: unitPrice * item.qty,
      isVoid: item.isVoid,
      createdAt: item.createdAt,
    });
  }

  // Sort groups chronologically
  const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
    if (a.roundNumber !== null && b.roundNumber !== null) {
      return a.roundNumber - b.roundNumber;
    }
    return a.earliestAt - b.earliestAt;
  });

  // Assign clean sequential round numbering
  const rounds = sortedGroups.map((group, index) => {
    const roundNum = group.roundNumber !== null ? group.roundNumber : (index + 1);
    return {
      round: roundNum,
      roundLabel: `Round ${roundNum}`,
      items: group.items,
    };
  });

  return {
    id: order.id,
    status: order.status,
    table: {
      id: order.table.id,
      name: order.table.name,
    },
    customer: {
      name: order.customerName,
      phone: order.customerPhone,
    },
    times: {
      openedAt: order.openedAt,
      closedAt: order.closedAt,
    },
    paymentType: order.paymentType,
    totals: {
      subtotal: order.subtotal ? Number(order.subtotal) : 0,
      discount: order.discount ? Number(order.discount) : 0,
      total: order.total ? Number(order.total) : 0,
    },
    openedBy: order.openedBy,
    rounds,
  };
}
