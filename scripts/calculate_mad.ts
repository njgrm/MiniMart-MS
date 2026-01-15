
import { prisma } from "../src/lib/prisma";
import { getForecast } from "../src/lib/forecasting";
import { subDays, addDays, format, startOfDay } from "date-fns";

async function calculateMAD() {
  console.log("Starting Retrospective MAD Calculation...");
  // 1. Get Top 5 Products by volume
  const topProducts = await prisma.product.findMany({
    take: 5,
    where: { status: 'ACTIVE' },
  });

  console.log(`Analyzing ${topProducts.length} products...`);
  
  const results = [];
  const validDates = [
    "2026-01-01", "2026-01-02", "2026-01-03", 
    "2026-01-04", "2026-01-05", "2026-01-06", "2026-01-07"
  ];

  let totalDeviation = 0;
  let count = 0;

  for (const product of topProducts) {
    console.log(`\nProduct: ${product.product_name} (ID: ${product.product_id})`);
    
    for (const dateStr of validDates) {
      const targetDate = new Date(dateStr);
      
      // 1. Generate Forecast for this date (using data UP TO yesterday)
      // Note: generateForecast returns 'forecastedDailyUnits'
      const forecast = await getForecast({
        productId: product.product_id,
        forecastDate: targetDate,
        lookbackDays: 30
      });

      // 2. Get ACTUAL sales for this date
      const actualRecord = await prisma.dailySalesAggregate.findUnique({
        where: {
          product_id_date: {
            product_id: product.product_id,
            date: targetDate
          }
        }
      });
      
      const actual = actualRecord ? actualRecord.quantity_sold : 0;
      const predicted = forecast.forecastedDailyUnits;
      
      const deviation = Math.abs(predicted - actual);
      
      console.log(`  Date: ${dateStr} | Pred: ${predicted.toFixed(2)} | Act: ${actual} | Diff: ${deviation.toFixed(2)}`);
      
      results.push({
        product: product.product_name,
        date: dateStr,
        predicted,
        actual,
        deviation
      });
      
      totalDeviation += deviation;
      count++;
    }
  }
  
  const mad = totalDeviation / count;
  console.log("\n===========================================");
  console.log(`Global MAD (Mean Absolute Deviation): ${mad.toFixed(4)}`);
  console.log(`Total Predictions: ${count}`);
  console.log("===========================================");
}

calculateMAD()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
