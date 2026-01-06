-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "module" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_module_idx" ON "audit_logs"("module");
