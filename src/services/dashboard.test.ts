import "dotenv/config";
import { describe, it, expect, beforeAll } from "vitest";
import { superuserPrisma } from "../lib/prisma";
import { getDashboardData } from "./dashboard.service";
import { Role } from "../generated/prisma/client";

describe("Dashboard Service Integration Tests (Stage B-8)", () => {
  let workerId: string;
  let adminId: string;

  beforeAll(async () => {
    const worker = await superuserPrisma.profile.findFirst({ where: { role: Role.WORKER } });
    const admin = await superuserPrisma.profile.findFirst({ where: { role: Role.ADMIN } });

    if (!worker || !admin) {
      throw new Error("Seeded profiles not found. Run seed-profiles.ts first.");
    }
    workerId = worker.id;
    adminId = admin.id;
  });

  it("should strip all financial fields for a WORKER role call", async () => {
    const data = await getDashboardData(Role.WORKER, workerId);

    // Daily sales must be null for workers
    expect(data.dailySales).toBeNull();

    // Credit reminders must be an empty array for workers
    expect(data.creditReminders).toEqual([]);

    // Room nightly rates must all be null
    for (const room of data.rooms) {
      expect(room.nightlyRate).toBeNull();
    }

    // Table open order totals must all be null
    for (const table of data.tables) {
      expect(table.openOrderTotal).toBeNull();
    }

    // Stock alerts should still be present (non-financial)
    expect(data.stockAlerts).toBeDefined();
    expect(Array.isArray(data.stockAlerts)).toBe(true);
  });

  it("should return full financial data for an ADMIN role call", async () => {
    const data = await getDashboardData(Role.ADMIN, adminId);

    // Daily sales should be present for admin
    expect(data.dailySales).not.toBeNull();
    expect(data.dailySales).toHaveProperty("totalSales");

    // Credit reminders should be an array (may be empty if no credit data, but not stripped)
    expect(data.creditReminders).toBeDefined();
    expect(Array.isArray(data.creditReminders)).toBe(true);

    // Room nightly rates should be numbers, not null
    if (data.rooms.length > 0) {
      expect(data.rooms[0].nightlyRate).not.toBeNull();
      expect(typeof data.rooms[0].nightlyRate).toBe("number");
    }

    // Table open order totals should be numbers, not null
    if (data.tables.length > 0) {
      expect(data.tables[0].openOrderTotal).not.toBeNull();
      expect(typeof data.tables[0].openOrderTotal).toBe("number");
    }

    // Stock alerts should also be present
    expect(data.stockAlerts).toBeDefined();
    expect(Array.isArray(data.stockAlerts)).toBe(true);
  });
});
