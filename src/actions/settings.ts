"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Store Settings Server Actions
 * 
 * These actions manage store-wide settings like the GCash QR code.
 * The StoreSettings table is designed as a singleton (single row).
 */

export interface StoreSettings {
  id: number;
  gcash_qr_image_url: string | null;
  store_name: string;
  store_address: string | null;
  store_contact: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Get store settings.
 * If no settings exist, create a default entry and return it.
 */
export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    // Try to find existing settings
    let settings = await prisma.storeSettings.findFirst();
    
    // If none exists, create default settings
    if (!settings) {
      settings = await prisma.storeSettings.create({
        data: {
          store_name: "Christian Minimart",
        },
      });
    }
    
    return settings;
  } catch (error) {
    console.error("[settings] Error fetching store settings:", error);
    throw new Error("Failed to fetch store settings");
  }
}

/**
 * Update the GCash QR code image URL.
 * @param url - The new URL/path for the GCash QR code image
 */
export async function updateGcashQr(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get or create settings first
    let settings = await prisma.storeSettings.findFirst();
    
    if (!settings) {
      // Create with the QR code
      await prisma.storeSettings.create({
        data: {
          store_name: "Christian Minimart",
          gcash_qr_image_url: url,
        },
      });
    } else {
      // Update existing settings
      await prisma.storeSettings.update({
        where: { id: settings.id },
        data: { gcash_qr_image_url: url },
      });
    }
    
    // Revalidate paths that might display this data
    revalidatePath("/admin/pos");
    revalidatePath("/admin/settings");
    
    return { success: true };
  } catch (error) {
    console.error("[settings] Error updating GCash QR:", error);
    return { success: false, error: "Failed to update GCash QR code" };
  }
}

/**
 * Update store information.
 * @param data - Partial store settings to update
 */
export async function updateStoreInfo(data: {
  store_name?: string;
  store_address?: string;
  store_contact?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    let settings = await prisma.storeSettings.findFirst();
    
    if (!settings) {
      await prisma.storeSettings.create({
        data: {
          store_name: data.store_name ?? "Christian Minimart",
          store_address: data.store_address,
          store_contact: data.store_contact,
        },
      });
    } else {
      await prisma.storeSettings.update({
        where: { id: settings.id },
        data,
      });
    }
    
    revalidatePath("/admin/settings");
    
    return { success: true };
  } catch (error) {
    console.error("[settings] Error updating store info:", error);
    return { success: false, error: "Failed to update store information" };
  }
}

// =============================================================================
// Data Maintenance Actions
// =============================================================================

import { aggregateDailySales } from "@/lib/forecasting";

/**
 * Manually trigger sales data aggregation.
 * This is useful for backfilling data or forcing a refresh.
 * 
 * @param daysBack - Number of days to aggregate (default: 1, max: 90)
 */
export async function triggerSalesAggregation(daysBack: number = 1): Promise<{
  success: boolean;
  message: string;
  results?: { date: string; products: number }[];
  error?: string;
}> {
  try {
    const days = Math.min(Math.max(daysBack, 1), 90); // Clamp between 1-90
    const results: { date: string; products: number }[] = [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 1; i <= days; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - i);
      
      await aggregateDailySales(targetDate);
      
      const count = await prisma.dailySalesAggregate.count({
        where: { date: targetDate }
      });
      
      results.push({
        date: targetDate.toISOString().split("T")[0],
        products: count
      });
    }
    
    // Revalidate analytics pages
    revalidatePath("/admin/analytics");
    revalidatePath("/dashboard");
    
    return {
      success: true,
      message: `Successfully aggregated ${days} day(s) of sales data`,
      results
    };
  } catch (error) {
    console.error("[settings] Error triggering aggregation:", error);
    return {
      success: false,
      message: "Failed to aggregate sales data",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Get the status of sales aggregation data.
 */
export async function getAggregationStatus(): Promise<{
  totalRecords: number;
  earliestDate: string | null;
  latestDate: string | null;
  daysCovered: number;
  lastUpdated: string | null;
}> {
  try {
    const [count, range] = await Promise.all([
      prisma.dailySalesAggregate.count(),
      prisma.dailySalesAggregate.aggregate({
        _min: { date: true },
        _max: { date: true }
      })
    ]);
    
    const earliest = range._min.date;
    const latest = range._max.date;
    
    let daysCovered = 0;
    if (earliest && latest) {
      daysCovered = Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    
    return {
      totalRecords: count,
      earliestDate: earliest?.toISOString().split("T")[0] ?? null,
      latestDate: latest?.toISOString().split("T")[0] ?? null,
      daysCovered,
      lastUpdated: latest?.toISOString() ?? null
    };
  } catch (error) {
    console.error("[settings] Error getting aggregation status:", error);
    return {
      totalRecords: 0,
      earliestDate: null,
      latestDate: null,
      daysCovered: 0,
      lastUpdated: null
    };
  }
}

/**
 * Full backfill of DailySalesAggregate from transaction history.
 * This processes all completed transactions and populates the aggregate table.
 * Automatically called after CSV import for analytics accuracy.
 * 
 * @returns Progress info about the backfill operation
 */
export async function backfillSalesAggregates(): Promise<{
  success: boolean;
  message: string;
  daysProcessed: number;
  recordsCreated: number;
  error?: string;
}> {
  try {
    // Get the date range of transactions
    const txnRange = await prisma.transaction.aggregate({
      _min: { created_at: true },
      _max: { created_at: true },
      where: { status: "COMPLETED" }
    });
    
    if (!txnRange._min.created_at || !txnRange._max.created_at) {
      return {
        success: true,
        message: "No completed transactions found to aggregate",
        daysProcessed: 0,
        recordsCreated: 0
      };
    }
    
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
    
    // Count days to process
    const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    let daysProcessed = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      await aggregateDailySales(new Date(currentDate));
      daysProcessed++;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Get final count
    const recordsCreated = await prisma.dailySalesAggregate.count();
    
    // Revalidate analytics pages
    revalidatePath("/admin/analytics");
    revalidatePath("/dashboard");
    
    return {
      success: true,
      message: `Successfully processed ${daysProcessed} days of sales data`,
      daysProcessed,
      recordsCreated
    };
  } catch (error) {
    console.error("[settings] Error backfilling aggregates:", error);
    return {
      success: false,
      message: "Failed to backfill sales aggregates",
      daysProcessed: 0,
      recordsCreated: 0,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

































