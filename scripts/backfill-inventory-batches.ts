/**
 * Backfill Script: Create InventoryBatch for Products Missing Batches
 * 
 * This script fixes a historical bug where products were created with initial stock
 * but no InventoryBatch record. Without batches, `syncProductFromBatches()` would
 * reset stock to 0 on any batch operation.
 * 
 * What this script does:
 * 1. Finds all products where Inventory.current_stock > 0 but no InventoryBatch exists
 * 2. Creates a "Legacy Stock" batch with the current stock quantity
 * 3. Uses product.nearest_expiry_date or a far-future date for expiry
 * 
 * Run with: npx tsx scripts/backfill-inventory-batches.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function backfillInventoryBatches() {
  console.log("🔍 Scanning for products with stock but no batches...\n");

  // Find products with stock but no batches
  const productsWithoutBatches = await prisma.product.findMany({
    where: {
      inventory: {
        current_stock: { gt: 0 },
      },
    },
    include: {
      inventory: true,
      batches: {
        where: { quantity: { gt: 0 } },
      },
    },
  });

  // Filter to only products that have no batches
  const productsNeedingBackfill = productsWithoutBatches.filter(
    (p) => p.batches.length === 0 && p.inventory && p.inventory.current_stock > 0
  );

  if (productsNeedingBackfill.length === 0) {
    console.log("✅ No products need backfilling. All products with stock have batches.");
    return;
  }

  console.log(`⚠️  Found ${productsNeedingBackfill.length} products with stock but no batches:\n`);

  for (const product of productsNeedingBackfill) {
    console.log(`  - ${product.product_name}: ${product.inventory!.current_stock} units`);
  }

  console.log("\n📦 Creating legacy batches...\n");

  let created = 0;
  let failed = 0;

  for (const product of productsNeedingBackfill) {
    try {
      const inventory = product.inventory!;
      
      // Use product's nearest_expiry_date, or null if none set
      const expiryDate = product.nearest_expiry_date || null;

      await prisma.inventoryBatch.create({
        data: {
          product_id: product.product_id,
          quantity: inventory.current_stock,
          expiry_date: expiryDate,
          received_date: inventory.last_restock || new Date(),
          supplier_name: "Legacy Stock (Backfilled)",
          supplier_ref: `BACKFILL-${product.product_id}`,
          cost_price: product.cost_price,
        },
      });

      console.log(`  ✅ ${product.product_name}: Created batch with ${inventory.current_stock} units`);
      created++;
    } catch (error) {
      console.error(`  ❌ ${product.product_name}: Failed to create batch -`, error);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`📊 Backfill Complete:`);
  console.log(`   ✅ Created: ${created} batches`);
  console.log(`   ❌ Failed: ${failed} batches`);
  console.log("=".repeat(60));
}

async function main() {
  console.log("=".repeat(60));
  console.log("  Inventory Batch Backfill Script");
  console.log("  Fix: Products with stock but no FEFO batches");
  console.log("=".repeat(60) + "\n");

  try {
    await backfillInventoryBatches();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
