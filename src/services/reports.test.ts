import "dotenv/config";
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { prisma, superuserPrisma } from "../lib/prisma";
import { getDailySalesSummary, getProfitSummary } from "./reports.service";
import { Role } from "../generated/prisma/client";
import { ForbiddenError } from "../lib/errors";

describe("Reports Service Integration Tests (Stage B-7)", () => {
  let workerId: string;
  let adminId: string;
  let superadminId: string;
  let testQuickSaleId: string;
  let testPurchaseId: string;
  let rawPorkId: string;

  beforeAll(async () => {
    // 1. Fetch test profiles
    const worker = await superuserPrisma.profile.findFirst({ where: { role: Role.WORKER } });
    const admin = await superuserPrisma.profile.findFirst({ where: { role: Role.ADMIN } });
    const superadmin = await superuserPrisma.profile.findFirst({ where: { role: Role.SUPER_ADMIN } });
    
    if (!worker || !admin || !superadmin) {
      throw new Error("Seeded profiles not found. Run seed-profiles.ts first.");
    }
    workerId = worker.id;
    adminId = admin.id;
    superadminId = superadmin.id;

    // 2. Fetch test raw item for purchase link
    const raw = await superuserPrisma.rawItem.findFirst();
    if (!raw) {
      throw new Error("No raw items found. Seed the database first.");
    }
    rawPorkId = raw.id;

    // 3. Create test quick sale
    const sale = await superuserPrisma.quickSale.create({
      data: {
        paymentType: "CASH",
        subtotal: 500.00,
        discount: 0,
        total: 500.00,
        cashierId: superadminId
      }
    });
    testQuickSaleId = sale.id;

    // 4. Create test purchase
    const purchase = await superuserPrisma.purchase.create({
      data: {
        rawItemId: rawPorkId,
        qty: 1,
        unitCost: 150.00,
        totalCost: 150.00,
        recordedById: superadminId
      }
    });
    testPurchaseId = purchase.id;
  });

  afterEach(async () => {
    // No-op - we clean up database structures in afterAll or just keep them isolated.
  });

  afterAll(async () => {
    // Clean up created logs
    if (testPurchaseId) {
      await superuserPrisma.purchase.delete({ where: { id: testPurchaseId } }).catch(() => {});
    }
    if (testQuickSaleId) {
      await superuserPrisma.quickSale.delete({ where: { id: testQuickSaleId } }).catch(() => {});
    }
  });

  it("should calculate getDailySalesSummary correctly including the seeded QuickSale", async () => {
    const summary = await getDailySalesSummary(adminId);

    expect(summary).toBeDefined();
    expect(summary.date).toBe(new Date().toISOString().split("T")[0]);
    expect(summary.quickSales).toBeGreaterThanOrEqual(500.00);
    expect(summary.totalSales).toBe(summary.quickSales + summary.tableSales + summary.roomSales);
  });

  it("should calculate getProfitSummary correctly for SUPER_ADMIN, summing sales and subtracting purchases", async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const profit = await getProfitSummary({ start: todayStart, end: todayEnd }, superadminId);

    expect(profit).toBeDefined();
    expect(profit.totalSales).toBeGreaterThanOrEqual(500.00);
    expect(profit.totalPurchaseCost).toBeGreaterThanOrEqual(150.00);
    expect(profit.grossProfit).toBe(profit.totalSales - profit.totalPurchaseCost);
  });

  it("should reject non-Super-Admin callers from accessing getProfitSummary", async () => {
    const todayStart = new Date();
    const todayEnd = new Date();

    // 1. Worker fails
    await expect(
      getProfitSummary({ start: todayStart, end: todayEnd }, workerId)
    ).rejects.toThrow(ForbiddenError);

    // 2. Restaurant Admin fails
    await expect(
      getProfitSummary({ start: todayStart, end: todayEnd }, adminId)
    ).rejects.toThrow(ForbiddenError);
  });
});
