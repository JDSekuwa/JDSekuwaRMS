import "dotenv/config";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { prisma, superuserPrisma } from "../lib/prisma";
import { openTableOrder, addItemsToTableOrder, closeTableOrder, createQuickSale } from "./sales.service";
import { TableStatus, TableOrderStatus, PaymentType, Role } from "../generated/prisma/client";
import { TableConflictError } from "../lib/errors";

describe("Sales & Table Ordering Service Integration Tests (Stage B-3)", () => {
  let workerId: string;
  let adminId: string;
  let testTableId: string;
  let porkMenuItemId: string;
  let rawPorkId: string;
  let rawSpiceId: string;

  beforeAll(async () => {
    // 1. Fetch test profiles
    const worker = await superuserPrisma.profile.findFirst({ where: { role: Role.WORKER } });
    const admin = await superuserPrisma.profile.findFirst({ where: { role: Role.SUPER_ADMIN } });
    if (!worker || !admin) {
      throw new Error("Seeded profiles not found. Run seed-profiles.ts first.");
    }
    workerId = worker.id;
    adminId = admin.id;

    // 2. Fetch or create a test table
    let table = await superuserPrisma.restaurantTable.findFirst({ where: { name: "Table 1" } });
    if (!table) {
      table = await superuserPrisma.restaurantTable.create({
        data: { name: "Table 1", status: TableStatus.VACANT, version: 1 }
      });
    }
    testTableId = table.id;

    // 3. Fetch menu item and raw items
    const porkItem = await superuserPrisma.menuItem.findFirst({ where: { name: "Pork Sekuwa (Plate)" } });
    const porkRaw = await superuserPrisma.rawItem.findFirst({ where: { name: "Pork Meat" } });
    const spiceRaw = await superuserPrisma.rawItem.findFirst({ where: { name: "House Sekuwa Spice Mix" } });

    if (!porkItem || !porkRaw || !spiceRaw) {
      throw new Error("Seeded menu items and raw ingredients not found. Run seed.ts first.");
    }
    porkMenuItemId = porkItem.id;
    rawPorkId = porkRaw.id;
    rawSpiceId = spiceRaw.id;
  });

  afterEach(async () => {
    // Reset test table to VACANT state
    await superuserPrisma.restaurantTable.update({
      where: { id: testTableId },
      data: { status: TableStatus.VACANT, currentTag: null }
    });

    // Clean up created TableOrders and OrderItems for test safety
    const orders = await superuserPrisma.tableOrder.findMany({
      where: { tableId: testTableId }
    });
    for (const order of orders) {
      await superuserPrisma.orderItem.deleteMany({ where: { tableOrderId: order.id } });
      await superuserPrisma.creditLedger.deleteMany({ where: { sourceId: order.id } });
      await superuserPrisma.tableOrder.delete({ where: { id: order.id } });
    }
  });

  it("should successfully open a table order and optimistic-lock against concurrent opens", async () => {
    // Attempt parallel table opens
    const promise1 = openTableOrder(testTableId, "Session A", workerId);
    const promise2 = openTableOrder(testTableId, "Session B", workerId);

    const results = await Promise.allSettled([promise1, promise2]);

    const fulfilled = results.filter(r => r.status === "fulfilled");
    const rejected = results.filter(r => r.status === "rejected");

    // Exactly one call must succeed, and the other must fail with TableConflictError
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error).toBeInstanceOf(TableConflictError);
  });

  it("should close a table order, deduct inventory, and write a CreditLedger entry when paid on credit", async () => {
    // 1. Fetch stock levels before deduction
    const porkBefore = await superuserPrisma.rawItem.findUnique({ where: { id: rawPorkId } });
    const spiceBefore = await superuserPrisma.rawItem.findUnique({ where: { id: rawSpiceId } });

    // 2. Open table order
    const order = await openTableOrder(testTableId, "Tag Test", workerId);

    // 3. Add Pork Sekuwa (Plate) to the table order
    await addItemsToTableOrder(
      order.id,
      [{ menuItemId: porkMenuItemId, qty: 2 }],
      workerId
    );

    // 4. Close the table order settling on credit
    const customerInfo = { customerName: "Rabin Sekuwa", phone: "9800000000" };
    await closeTableOrder(
      order.id,
      workerId,
      PaymentType.CREDIT,
      0, // discount
      customerInfo
    );

    // 5. Verify table status is vacant again
    const table = await superuserPrisma.restaurantTable.findUnique({ where: { id: testTableId } });
    expect(table!.status).toBe(TableStatus.VACANT);
    expect(table!.currentTag).toBeNull();

    // 6. Verify table order status is CLOSED
    const closedOrder = await superuserPrisma.tableOrder.findUnique({ where: { id: order.id } });
    expect(closedOrder!.status).toBe(TableOrderStatus.CLOSED);

    // 7. Verify ingredient stocks are decremented
    const porkAfter = await superuserPrisma.rawItem.findUnique({ where: { id: rawPorkId } });
    const spiceAfter = await superuserPrisma.rawItem.findUnique({ where: { id: rawSpiceId } });

    // Deducts 2 plates -> 2 * 0.333 kg pork, 2 * 0.050 kg spice
    expect(Number(porkAfter!.currentStock)).toBe(Number(porkBefore!.currentStock) - 0.333 * 2);
    expect(Number(spiceAfter!.currentStock)).toBe(Number(spiceBefore!.currentStock) - 0.050 * 2);

    // 8. Verify CreditLedger record is created
    const credit = await superuserPrisma.creditLedger.findFirst({
      where: { sourceId: order.id }
    });
    expect(credit).toBeDefined();
    expect(credit!.customerName).toBe(customerInfo.customerName);
    expect(credit!.phone).toBe(customerInfo.phone);
    expect(credit!.amount.toString()).toBe(closedOrder!.total!.toString());

    // Restore stock levels manually to avoid test pollution
    await superuserPrisma.rawItem.update({
      where: { id: rawPorkId },
      data: { currentStock: porkBefore!.currentStock }
    });
    await superuserPrisma.rawItem.update({
      where: { id: rawSpiceId },
      data: { currentStock: spiceBefore!.currentStock }
    });
  });
});
