import "dotenv/config";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { superuserPrisma } from "../lib/prisma";
import { createTable, updateTable, deleteTable } from "./tables.service";
import { openTableOrder } from "./sales.service";
import { Role, TableStatus } from "../generated/prisma/client";
import { ForbiddenError } from "../lib/errors";

describe("Tables Administration Service Integration Tests", () => {
  let superAdminId: string;
  let workerId: string;
  let testTableId: string | null = null;

  beforeAll(async () => {
    // 1. Fetch test profiles
    const superAdmin = await superuserPrisma.profile.findFirst({
      where: { role: Role.SUPER_ADMIN }
    });
    const worker = await superuserPrisma.profile.findFirst({
      where: { role: Role.WORKER }
    });
    if (!superAdmin || !worker) {
      throw new Error("Seeded profiles not found in database. Run seeding scripts first.");
    }
    superAdminId = superAdmin.id;
    workerId = worker.id;
  });

  afterEach(async () => {
    // Clean up created tables
    if (testTableId) {
      // Delete any table orders if created during tests
      const orders = await superuserPrisma.tableOrder.findMany({
        where: { tableId: testTableId }
      });
      for (const order of orders) {
        await superuserPrisma.orderItem.deleteMany({ where: { tableOrderId: order.id } });
        await superuserPrisma.tableOrder.delete({ where: { id: order.id } });
      }

      await superuserPrisma.restaurantTable.delete({
        where: { id: testTableId }
      }).catch(() => {});
      testTableId = null;
    }
  });

  it("should successfully create a new table for SUPER_ADMIN", async () => {
    const table = await createTable(superAdminId, "Test Table 99", "http://example.com/image.jpg");
    expect(table).toBeDefined();
    expect(table.name).toBe("Test Table 99");
    expect(table.imageUrl).toBe("http://example.com/image.jpg");
    testTableId = table.id;
  });

  it("should block non-Admin roles from creating tables", async () => {
    await expect(
      createTable(workerId, "Attacker Table", null)
    ).rejects.toThrow(ForbiddenError);
  });

  it("should successfully update an existing table name and image for SUPER_ADMIN", async () => {
    const table = await createTable(superAdminId, "Test Table Update", null);
    testTableId = table.id;

    const updated = await updateTable(superAdminId, table.id, "Test Table Updated", "http://example.com/new.jpg");
    expect(updated).toBeDefined();
    expect(updated.name).toBe("Test Table Updated");
    expect(updated.imageUrl).toBe("http://example.com/new.jpg");
  });

  it("should block non-Admin roles from updating tables", async () => {
    const table = await createTable(superAdminId, "Test Table Restricted", null);
    testTableId = table.id;

    await expect(
      updateTable(workerId, table.id, "Hacked Table", null)
    ).rejects.toThrow(ForbiddenError);
  });

  it("should successfully delete a vacant table", async () => {
    const table = await createTable(superAdminId, "Test Table Delete", null);
    // Do not set testTableId to prevent afterEach cleanup error since we delete it here
    const res = await deleteTable(superAdminId, table.id);
    expect(res.success).toBe(true);
    expect(res.id).toBe(table.id);
  });

  it("should block deleting a table with an active/open order", async () => {
    const table = await createTable(superAdminId, "Test Table Block Delete", null);
    testTableId = table.id;

    // Create an open table order
    await openTableOrder(table.id, "Active session", superAdminId);

    // Attempting to delete should throw an error
    await expect(
      deleteTable(superAdminId, table.id)
    ).rejects.toThrow(/open order/i);
  });
});
