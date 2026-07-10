import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { superuserPrisma } from "../lib/prisma";
import { sendPasswordResetEmail, sendLowStockDigest, sendOverdueCreditDigest } from "./email.service";
import { CreditSource, CreditStatus, Unit } from "../generated/prisma/client";

// Mock Supabase Admin Client
vi.mock("../lib/supabase", () => {
  return {
    createAdminClient: vi.fn(() => ({
      auth: {
        admin: {
          generateLink: vi.fn().mockImplementation(async ({ email }) => {
            if (email === "nonexistent@example.com") {
              return { data: {}, error: new Error("User not found") };
            }
            return {
              data: {
                properties: {
                  action_link: `https://jdsekuwahouse.com.np/reset-password?token=mock_token_for_${email}`
                }
              },
              error: null
            };
          })
        }
      }
    }))
  };
});

describe("Email Service Unit & Integration Tests (Stage B-9)", () => {
  let lowStockItemId: string;
  let normalStockItemId: string;
  let overdueCreditId: string;

  beforeAll(async () => {
    // 1. Create a raw item that is low in stock
    const lowItem = await superuserPrisma.rawItem.create({
      data: {
        name: "Test Low Item A",
        unit: Unit.KG,
        currentStock: 1.000,
        minThreshold: 10.000,
        costPrice: 100.00
      }
    });
    lowStockItemId = lowItem.id;

    // 2. Create a raw item that has normal stock levels
    const normalItem = await superuserPrisma.rawItem.create({
      data: {
        name: "Test Normal Item B",
        unit: Unit.KG,
        currentStock: 25.000,
        minThreshold: 10.000,
        costPrice: 100.00
      }
    });
    normalStockItemId = normalItem.id;

    // 3. Create an overdue credit entry
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 5); // 5 days in the past

    const ledger = await superuserPrisma.creditLedger.create({
      data: {
        customerName: "Test Overdue Customer",
        phone: "9876543210",
        source: CreditSource.TABLE_SALE,
        sourceId: "00000000-0000-0000-0000-000000000000",
        amount: 2500.00,
        givenDate: overdueDate,
        dueDate: overdueDate,
        status: CreditStatus.PENDING
      }
    });
    overdueCreditId = ledger.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    await superuserPrisma.rawItem.deleteMany({
      where: { id: { in: [lowStockItemId, normalStockItemId] } }
    });
    await superuserPrisma.creditLedger.deleteMany({
      where: { id: overdueCreditId }
    });
  });

  describe("sendPasswordResetEmail()", () => {
    it("should successfully generate recovery link and dispatch email", async () => {
      const email = "user@example.com";
      const result = await sendPasswordResetEmail(email);

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^mock_email_id_/);
    });

    it("should throw error if email recovery link generation fails", async () => {
      const email = "nonexistent@example.com";
      await expect(sendPasswordResetEmail(email)).rejects.toThrow();
    });
  });

  describe("sendLowStockDigest()", () => {
    it("should compile and send digest if items are low in stock", async () => {
      const result = await sendLowStockDigest("manager@example.com");

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^mock_email_id_/);
    });

    it("should return skipped object if no items are low in stock", async () => {
      // Temporarily bump the low stock item
      await superuserPrisma.rawItem.update({
        where: { id: lowStockItemId },
        data: { currentStock: 15.000 }
      });

      const result = await sendLowStockDigest("manager@example.com");
      expect(result).toEqual({ skipped: true, reason: "No items below min threshold" });

      // Revert stock level back to low
      await superuserPrisma.rawItem.update({
        where: { id: lowStockItemId },
        data: { currentStock: 1.000 }
      });
    });
  });

  describe("sendOverdueCreditDigest()", () => {
    it("should compile and send digest if overdue credits exist", async () => {
      const result = await sendOverdueCreditDigest("billing@example.com");

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^mock_email_id_/);
    });

    it("should return skipped object if no overdue credits exist", async () => {
      // Delete the test overdue ledger temporarily
      await superuserPrisma.creditLedger.delete({
        where: { id: overdueCreditId }
      });

      // Query since no overdue should be present now
      const result = await sendOverdueCreditDigest("billing@example.com");
      expect(result).toEqual({ skipped: true, reason: "No overdue credit ledgers found" });

      // Re-create it for future safety or cleanup
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 5);
      const ledger = await superuserPrisma.creditLedger.create({
        data: {
          id: overdueCreditId,
          customerName: "Test Overdue Customer",
          phone: "9876543210",
          source: CreditSource.TABLE_SALE,
          sourceId: "00000000-0000-0000-0000-000000000000",
          amount: 2500.00,
          givenDate: overdueDate,
          dueDate: overdueDate,
          status: CreditStatus.PENDING
        }
      });
      overdueCreditId = ledger.id;
    });
  });
});
