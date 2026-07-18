import { superuserPrisma } from "../lib/prisma";
import { Role, TableOrderStatus, RoomStayStatus } from "../generated/prisma/client";
import { ForbiddenError } from "../lib/errors";
import { getCachedProfile } from "./auth.service";

export interface DateRange {
  start: Date;
  end: Date;
}

// Helper: Assert Caller has Admin/SuperAdmin Role
async function assertAdminOrSuper(userId: string) {
  const profile = await getCachedProfile(userId);
  if (!profile) {
    throw new Error("Caller profile not found");
  }
  if (profile.role !== Role.ADMIN && profile.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Only Admins and Super Admins can access operational reports");
  }
  return profile;
}

// Helper: Assert Caller has SuperAdmin Role Only
async function assertSuperAdmin(userId: string) {
  const profile = await getCachedProfile(userId);
  if (!profile) {
    throw new Error("Caller profile not found");
  }
  if (profile.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Only Super Admins can access profitability reports");
  }
  return profile;
}

/**
 * Returns today's sales summary.
 */
export async function getDailySalesSummary(userId: string) {
  await assertAdminOrSuper(userId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // 1. Quick Sales
  const quick = await superuserPrisma.quickSale.findMany({
    where: { createdAt: { gte: todayStart, lte: todayEnd } }
  });
  const quickTotal = quick.reduce((sum, s) => sum + Number(s.total), 0);

  // 2. Table Orders
  const table = await superuserPrisma.tableOrder.findMany({
    where: {
      status: TableOrderStatus.CLOSED,
      updatedAt: { gte: todayStart, lte: todayEnd }
    }
  });
  const tableTotal = table.reduce((sum, o) => sum + Number(o.total || 0), 0);

  // 3. Room Stays
  const room = await superuserPrisma.roomStay.findMany({
    where: {
      status: RoomStayStatus.CHECKED_OUT,
      actualCheckOut: { gte: todayStart, lte: todayEnd }
    },
    include: {
      room: true,
      orderItems: true
    }
  });
  const roomTotal = room.reduce((sum, stay) => {
    const roomCharge = stay.numNights * Number(stay.room.nightlyRate);
    const foodCharges = stay.orderItems.reduce((fSum, item) => fSum + Number(item.qty) * Number(item.unitPrice), 0);
    return sum + roomCharge + foodCharges;
  }, 0);

  return {
    date: new Date().toISOString().split("T")[0],
    quickSales: quickTotal,
    tableSales: tableTotal,
    roomSales: roomTotal,
    totalSales: quickTotal + tableTotal + roomTotal
  };
}

/**
 * Returns a monthly sales trend array over a date range.
 */
export async function getSalesTrend(range: DateRange, userId: string) {
  await assertAdminOrSuper(userId);

  const start = new Date(range.start);
  start.setHours(0, 0, 0, 0);
  const end = new Date(range.end);
  end.setHours(23, 59, 59, 999);

  // Build key-value map for monthly aggregates (YYYY-MM)
  const trendMap = new Map<string, { date: string; quickSales: number; tableSales: number; roomSales: number; totalSales: number }>();

  // Pre-populate all months in range
  const curMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (curMonth <= endMonth) {
    const monthStr = `${curMonth.getFullYear()}-${String(curMonth.getMonth() + 1).padStart(2, "0")}`;
    trendMap.set(monthStr, {
      date: monthStr,
      quickSales: 0,
      tableSales: 0,
      roomSales: 0,
      totalSales: 0
    });
    curMonth.setMonth(curMonth.getMonth() + 1);
  }

  // Helper to extract YYYY-MM from a Date
  const toMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  // Load datasets
  const quick = await superuserPrisma.quickSale.findMany({
    where: { createdAt: { gte: start, lte: end } }
  });
  const table = await superuserPrisma.tableOrder.findMany({
    where: {
      status: TableOrderStatus.CLOSED,
      updatedAt: { gte: start, lte: end }
    }
  });
  const room = await superuserPrisma.roomStay.findMany({
    where: {
      status: RoomStayStatus.CHECKED_OUT,
      actualCheckOut: { gte: start, lte: end }
    },
    include: {
      room: true,
      orderItems: true
    }
  });

  // Populate aggregates
  for (const s of quick) {
    const monthKey = toMonthKey(s.createdAt);
    const existing = trendMap.get(monthKey);
    if (existing) {
      existing.quickSales += Number(s.total);
    }
  }

  for (const o of table) {
    if (!o.updatedAt) continue;
    const monthKey = toMonthKey(o.updatedAt);
    const existing = trendMap.get(monthKey);
    if (existing) {
      existing.tableSales += Number(o.total || 0);
    }
  }

  for (const rs of room) {
    if (!rs.actualCheckOut) continue;
    const monthKey = toMonthKey(rs.actualCheckOut);
    const existing = trendMap.get(monthKey);
    if (existing) {
      const roomCharge = rs.numNights * Number(rs.room.nightlyRate);
      const foodCharges = rs.orderItems.reduce((sum, item) => sum + Number(item.qty) * Number(item.unitPrice), 0);
      existing.roomSales += roomCharge + foodCharges;
    }
  }

  // Sum totalSales for all entries
  const result = Array.from(trendMap.values());
  for (const entry of result) {
    entry.totalSales = entry.quickSales + entry.tableSales + entry.roomSales;
  }

  return result;
}

/**
 * Returns item-wise quantity and revenue summaries (best/slow sellers).
 */
export async function getItemWiseSales(range: DateRange, userId: string) {
  await assertAdminOrSuper(userId);

  const start = new Date(range.start);
  start.setHours(0, 0, 0, 0);
  const end = new Date(range.end);
  end.setHours(23, 59, 59, 999);

  // Fetch OrderItems from all sources
  const quickItems = await superuserPrisma.orderItem.findMany({
    where: {
      quickSale: { createdAt: { gte: start, lte: end } }
    },
    include: { menuItem: true }
  });

  const tableItems = await superuserPrisma.orderItem.findMany({
    where: {
      tableOrder: {
        status: TableOrderStatus.CLOSED,
        updatedAt: { gte: start, lte: end }
      }
    },
    include: { menuItem: true }
  });

  const roomItems = await superuserPrisma.orderItem.findMany({
    where: {
      roomStay: {
        status: RoomStayStatus.CHECKED_OUT,
        actualCheckOut: { gte: start, lte: end }
      }
    },
    include: { menuItem: true }
  });

  const allItems = [...quickItems, ...tableItems, ...roomItems];

  const summaryMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const item of allItems) {
    const it = item as any;
    if (!it.menuItem) continue;
    const existing = summaryMap.get(item.menuItemId);
    const itemQty = Number(item.qty);
    const itemRev = itemQty * Number(item.unitPrice);
    if (existing) {
      existing.qty += itemQty;
      existing.revenue += itemRev;
    } else {
      summaryMap.set(item.menuItemId, {
        name: it.menuItem.name,
        qty: itemQty,
        revenue: itemRev
      });
    }
  }

  const sorted = Array.from(summaryMap.values()).sort((a, b) => b.qty - a.qty);
  const bestSellers = sorted.slice(0, 5);
  const slowSellers = [...sorted].reverse().slice(0, 5);

  return { bestSellers, slowSellers };
}

