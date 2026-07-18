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
  // Run all independent queries in parallel
  const [dailySales, inventoryResult, creditResult, rooms, tables] = await Promise.all([
    // 1. Daily Sales Summary (Admin/SuperAdmin only)
    (role === Role.ADMIN || role === Role.SUPER_ADMIN)
      ? getDailySalesSummary(userId).catch(() => null)
      : Promise.resolve(null),
    // 2. Inventory Alert List
    getInventoryList(role),
    // 3. Credit Reminders (Admin/SuperAdmin only)
    (role === Role.ADMIN || role === Role.SUPER_ADMIN)
      ? listCreditCustomers().catch(() => ({ data: [] }))
      : Promise.resolve({ data: [] }),
    // 4. Room Status Summary
    superuserPrisma.room.findMany({
      orderBy: { name: "asc" }
    }),
    // 5. Table Status Summary
    superuserPrisma.restaurantTable.findMany({
      include: {
        orders: {
          where: { status: "OPEN" },
          include: {
            items: true
          }
        }
      },
      orderBy: { name: "asc" }
    })
  ]);

  // Map inventory alerts
  const stockAlerts = (inventoryResult.items || [])
    .filter(item => item.currentStock < item.minThreshold)
    .map(item => ({
      id: item.id,
      name: item.name,
      unit: item.unit,
      currentStock: item.currentStock,
      minThreshold: item.minThreshold
    }));

  // Map credit reminders
  const creditsArray = Array.isArray(creditResult) ? creditResult : creditResult.data;
  const creditReminders = (creditsArray || []).slice(0, 5);

  // Map room status summary
  const roomsMapped = rooms.map(r => ({
    id: r.id,
    name: r.name,
    status: r.status,
    nightlyRate: role === Role.WORKER ? null : Number(r.nightlyRate),
    imageUrl: r.imageUrl
  }));

  // Map table status summary
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
