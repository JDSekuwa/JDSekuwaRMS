import "dotenv/config";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { superuserPrisma } from "../lib/prisma";
import { Role, TableStatus } from "../generated/prisma/client";
import { ForbiddenError } from "../lib/errors";
import {
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  createMenuCategory,
  deleteMenuCategory
} from "./menu.service";

describe("Menu Configuration Service Integration Tests", () => {
  let superAdminId: string;
  let workerId: string;
  let categoryId: string;
  let createdMenuItemId: string | null = null;
  let createdCategoryId: string | null = null;

  beforeAll(async () => {
    // 1. Retrieve seeded profiles
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

    // 2. Retrieve a seeded category
    const category = await superuserPrisma.menuCategory.findFirst();
    if (!category) {
      throw new Error("No categories found in database. Run seed.ts first.");
    }
    categoryId = category.id;
  });

  afterEach(async () => {
    // Cleanup menu item created during tests
    if (createdMenuItemId) {
      await superuserPrisma.menuItem.deleteMany({
        where: { id: createdMenuItemId }
      });
      createdMenuItemId = null;
    }
    // Cleanup category created during tests
    if (createdCategoryId) {
      await superuserPrisma.menuCategory.deleteMany({
        where: { id: createdCategoryId }
      });
      createdCategoryId = null;
    }
  });

  it("should successfully create a MenuItem for SUPER_ADMIN with image", async () => {
    const name = "Test Chicken Momos";
    const price = 250;
    const imageUrl = "/uploads/test-momo.png";

    const res = await createMenuItem(superAdminId, name, price, categoryId, imageUrl);
    expect(res).toBeDefined();
    expect(res.name).toBe(name);
    expect(Number(res.price)).toBe(price);
    expect(res.categoryId).toBe(categoryId);
    expect(res.imageUrl).toBe(imageUrl);

    createdMenuItemId = res.id;
  });

  it("should block non-Admin roles from creating menu items", async () => {
    await expect(
      createMenuItem(workerId, "Forbidden Momo", 150, categoryId)
    ).rejects.toThrow(ForbiddenError);
  });

  it("should successfully update MenuItem details and image", async () => {
    const res = await createMenuItem(superAdminId, "Temp Momo", 180, categoryId);
    createdMenuItemId = res.id;

    const updatedName = "Updated Veg Momos";
    const updatedPrice = 220;
    const updatedImage = "/uploads/updated.png";

    const updated = await updateMenuItem(superAdminId, res.id, updatedName, updatedPrice, categoryId, updatedImage);
    expect(updated.name).toBe(updatedName);
    expect(Number(updated.price)).toBe(updatedPrice);
    expect(updated.imageUrl).toBe(updatedImage);
  });

  it("should block non-Admin roles from updating menu items", async () => {
    const res = await createMenuItem(superAdminId, "Attacker Momo", 180, categoryId);
    createdMenuItemId = res.id;

    await expect(
      updateMenuItem(workerId, res.id, "Hacked Name", 999, categoryId)
    ).rejects.toThrow(ForbiddenError);
  });

  it("should successfully delete a MenuItem", async () => {
    const res = await createMenuItem(superAdminId, "Delete Momo", 120, categoryId);
    
    const del = await deleteMenuItem(superAdminId, res.id);
    expect(del.success).toBe(true);
    expect(del.id).toBe(res.id);

    const item = await superuserPrisma.menuItem.findUnique({
      where: { id: res.id }
    });
    expect(item).toBeNull();
  });

  it("should throw a user-friendly error when deleting a MenuItem with sales history", async () => {
    const res = await createMenuItem(superAdminId, "Historical Momo", 300, categoryId);
    createdMenuItemId = res.id;

    const table = await superuserPrisma.restaurantTable.findFirst({
      where: { status: TableStatus.VACANT }
    });
    if (!table) {
      throw new Error("No vacant tables found for testing constraint.");
    }

    const order = await superuserPrisma.tableOrder.create({
      data: {
        tableId: table.id,
        status: "OPEN",
        openedById: superAdminId,
        version: 1
      }
    });

    const orderItem = await superuserPrisma.orderItem.create({
      data: {
        tableOrderId: order.id,
        menuItemId: res.id,
        qty: 1,
        unitPrice: 300
      }
    });

    await expect(
      deleteMenuItem(superAdminId, res.id)
    ).rejects.toThrow(/linked to past sales/);

    await superuserPrisma.orderItem.delete({ where: { id: orderItem.id } });
    await superuserPrisma.tableOrder.delete({ where: { id: order.id } });
  });

  it("should successfully create and delete a MenuCategory for SUPER_ADMIN", async () => {
    const catName = "Test Custom Desserts";
    const isKitchen = false;

    // Create Category
    const category = await createMenuCategory(superAdminId, catName, isKitchen);
    expect(category).toBeDefined();
    expect(category.name).toBe(catName);
    expect(category.isKitchen).toBe(isKitchen);

    createdCategoryId = category.id;

    // Delete Category
    const del = await deleteMenuCategory(superAdminId, category.id);
    expect(del.success).toBe(true);
    expect(del.id).toBe(category.id);

    createdCategoryId = null; // Cleared
  });

  it("should cascade delete menu items when category is deleted", async () => {
    // 1. Create a category
    const cat = await createMenuCategory(superAdminId, "Temp Cascade Cat", true);
    createdCategoryId = cat.id;

    // 2. Create MenuItem in this category
    const item = await createMenuItem(superAdminId, "Category Cascade Item", 150, cat.id);

    // 3. Delete the category
    await deleteMenuCategory(superAdminId, cat.id);
    createdCategoryId = null;

    // 4. Verify the menu item was also cascade deleted
    const foundItem = await superuserPrisma.menuItem.findUnique({
      where: { id: item.id }
    });
    expect(foundItem).toBeNull();
  });
});
