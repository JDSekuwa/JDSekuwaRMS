import "dotenv/config";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { prisma, superuserPrisma } from "../lib/prisma";
import { recordPurchase, listPurchases } from "./purchase.service";
import { Role } from "../generated/prisma/client";
import { ForbiddenError } from "../lib/errors";

describe("Purchase Service Integration Tests (Stage B-6)", () => {
  let workerId: string;
  let adminId: string;
  let rawPorkId: string;
  let initialStock: number;

  beforeAll(async () => {
    // 1. Fetch test profiles
    const worker = await superuserPrisma.profile.findFirst({ where: { role: Role.WORKER } });
    const admin = await superuserPrisma.profile.findFirst({ where: { role: Role.SUPER_ADMIN } });
    if (!worker || !admin) {
      throw new Error("Seeded profiles not found. Run seed-profiles.ts first.");
    }
    workerId = worker.id;
    adminId = admin.id;

    // 2. Fetch test raw item
    const porkRaw = await superuserPrisma.rawItem.findFirst({ where: { name: "Pork Meat" } });
    if (!porkRaw) {
      throw new Error("Seeded raw item Pork Meat not found.");
    }
    rawPorkId = porkRaw.id;
    initialStock = Number(porkRaw.currentStock);
  });

  afterEach(async () => {
    // Restore raw item stock level
    await superuserPrisma.rawItem.update({
      where: { id: rawPorkId },
      data: { currentStock: initialStock }
    });

    // Delete created purchases during tests
    await superuserPrisma.purchase.deleteMany({
      where: { rawItemId: rawPorkId }
    });
  });

  it("should successfully record a purchase and increment stock level", async () => {
    const qtyPurchased = 10;
    const unitCost = 500;
    const supplier = "Sekuwa Meat Supplier Ltd.";

    // Record purchase using Admin role
    const purchase = await recordPurchase(rawPorkId, qtyPurchased, unitCost, supplier, adminId);

    expect(purchase).toBeDefined();
    expect(purchase.qty.toNumber()).toBe(qtyPurchased);
    expect(purchase.unitCost.toNumber()).toBe(unitCost);
    expect(purchase.totalCost.toNumber()).toBe(qtyPurchased * unitCost);
    expect(purchase.supplierName).toBe(supplier);

    // Verify stock incremented
    const rawAfter = await superuserPrisma.rawItem.findUnique({
      where: { id: rawPorkId }
    });
    expect(Number(rawAfter!.currentStock)).toBeCloseTo(initialStock + qtyPurchased, 5);

    // Verify listPurchases works for Admin
    const purchases = (await listPurchases({ rawItemId: rawPorkId }, adminId)) as any[];
    expect(purchases).toHaveLength(1);
    expect(purchases[0].id).toBe(purchase.id);
  });

  it("should block Workers from recording or listing purchases", async () => {
    // 1. Worker tries to record -> ForbiddenError
    await expect(
      recordPurchase(rawPorkId, 5, 200, "Test Supplier", workerId)
    ).rejects.toThrow(ForbiddenError);

    // 2. Worker tries to list -> ForbiddenError
    await expect(
      listPurchases({}, workerId)
    ).rejects.toThrow(ForbiddenError);
  });
});
