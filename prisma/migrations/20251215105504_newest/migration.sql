/*
  Warnings:

  - You are about to alter the column `price_at_sale` on the `transaction_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `subtotal` on the `transaction_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "products" ADD COLUMN     "cost_price" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "transaction_items" ADD COLUMN     "cost_at_sale" DECIMAL(10,2) NOT NULL DEFAULT 0,
ALTER COLUMN "price_at_sale" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(10,2);
