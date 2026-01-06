-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "auto_reorder" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lead_time_days" INTEGER NOT NULL DEFAULT 7;