/**
 * Returns raw item purchase costs cost report.
 */
export async function getPurchaseCostReport(range: DateRange, userId: string) {
  await assertAdminOrSuper(userId);

  const start = new Date(range.start);
  start.setHours(0, 0, 0, 0);
  const end = new Date(range.end);
  end.setHours(23, 59, 59, 999);

  const purchases = await superuserPrisma.purchase.findMany({
    where: { purchasedAt: { gte: start, lte: end } },
    include: { rawItem: true }
  });

  const summaryMap = new Map<string, { name: string; qty: number; totalCost: number }>();
  let grandTotal = 0;

  for (const p of purchases) {
    const existing = summaryMap.get(p.rawItemId);
    const pQty = Number(p.qty);
    const pCost = Number(p.totalCost);
    grandTotal += pCost;
    if (existing) {
      existing.qty += pQty;
      existing.totalCost += pCost;
    } else {
      summaryMap.set(p.rawItemId, {
        name: p.rawItem.name,
        qty: pQty,
        totalCost: pCost
      });
    }
  }

  return {
    totalCost: grandTotal,
    items: Array.from(summaryMap.values())
  };
}

/**
 * Returns outstanding, overdue, and written-off credit ledger totals.
 */
export async function getCreditOutstandingReport(userId: string) {
  await assertAdminOrSuper(userId);

  const ledgers = await superuserPrisma.creditLedger.findMany({
    include: { payments: true }
  });

  let totalOutstanding = 0;
  let totalOverdue = 0;
  let totalWrittenOff = 0;
  const activePhones = new Set<string>();
  const now = new Date();

  for (const ledger of ledgers) {
    if (ledger.status === "WRITTEN_OFF") {
      totalWrittenOff += Number(ledger.amount);
    } else if (ledger.status !== "PAID") {
      const paid = ledger.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const outstanding = Number(ledger.amount) - paid;
      if (outstanding > 0) {
        totalOutstanding += outstanding;
        activePhones.add(ledger.phone);
        if (new Date(ledger.dueDate) < now) {
          totalOverdue += outstanding;
        }
      }
    }
  }

  return {
    totalOutstanding,
    totalOverdue,
    totalWrittenOff,
    activeCustomersCount: activePhones.size
  };
}

