-- CreateTable
CREATE TABLE "store_settings" (
    "id" SERIAL NOT NULL,
    "gcash_qr_image_url" TEXT,
    "store_name" TEXT NOT NULL DEFAULT 'Christian Minimart',
    "store_address" TEXT,
    "store_contact" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);
