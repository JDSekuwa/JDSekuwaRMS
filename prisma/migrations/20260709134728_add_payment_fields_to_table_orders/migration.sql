-- AlterTable
ALTER TABLE "table_orders" ADD COLUMN     "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "payment_type" "PaymentType",
ADD COLUMN     "subtotal" DECIMAL(10,2),
ADD COLUMN     "total" DECIMAL(10,2);
