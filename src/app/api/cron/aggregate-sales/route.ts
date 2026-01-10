/**
 * Daily Sales Aggregation Cron Job
 * =================================
 * This API route aggregates daily sales data for the forecasting system.
 * 
 * Trigger Methods:
 * 1. Vercel Cron: Automatically via vercel.json config
 * 2. External Cron: curl -X POST https://your-domain/api/cron/aggregate-sales
 * 3. Manual: Visit the URL or call from admin panel
 * 
 * Security: Protected by CRON_SECRET environment variable
 */

import { NextRequest, NextResponse } from "next/server";
import { aggregateDailySales } from "@/lib/forecasting";
import { prisma } from "@/lib/prisma";

// Verify the request is from an authorized source
function isAuthorized(request: NextRequest): boolean {
  // Check for Vercel Cron header (automatically set by Vercel)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // If CRON_SECRET is set, require it
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }
  
  // In development, allow without auth
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  
  // Check for Vercel's internal cron header
  const vercelCron = request.headers.get("x-vercel-cron");
  if (vercelCron) {
    return true;
  }
  
  return false;
}

export async function GET(request: NextRequest) {
  return handleAggregation(request);
}

export async function POST(request: NextRequest) {
  return handleAggregation(request);
}

async function handleAggregation(request: NextRequest) {
  const startTime = Date.now();
  
  // Authorization check
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Missing or invalid CRON_SECRET" },
      { status: 401 }
    );
  }
  
  try {
    // Get optional date parameter (for backfilling specific dates)
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const daysBack = searchParams.get("days"); // Aggregate multiple days
    
    const results: { date: string; products: number }[] = [];
    
    if (daysBack) {
      // Backfill mode: aggregate multiple days
      const days = Math.min(parseInt(daysBack, 10) || 1, 90); // Max 90 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < days; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() - i);
        
        // Count products before aggregation
        const beforeCount = await prisma.dailySalesAggregate.count({
          where: { date: targetDate }
        });
        
        await aggregateDailySales(targetDate);
        
        // Count after
        const afterCount = await prisma.dailySalesAggregate.count({
          where: { date: targetDate }
        });
        
        results.push({
          date: targetDate.toISOString().split("T")[0],
          products: afterCount - beforeCount > 0 ? afterCount : afterCount
        });
      }
    } else {
      // Single day mode
      const targetDate = dateParam ? new Date(dateParam) : new Date();
      targetDate.setHours(0, 0, 0, 0);
      
      // For "today", we actually want yesterday's complete data
      if (!dateParam) {
        targetDate.setDate(targetDate.getDate() - 1);
      }
      
      await aggregateDailySales(targetDate);
      
      const count = await prisma.dailySalesAggregate.count({
        where: { date: targetDate }
      });
      
      results.push({
        date: targetDate.toISOString().split("T")[0],
        products: count
      });
    }
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      message: `Aggregated sales data for ${results.length} day(s)`,
      results,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("[Cron] Aggregation failed:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: "Aggregation failed",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
