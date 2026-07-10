import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { superuserPrisma } from "../lib/prisma";
import { buildKotPayload, buildReceiptPayload } from "./print.service";
import { Role, TableStatus, TableOrderStatus, PaymentType } from "../generated/prisma/client";

describe("Print Service Unit & Integration Tests (Stage B-9)", () => {
  let workerId: string;
  let kitchenCatId: string;
  let barCatId: string;
  let kitchenItemId: string;
  let barItemId: string;
  let testTableId: string;
  let tableOrderId: string;
  let quickSaleId: string;

  beforeAll(async () => {
    // 1. Resolve a profile
    const worker = await superuserPrisma.profile.findFirst({ where: { role: Role.WORKER } });
    if (!worker) {
      throw new Error("Worker profile not found. Seed profiles first.");
    }
    workerId = worker.id;

    // 2. Create custom categories for isolating print test
    const kcat = await superuserPrisma.menuCategory.create({
      data: { name: "Test Kitchen Category", isKitchen: true }
    });
    kitchenCatId = kcat.id;

    const bcat = await superuserPrisma.menuCategory.create({
      data: { name: "Test Bar Category", isKitchen: false }
    });
    barCatId = bcat.id;

    // 3. Create custom menu items
    const kitem = await superuserPrisma.menuItem.create({
      data: { name: "Test Pork Ribs", price: 500.00, categoryId: kitchenCatId }
    });
    kitchenItemId = kitem.id;

    const bitem = await superuserPrisma.menuItem.create({
      data: { name: "Test Ginger Ale", price: 150.00, categoryId: barCatId }
    });
    barItemId = bitem.id;

    // 4. Create a test table
    const table = await superuserPrisma.restaurantTable.create({
      data: { name: "Table Print T1", status: TableStatus.OCCUPIED, currentTag: "Lunch", version: 1 }
    });
    testTableId = table.id;

    // 5. Create a table order with items
    const order = await superuserPrisma.tableOrder.create({
      data: {
        tableId: testTableId,
        status: TableOrderStatus.CLOSED,
        paymentType: PaymentType.CASH,
        subtotal: 1150.00, // 2*500 + 1*150
        discount: 50.00,
        total: 1100.00,
        openedById: workerId,
        closedAt: new Date()
      }
    });
    tableOrderId = order.id;

    // Create order items (one kitchen, one bar, one voided kitchen)
    await superuserPrisma.orderItem.create({
      data: {
        tableOrderId,
        menuItemId: kitchenItemId,
        qty: 2,
        unitPrice: 500.00,
        isVoid: false
      }
    });

    await superuserPrisma.orderItem.create({
      data: {
        tableOrderId,
        menuItemId: barItemId,
        qty: 1,
        unitPrice: 150.00,
        isVoid: false
      }
    });

    await superuserPrisma.orderItem.create({
      data: {
        tableOrderId,
        menuItemId: kitchenItemId,
        qty: 1,
        unitPrice: 500.00,
        isVoid: true // This is voided and should NOT print
      }
    });

    // 6. Create a quick sale
    const sale = await superuserPrisma.quickSale.create({
      data: {
        paymentType: PaymentType.CARD,
        subtotal: 650.00,
        discount: 0.00,
        total: 650.00,
        cashierId: workerId
      }
    });
    quickSaleId = sale.id;

    await superuserPrisma.orderItem.create({
      data: {
        quickSaleId,
        menuItemId: kitchenItemId,
        qty: 1,
        unitPrice: 500.00,
        isVoid: false
      }
    });

    await superuserPrisma.orderItem.create({
      data: {
        quickSaleId,
        menuItemId: barItemId,
        qty: 1,
        unitPrice: 150.00,
        isVoid: false
      }
    });
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    await superuserPrisma.orderItem.deleteMany({
      where: {
        OR: [
          { tableOrderId },
          { quickSaleId }
        ]
      }
    });

    await superuserPrisma.tableOrder.deleteMany({ where: { id: tableOrderId } });
    await superuserPrisma.quickSale.deleteMany({ where: { id: quickSaleId } });
    await superuserPrisma.restaurantTable.deleteMany({ where: { id: testTableId } });
    await superuserPrisma.menuItem.deleteMany({ where: { id: { in: [kitchenItemId, barItemId] } } });
    await superuserPrisma.menuCategory.deleteMany({ where: { id: { in: [kitchenCatId, barCatId] } } });
  });

  describe("buildKotPayload()", () => {
    it("should aggregate kitchen items only and omit all prices", async () => {
      const kot = await buildKotPayload(tableOrderId);

      expect(kot).toBeDefined();
      expect(kot.tableOrderId).toBe(tableOrderId);
      expect(kot.tableName).toBe("Table Print T1");
      expect(kot.tag).toBe("Lunch");
      expect(kot.openedBy).toBe("WORKER");

      // Verify items
      expect(kot.items).toHaveLength(1);
      expect(kot.items[0].name).toBe("Test Pork Ribs");
      expect(kot.items[0].qty).toBe(2);

      // Verify no price fields leaked
      expect(kot.items[0]).not.toHaveProperty("unitPrice");
      expect(kot.items[0]).not.toHaveProperty("price");
      expect(kot.items[0]).not.toHaveProperty("total");
    });
  });

  describe("buildReceiptPayload()", () => {
    it("should build correct receipt payload for a Table Order", async () => {
      const receipt = await buildReceiptPayload(tableOrderId);

      expect(receipt).toBeDefined();
      expect(receipt.id).toBe(tableOrderId);
      expect(receipt.type).toBe("TABLE_ORDER");
      expect(receipt.tableName).toBe("Table Print T1");
      expect(receipt.tag).toBe("Lunch");
      expect(receipt.cashierName).toBe("WORKER");
      expect(receipt.subtotal).toBe(1150.00);
      expect(receipt.discount).toBe(50.00);
      expect(receipt.total).toBe(1100.00);
      expect(receipt.paymentType).toBe(PaymentType.CASH);

      // Should contain 2 active non-void items
      expect(receipt.items).toHaveLength(2);
      
      const ribItem = receipt.items.find(i => i.name === "Test Pork Ribs");
      expect(ribItem).toBeDefined();
      expect(ribItem!.qty).toBe(2);
      expect(ribItem!.unitPrice).toBe(500.00);
      expect(ribItem!.total).toBe(1000.00);

      const aleItem = receipt.items.find(i => i.name === "Test Ginger Ale");
      expect(aleItem).toBeDefined();
      expect(aleItem!.qty).toBe(1);
      expect(aleItem!.unitPrice).toBe(150.00);
      expect(aleItem!.total).toBe(150.00);
    });

    it("should build correct receipt payload for a Quick Sale", async () => {
      const receipt = await buildReceiptPayload(quickSaleId);

      expect(receipt).toBeDefined();
      expect(receipt.id).toBe(quickSaleId);
      expect(receipt.type).toBe("QUICK_SALE");
      expect(receipt.tableName).toBe("POS");
      expect(receipt.tag).toBeNull();
      expect(receipt.cashierName).toBe("WORKER");
      expect(receipt.subtotal).toBe(650.00);
      expect(receipt.discount).toBe(0.00);
      expect(receipt.total).toBe(650.00);
      expect(receipt.paymentType).toBe(PaymentType.CARD);

      expect(receipt.items).toHaveLength(2);
    });

    it("should throw error for non-existent IDs", async () => {
      const bogusId = "00000000-0000-0000-0000-000000000000";
      await expect(buildReceiptPayload(bogusId)).rejects.toThrow();
    });
  });
});
