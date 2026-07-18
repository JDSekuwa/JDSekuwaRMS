import { prisma, superuserPrisma } from "../lib/prisma";
import { Role } from "../generated/prisma/client";
import { logAction } from "./audit.service";
import { ForbiddenError } from "../lib/errors";
import { getCachedProfile } from "./auth.service";

/**
 * Assures caller is an ADMIN or SUPER_ADMIN profile.
 */
async function requireAdmin(callerUserId: string) {
  const profile = await getCachedProfile(callerUserId);
  if (!profile || (profile.role !== Role.ADMIN && profile.role !== Role.SUPER_ADMIN)) {
    throw new ForbiddenError("Only Admins and Super Admins can manage the restaurant menu.");
  }
  return profile;
}

/**
 * Creates a new MenuItem.
 */
export async function createMenuItem(
  callerUserId: string,
  name: string,
  price: number,
  categoryId: string,
  imageUrl?: string | null
): Promise<any> {
  await requireAdmin(callerUserId);

  try {
    const item = await superuserPrisma.menuItem.create({
      data: {
        name,
        price,
        categoryId,
        imageUrl
      }
    });

    await logAction(
      callerUserId,
      "CREATE_MENU_ITEM",
      "MenuItem",
      item.id,
      { name, price, categoryId, imageUrl }
    );

    return item;
  } catch (error: any) {
    if (error.code === "P2002") {
      throw new Error(`A menu item named "${name}" already exists. Please choose a different name.`);
    }
    throw error;
  }
}

/**
 * Updates an existing MenuItem's fields.
 */
export async function updateMenuItem(
  callerUserId: string,
  menuItemId: string,
  name: string,
  price: number,
  categoryId: string,
  imageUrl?: string | null
): Promise<any> {
  await requireAdmin(callerUserId);

  const item = await superuserPrisma.menuItem.update({
    where: { id: menuItemId },
    data: {
      name,
      price,
      categoryId,
      imageUrl
    }
  });

  await logAction(
    callerUserId,
    "UPDATE_MENU_ITEM",
    "MenuItem",
    menuItemId,
    { name, price, categoryId, imageUrl }
  );

  return item;
}

/**
 * Safely deletes a MenuItem, catching relational constraints.
 */
export async function deleteMenuItem(
  callerUserId: string,
  menuItemId: string
): Promise<any> {
  await requireAdmin(callerUserId);

  try {
    const item = await superuserPrisma.menuItem.delete({
      where: { id: menuItemId }
    });

    await logAction(
      callerUserId,
      "DELETE_MENU_ITEM",
      "MenuItem",
      menuItemId,
      {}
    );

    return { success: true, id: item.id };
  } catch (error: any) {
    // Catch foreign key constraint check violation (Prisma error code P2003)
    if (error.code === "P2003" || error.message.includes("foreign key constraint")) {
      throw new Error("This menu item cannot be deleted because it is linked to past sales transaction records. You can rename it or adjust its price instead.");
    }
    throw error;
  }
}

/**
 * Creates a new MenuCategory.
 */
export async function createMenuCategory(
  callerUserId: string,
  name: string,
  isKitchen: boolean
): Promise<any> {
  await requireAdmin(callerUserId);

  try {
    const category = await superuserPrisma.menuCategory.create({
      data: {
        name,
        isKitchen
      }
    });

    await logAction(
      callerUserId,
      "CREATE_MENU_CATEGORY",
      "MenuCategory",
      category.id,
      { name, isKitchen }
    );

    return category;
  } catch (error: any) {
    if (error.code === "P2002") {
      throw new Error(`A category named "${name}" already exists. Please choose a different name.`);
    }
    throw error;
  }
}

/**
 * Deletes a MenuCategory safely.
 */
export async function deleteMenuCategory(
  callerUserId: string,
  categoryId: string
): Promise<any> {
  await requireAdmin(callerUserId);

  try {
    const category = await superuserPrisma.menuCategory.delete({
      where: { id: categoryId }
    });

    await logAction(
      callerUserId,
      "DELETE_MENU_CATEGORY",
      "MenuCategory",
      categoryId,
      {}
    );

    return { success: true, id: category.id };
  } catch (error: any) {
    // Catch foreign key constraint check violation
    if (error.code === "P2003" || error.message.includes("foreign key constraint")) {
      throw new Error("This category cannot be deleted because it contains active menu products. Please delete or reassign those products first.");
    }
    throw error;
  }
}
