-- AlterTable
ALTER TABLE "table_orders"
  ADD COLUMN "customer_name" TEXT,
  ADD COLUMN "customer_phone" TEXT;

-- AlterTable
ALTER TABLE "order_items"
  ADD COLUMN "round" INTEGER;