/**
 * Returns room occupancy rate calculations.
 */
export async function getRoomOccupancyReport(range: DateRange, userId: string) {
  await assertAdminOrSuper(userId);

  const start = new Date(range.start);
  start.setHours(0, 0, 0, 0);
  const end = new Date(range.end);
  end.setHours(23, 59, 59, 999);

  const totalRooms = await superuserPrisma.room.count();
  const occupiedRoomsCount = await superuserPrisma.room.count({
    where: { status: "OCCUPIED" }
  });

  const stays = await superuserPrisma.roomStay.findMany({
    where: { checkIn: { gte: start, lte: end } },
    include: { room: true }
  });

  const totalNightsSold = stays.reduce((sum, s) => sum + s.numNights, 0);
  const totalRoomRevenue = stays.reduce((sum, s) => sum + s.numNights * Number(s.room.nightlyRate), 0);

  return {
    totalRooms,
    occupiedRoomsCount,
    totalNightsSold,
    totalRoomRevenue
  };
}

/**
 * Computes profitability statistics (Sales minus Purchases).
 * Gated to Super Admin only.
 */
export async function getProfitSummary(range: DateRange, userId: string) {
  await assertSuperAdmin(userId);

  const start = new Date(range.start);
  start.setHours(0, 0, 0, 0);
  const end = new Date(range.end);
  end.setHours(23, 59, 59, 999);

  // 1. Sales Calculations
  const quick = await superuserPrisma.quickSale.findMany({
    where: { createdAt: { gte: start, lte: end } }
  });
  const quickTotal = quick.reduce((sum, s) => sum + Number(s.total), 0);

  const table = await superuserPrisma.tableOrder.findMany({
    where: {
      status: TableOrderStatus.CLOSED,
      updatedAt: { gte: start, lte: end }
    }
  });
  const tableTotal = table.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const room = await superuserPrisma.roomStay.findMany({
    where: {
      status: RoomStayStatus.CHECKED_OUT,
      actualCheckOut: { gte: start, lte: end }
    },
    include: { room: true, orderItems: true }
  });
  const roomTotal = room.reduce((sum, s) => {
    const roomCharge = s.numNights * Number(s.room.nightlyRate);
    const foodCharges = s.orderItems.reduce((fSum, item) => fSum + Number(item.qty) * Number(item.unitPrice), 0);
    return sum + roomCharge + foodCharges;
  }, 0);

  const totalSales = quickTotal + tableTotal + roomTotal;

  // 2. Purchases Calculations
  const purchases = await superuserPrisma.purchase.findMany({
    where: { purchasedAt: { gte: start, lte: end } }
  });
  const totalPurchaseCost = purchases.reduce((sum, p) => sum + Number(p.totalCost), 0);

  return {
    totalSales,
    totalPurchaseCost,
    grossProfit: totalSales - totalPurchaseCost
  };
}
