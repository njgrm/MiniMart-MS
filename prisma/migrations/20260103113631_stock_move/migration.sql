-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('INITIAL_STOCK', 'RESTOCK', 'SALE', 'ADJUSTMENT', 'DAMAGE', 'RETURN', 'INTERNAL_USE', 'ORDER_SHORTAGE');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('STORE_DISCOUNT', 'MANUFACTURER_CAMPAIGN', 'HOLIDAY');

-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "allocated_stock" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" SERIAL NOT NULL,
    "inventory_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "quantity_change" INTEGER NOT NULL,
    "previous_stock" INTEGER NOT NULL,
    "new_stock" INTEGER NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "supplier_name" TEXT,
    "cost_price" DECIMAL(10,2),
    "receipt_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" "EventSource" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "multiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "affected_brand" TEXT,
    "affected_category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_log_products" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,

    CONSTRAINT "event_log_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_sales_aggregates" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "quantity_sold" INTEGER NOT NULL,
    "revenue" DECIMAL(12,2) NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "profit" DECIMAL(12,2) NOT NULL,
    "transaction_count" INTEGER NOT NULL DEFAULT 1,
    "is_event_day" BOOLEAN NOT NULL DEFAULT false,
    "event_source" "EventSource",
    "event_id" INTEGER,

    CONSTRAINT "daily_sales_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_inventory_id_idx" ON "stock_movements"("inventory_id");

-- CreateIndex
CREATE INDEX "stock_movements_user_id_idx" ON "stock_movements"("user_id");

-- CreateIndex
CREATE INDEX "stock_movements_movement_type_idx" ON "stock_movements"("movement_type");

-- CreateIndex
CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements"("created_at");

-- CreateIndex
CREATE INDEX "event_logs_start_date_end_date_idx" ON "event_logs"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "event_logs_source_idx" ON "event_logs"("source");

-- CreateIndex
CREATE INDEX "event_logs_affected_brand_idx" ON "event_logs"("affected_brand");

-- CreateIndex
CREATE UNIQUE INDEX "event_log_products_event_id_product_id_key" ON "event_log_products"("event_id", "product_id");

-- CreateIndex
CREATE INDEX "daily_sales_aggregates_product_id_idx" ON "daily_sales_aggregates"("product_id");

-- CreateIndex
CREATE INDEX "daily_sales_aggregates_date_idx" ON "daily_sales_aggregates"("date");

-- CreateIndex
CREATE INDEX "daily_sales_aggregates_is_event_day_idx" ON "daily_sales_aggregates"("is_event_day");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sales_aggregates_product_id_date_key" ON "daily_sales_aggregates"("product_id", "date");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventory"("inventory_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_log_products" ADD CONSTRAINT "event_log_products_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_log_products" ADD CONSTRAINT "event_log_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;
