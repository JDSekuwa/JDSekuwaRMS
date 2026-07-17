import { requireRole } from "@/services/auth.service";
import { superuserPrisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Strictly restrict database resets to SUPER_ADMIN
    await requireRole([Role.SUPER_ADMIN]);

    // Sequentially clean up the database tables using transaction
    await superuserPrisma.$transaction(async (tx) => {
      // 1. Menu and Recipe links
      await tx.recipeLine.deleteMany();
      await tx.recipe.deleteMany();
      await tx.menuItem.deleteMany();
      await tx.menuCategory.deleteMany();

      // 2. Tables and Orders
      await tx.orderItem.deleteMany();
      await tx.tableOrder.deleteMany();
      await tx.quickSale.deleteMany();
      await tx.restaurantTable.deleteMany();

      // 3. Rooms and Customer Credit
      await tx.creditPayment.deleteMany();
      await tx.creditLedger.deleteMany();
      await tx.roomStay.deleteMany();
      await tx.room.deleteMany();

      // 4. Inventory, Purchases, and Logs
      await tx.purchase.deleteMany();
      await tx.stockAdjustment.deleteMany();
      await tx.rawItem.deleteMany();
      await tx.auditLog.deleteMany();
    });

    return NextResponse.json({
      success: true,
      message: "Seeded business and transactional database tables cleared successfully."
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Failed to reset database." },
      { status }
    );
  }
}
