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
      // 1. Transactional child elements first
      await tx.orderItem.deleteMany();
      await tx.recipeLine.deleteMany();
      await tx.creditPayment.deleteMany();

      // 2. Ledger entries referencing orders/stays
      await tx.creditLedger.deleteMany();

      // 3. Transactions referencing raw items
      await tx.purchase.deleteMany();
      await tx.stockAdjustment.deleteMany();

      // 4. Stays and orders
      await tx.tableOrder.deleteMany();
      await tx.roomStay.deleteMany();

      // 5. Recipe and Menu items
      await tx.recipe.deleteMany();
      await tx.menuItem.deleteMany();
      await tx.menuCategory.deleteMany();

      // 6. Base configuration tables and Quick Sales
      await tx.restaurantTable.deleteMany();
      await tx.room.deleteMany();
      await tx.quickSale.deleteMany();
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
