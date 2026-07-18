import { superuserPrisma } from "../lib/prisma";
import { Role } from "../generated/prisma/client";
import { logAction } from "./audit.service";
import { ForbiddenError } from "../lib/errors";
import { getCachedProfile } from "./auth.service";

async function requireAdmin(callerUserId: string) {
  const profile = await getCachedProfile(callerUserId);
  if (!profile || (profile.role !== Role.ADMIN && profile.role !== Role.SUPER_ADMIN)) {
    throw new ForbiddenError("Only Admins and Super Admins can manage floor tables.");
  }
  return profile;
}

/**
 * Creates a new RestaurantTable.
 */
export async function createTable(
  callerUserId: string,
  name: string,
  imageUrl?: string | null
): Promise<any> {
  await requireAdmin(callerUserId);

  try {
    const table = await superuserPrisma.restaurantTable.create({
      data: { name, imageUrl }
    });

    await logAction(callerUserId, "CREATE_TABLE", "RestaurantTable", table.id, { name, imageUrl });
    return table;
  } catch (error: any) {
    if (error.code === "P2002") {
      throw new Error(`A table named "${name}" already exists. Please choose a different name.`);
    }
    throw error;
  }
}

/**
 * Updates an existing RestaurantTable name and/or image.
 */
export async function updateTable(
  callerUserId: string,
  tableId: string,
  name: string,
  imageUrl?: string | null
): Promise<any> {
  await requireAdmin(callerUserId);

  const table = await superuserPrisma.restaurantTable.update({
    where: { id: tableId },
    data: { name, imageUrl }
  });

  await logAction(callerUserId, "UPDATE_TABLE", "RestaurantTable", tableId, { name, imageUrl });
  return table;
}

/**
 * Deletes a RestaurantTable. Blocked if it has any linked TableOrder history.
 */
export async function deleteTable(
  callerUserId: string,
  tableId: string
): Promise<any> {
  await requireAdmin(callerUserId);

  // Block deletion if table currently has an OPEN order
  const openOrder = await superuserPrisma.tableOrder.findFirst({
    where: { tableId, status: "OPEN" }
  });
  if (openOrder) {
    throw new Error("This table currently has an open order. Close the bill before deleting.");
  }

  try {
    const table = await superuserPrisma.restaurantTable.delete({
      where: { id: tableId }
    });
    await logAction(callerUserId, "DELETE_TABLE", "RestaurantTable", tableId, {});
    return { success: true, id: table.id };
  } catch (error: any) {
    if (error.code === "P2003" || error.message?.includes("foreign key constraint")) {
      throw new Error(
        "This table cannot be deleted because it has past sales transaction records. You can rename it instead."
      );
    }
    throw error;
  }
}
