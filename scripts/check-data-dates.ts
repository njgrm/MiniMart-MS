import { prisma } from '../src/lib/prisma';
import { getForecast, getAllProductForecasts } from '../src/lib/forecasting';

async function main() {
  console.log("=== Database Date Range Check ===\n");
  
  // Check daily sales aggregates
  const aggData = await prisma.dailySalesAggregate.aggregate({
    _min: { date: true },
    _max: { date: true },
    _count: true
  });
  
  console.log("DailySalesAggregate:");
  console.log("  Earliest:", aggData._min.date);
  console.log("  Latest:", aggData._max.date);
  console.log("  Total records:", aggData._count);
  
  // Check transactions
  const txnData = await prisma.transaction.aggregate({
    _min: { created_at: true },
    _max: { created_at: true },
    _count: true,
    where: { status: "COMPLETED" }
  });
  
  console.log("\nTransactions (COMPLETED):");
  console.log("  Earliest:", txnData._min.created_at);
  console.log("  Latest:", txnData._max.created_at);
  console.log("  Total records:", txnData._count);
  
  // Check if there's recent data in the expected forecast window
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  console.log("\n=== Forecast Window Check ===");
  console.log("Today:", today.toISOString().split("T")[0]);
  console.log("30 days ago:", thirtyDaysAgo.toISOString().split("T")[0]);
  
  const recentAgg = await prisma.dailySalesAggregate.count({
    where: {
      date: {
        gte: thirtyDaysAgo,
        lte: today
      }
    }
  });
  
  const recentTxn = await prisma.transaction.count({
    where: {
      status: "COMPLETED",
      created_at: {
        gte: thirtyDaysAgo,
        lte: today
      }
    }
  });
  
  console.log("Sales aggregates in last 30 days:", recentAgg);
  console.log("Transactions in last 30 days:", recentTxn);
  
  // Check for a specific product's recent transaction items
  console.log("\n=== Sample Product Check ===");
  const sampleProduct = await prisma.product.findFirst({
    where: { is_archived: false },
    select: { product_id: true, product_name: true, inventory: { select: { current_stock: true } } }
  });
  
  if (sampleProduct) {
    console.log("Product:", sampleProduct.product_name, "(ID:", sampleProduct.product_id, ")");
    console.log("Current Stock:", sampleProduct.inventory?.current_stock ?? 0);
    
    // Check transaction items for this product in the last 30 days
    const recentItems = await prisma.transactionItem.findMany({
      where: {
        product_id: sampleProduct.product_id,
        transaction: {
          status: "COMPLETED",
          created_at: {
            gte: thirtyDaysAgo,
            lte: today
          }
        }
      },
      include: {
        transaction: { select: { created_at: true } }
      },
      take: 10
    });
    
    console.log("Recent transaction items (last 30 days):", recentItems.length);
    if (recentItems.length > 0) {
      const totalQty = recentItems.reduce((sum, i) => sum + i.quantity, 0);
      console.log("  Total quantity sold:", totalQty);
      console.log("  Sample dates:", recentItems.slice(0, 3).map(i => i.transaction.created_at.toISOString().split("T")[0]).join(", "));
    }
    
    // Now test the actual forecasting function
    console.log("\n=== Forecasting Function Test ===");
    try {
      const forecast = await getForecast({ productId: sampleProduct.product_id });
      console.log("Forecast result:");
      console.log("  avgDailyVelocity:", forecast.avgDailyVelocity);
      console.log("  forecastedDailyUnits:", forecast.forecastedDailyUnits);
      console.log("  forecastedWeeklyUnits:", forecast.forecastedWeeklyUnits);
      console.log("  stockStatus:", forecast.stockStatus);
      console.log("  dataPoints:", forecast.dataPoints);
      console.log("  cleanDataPoints:", forecast.cleanDataPoints);
    } catch (error) {
      console.error("Forecast error:", error);
    }
  }
  
  await prisma.$disconnect();
}

main();
