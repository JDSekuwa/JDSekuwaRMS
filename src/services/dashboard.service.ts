import { superuserPrisma } from "../lib/prisma";
import { Role } from "../generated/prisma/client";
import { getInventoryList } from "./inventory.service";
import { listCreditCustomers } from "./credit.service";
import { getDailySalesSummary } from "./reports.service";

/**
 * Returns composed dashboard statistics and resource statuses.
 * Strips all financial figures entirely for the WORKER role at the service layer.
 */
export async function getDashboardData(role: Role, userId: string) {
  // 1. Daily Sales Summary (Admin/SuperAdmin only)
  let dailySales = null;
  if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
    try {
      dailySales = await getDailySalesSummary(userId);
    } catch (e) {
      dailySales = null;
    }
  }

  // 2. Stock Alerts (Ingredients below min threshold)
  const { items: inventory } = await getInventoryList(role);
  const stockAlerts = inventory
    .filter(item => item.currentStock < item.minThreshold)
    .map(item => ({
      id: item.id,
      name: item.name,
      unit: item.unit,
      currentStock: item.currentStock,
      minThreshold: item.minThreshold
    }));

  // 3. Credit Reminders (Top 5 overdue first, Admin/SuperAdmin only)
  let creditReminders: any[] = [];
  if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
    const credits = await listCreditCustomers();
    const creditsArray = Array.isArray(credits) ? credits : credits.data;
    creditReminders = creditsArray.slice(0, 5);
  }

  // 4. Room Status Summary
  const rooms = await superuserPrisma.room.findMany({
    orderBy: { name: "asc" }
  });
  const roomsMapped = rooms.map(r => ({
    id: r.id,
    name: r.name,
    status: r.status,
    nightlyRate: role === Role.WORKER ? null : Number(r.nightlyRate),
    imageUrl: r.imageUrl
  }));

  // 5. Table Status Summary
  const tables = await superuserPrisma.restaurantTable.findMany({
    include: {
      orders: {
        where: { status: "OPEN" },
        include: {
          items: true
        }
      }
    },
    orderBy: { name: "asc" }
  });

  const tablesMapped = tables.map(t => {
    let openOrderTotal = null;
    if (role !== Role.WORKER) {
      const activeOrder = t.orders[0];
      openOrderTotal = activeOrder
        ? activeOrder.items.reduce((sum, item) => sum + Number(item.qty) * Number(item.unitPrice), 0)
        : 0;
    }

    return {
      id: t.id,
      name: t.name,
      status: t.status,
      currentTag: t.currentTag,
      imageUrl: t.imageUrl,
      openOrderTotal
    };
  });

  return {
    dailySales,
    stockAlerts,
    creditReminders,
    rooms: roomsMapped,
    tables: tablesMapped
  };
}
