import { superuserPrisma } from "./src/lib/prisma";

async function runReset() {
  console.log("Starting database reset transaction test...");
  try {
    await superuserPrisma.$transaction(async (tx: any) => {
      console.log("Deletions starting...");
      
      // 1. Transactional child elements first
      console.log("Deleting OrderItem...");
      await tx.orderItem.deleteMany();
      console.log("Deleting RecipeLine...");
      await tx.recipeLine.deleteMany();
      console.log("Deleting CreditPayment...");
      await tx.creditPayment.deleteMany();

      // 2. Ledger entries referencing orders/stays
      console.log("Deleting CreditLedger...");
      await tx.creditLedger.deleteMany();

      // 3. Transactions referencing raw items
      console.log("Deleting Purchase...");
      await tx.purchase.deleteMany();
      console.log("Deleting StockAdjustment...");
      await tx.stockAdjustment.deleteMany();

      // 4. Stays and orders
      console.log("Deleting TableOrder...");
      await tx.tableOrder.deleteMany();
      console.log("Deleting RoomStay...");
      await tx.roomStay.deleteMany();

      // 5. Recipe and Menu items
      console.log("Deleting Recipe...");
      await tx.recipe.deleteMany();
      console.log("Deleting MenuItem...");
      await tx.menuItem.deleteMany();
      console.log("Deleting MenuCategory...");
      await tx.menuCategory.deleteMany();

      // 6. Base configuration tables and Quick Sales
      console.log("Deleting RestaurantTable...");
      await tx.restaurantTable.deleteMany();
      console.log("Deleting Room...");
      await tx.room.deleteMany();
      console.log("Deleting QuickSale...");
      await tx.quickSale.deleteMany();
      console.log("Deleting RawItem...");
      await tx.rawItem.deleteMany();
      console.log("Deleting AuditLog...");
      await tx.auditLog.deleteMany();

      console.log("Transaction commands executed successfully!");
    });
    console.log("SUCCESS: Database cleared successfully.");
  } catch (error: any) {
    console.error("FAILURE: Database reset failed!");
    console.error(error);
  } finally {
    await superuserPrisma.$disconnect();
  }
}

runReset();
