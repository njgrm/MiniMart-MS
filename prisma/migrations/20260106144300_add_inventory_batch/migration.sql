-- CreateTable
CREATE TABLE "inventory_batches" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "received_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier_ref" TEXT,
    "supplier_name" TEXT,
    "cost_price" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_batches_product_id_idx" ON "inventory_batches"("product_id");

-- CreateIndex
CREATE INDEX "inventory_batches_expiry_date_idx" ON "inventory_batches"("expiry_date");

-- CreateIndex
CREATE INDEX "inventory_batches_quantity_idx" ON "inventory_batches"("quantity");

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;
