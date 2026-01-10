/**
 * Backfill Daily Sales Aggregates
 * ================================
 * This script populates the daily_sales_aggregates table from historical
 * transaction data. Run this once to enable the forecasting system.
 * 
 * Usage: npx tsx scripts/backfill-aggregates.ts
 */

import { prisma } from '../src/lib/prisma';
import { aggregateDailySales } from '../src/lib/forecasting';

async function main() {
  console.log("=== Backfilling Daily Sales Aggregates ===\n");
  
  // Get the date range of transactions
  const txnRange = await prisma.transaction.aggregate({
    _min: { created_at: true },
    _max: { created_at: true },
    where: { status: "COMPLETED" }
  });
  
  if (!txnRange._min.created_at || !txnRange._max.created_at) {
    console.log("No completed transactions found!");
    return;
  }
  
  console.log("Transaction date range:");
  console.log("  From:", txnRange._min.created_at.toISOString().split("T")[0]);
  console.log("  To:", txnRange._max.created_at.toISOString().split("T")[0]);
  
  // Backfill the last 90 days (or from earliest transaction if newer)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const startDate = txnRange._min.created_at > ninetyDaysAgo 
    ? new Date(txnRange._min.created_at)
    : ninetyDaysAgo;
  
  const endDate = txnRange._max.created_at < today
    ? new Date(txnRange._max.created_at)
    : today;
  
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  
  // Count days
  const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  console.log(`\nBackfilling ${dayCount} days of data...`);
  console.log("  From:", startDate.toISOString().split("T")[0]);
  console.log("  To:", endDate.toISOString().split("T")[0]);
  console.log("");
  
  let processed = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    await aggregateDailySales(new Date(currentDate));
    processed++;
    
    // Progress indicator
    if (processed % 10 === 0 || processed === dayCount) {
      const pct = Math.round((processed / dayCount) * 100);
      process.stdout.write(`\rProgress: ${processed}/${dayCount} days (${pct}%)`);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log("\n\n✅ Backfill complete!");
  
  // Verify
  const aggCount = await prisma.dailySalesAggregate.count();
  const aggRange = await prisma.dailySalesAggregate.aggregate({
    _min: { date: true },
    _max: { date: true }
  });
  
  console.log("\nAggregates table now has:");
  console.log(`  ${aggCount.toLocaleString()} records`);
  console.log(`  From: ${aggRange._min.date?.toISOString().split("T")[0]}`);
  console.log(`  To: ${aggRange._max.date?.toISOString().split("T")[0]}`);
  
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
