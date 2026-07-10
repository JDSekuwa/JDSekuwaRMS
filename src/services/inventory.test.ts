import "dotenv/config";
import { describe, it, expect, beforeAll } from "vitest";
import { prisma, superuserPrisma } from "../lib/prisma";
import { deductForSale, restoreForVoid } from "./inventory.service";
import { InsufficientStockError } from "../lib/errors";

class RollbackError extends Error {
  constructor() {
    super("Rollback transaction for test safety.");
    this.name = "RollbackError";
  }
}

describe("Inventory Stock Deductions & Restoration (Stage B-2)", () => {
  let porkMenuItemId: string;
  let rawPorkId: string;
  let rawSpiceId: string;

  beforeAll(async () => {
    // Fetch the seeded MenuItem and RawItems to ensure test stability
    const porkItem = await superuserPrisma.menuItem.findFirst({
      where: { name: "Pork Sekuwa (Plate)" }
    });
    const porkRaw = await superuserPrisma.rawItem.findFirst({
      where: { name: "Pork Meat" }
    });
    const spiceRaw = await superuserPrisma.rawItem.findFirst({
      where: { name: "House Sekuwa Spice Mix" }
    });

    if (!porkItem || !porkRaw || !spiceRaw) {
      throw new Error("Seeded test data not found in DB. Make sure seed.ts was run.");
    }

    porkMenuItemId = porkItem.id;
    rawPorkId = porkRaw.id;
    rawSpiceId = spiceRaw.id;
  });

  it("should successfully deduct stock levels for a sale and return deductions snapshot", async () => {
    try {
      await superuserPrisma.$transaction(async (tx) => {
        // Fetch current stocks before deduction
        const porkBefore = await tx.rawItem.findUnique({ where: { id: rawPorkId } });
        const spiceBefore = await tx.rawItem.findUnique({ where: { id: rawSpiceId } });

        const qtyToSell = 2; // Sell 2 plates
        const deductions = await deductForSale(porkMenuItemId, qtyToSell, undefined, tx);

        // Verify deductions snapshot returned
        expect(deductions).toHaveLength(2);
        const porkDeduction = deductions.find(d => d.rawItemId === rawPorkId);
        const spiceDeduction = deductions.find(d => d.rawItemId === rawSpiceId);

        expect(porkDeduction).toBeDefined();
        expect(porkDeduction!.qtyDeducted).toBe(0.333 * qtyToSell);
        expect(spiceDeduction).toBeDefined();
        expect(spiceDeduction!.qtyDeducted).toBe(0.050 * qtyToSell);

        // Fetch current stocks after deduction and check values
        const porkAfter = await tx.rawItem.findUnique({ where: { id: rawPorkId } });
        const spiceAfter = await tx.rawItem.findUnique({ where: { id: rawSpiceId } });

        expect(Number(porkAfter!.currentStock)).toBe(Number(porkBefore!.currentStock) - 0.333 * qtyToSell);
        expect(Number(spiceAfter!.currentStock)).toBe(Number(spiceBefore!.currentStock) - 0.050 * qtyToSell);

        throw new RollbackError(); // Rollback to keep DB clean
      });
    } catch (e) {
      if (!(e instanceof RollbackError)) throw e;
    }
  });

  it("should throw InsufficientStockError when stock goes negative", async () => {
    try {
      await superuserPrisma.$transaction(async (tx) => {
        // Find current pork stock level
        const porkItem = await tx.rawItem.findUnique({ where: { id: rawPorkId } });
        const availableStock = Number(porkItem!.currentStock);

        // Attempt to sell a ridiculously high quantity that exceeds stock
        const ridiculousQty = Math.ceil(availableStock / 0.333) + 10;

        await expect(
          deductForSale(porkMenuItemId, ridiculousQty, undefined, tx)
        ).rejects.toThrow(InsufficientStockError);

        throw new RollbackError();
      });
    } catch (e) {
      if (!(e instanceof RollbackError)) throw e;
    }
  });

  it("should successfully restore stock on void using rawDeductions snapshot", async () => {
    try {
      await superuserPrisma.$transaction(async (tx) => {
        const porkBefore = await tx.rawItem.findUnique({ where: { id: rawPorkId } });
        const spiceBefore = await tx.rawItem.findUnique({ where: { id: rawSpiceId } });

        // 1. Run deduction
        const deductions = await deductForSale(porkMenuItemId, 1, undefined, tx);

        // 2. Create a temporary OrderItem with the deductions snapshot
        const orderItem = await tx.orderItem.create({
          data: {
            menuItemId: porkMenuItemId,
            qty: 1,
            unitPrice: 450.00,
            rawDeductions: deductions,
          }
        });

        // Verify stock has decreased
        const porkAfterDeduct = await tx.rawItem.findUnique({ where: { id: rawPorkId } });
        expect(Number(porkAfterDeduct!.currentStock)).toBe(Number(porkBefore!.currentStock) - 0.333);

        // 3. Void/Restore
        await restoreForVoid(orderItem.id, tx);

        // Verify stock has returned to original level
        const porkAfterRestore = await tx.rawItem.findUnique({ where: { id: rawPorkId } });
        const spiceAfterRestore = await tx.rawItem.findUnique({ where: { id: rawSpiceId } });

        expect(Number(porkAfterRestore!.currentStock)).toBe(Number(porkBefore!.currentStock));
        expect(Number(spiceAfterRestore!.currentStock)).toBe(Number(spiceBefore!.currentStock));

        throw new RollbackError();
      });
    } catch (e) {
      if (!(e instanceof RollbackError)) throw e;
    }
  });
});
