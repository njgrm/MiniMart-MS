"use server";

import { prisma } from "@/lib/prisma";
import { 
  getAllProductForecasts, 
  getReorderAlerts,
  type ForecastResult 
} from "@/lib/forecasting";
import { 
  generateBusinessInsights, 
  getDefaultInsight,
  type Insight, 
  type VelocityData 
} from "@/lib/insights";
import { subDays, format, startOfDay, endOfDay, eachDayOfInterval, startOfMonth, subMonths } from "date-fns";

// =============================================================================
// Types
// =============================================================================

export interface AnalyticsData {
  summary: {
    forecastedRevenue: number;
    topTrendingProduct: {
      name: string;
      velocity: number;
      trend: string;
    } | null;
    restockAlertCount: number;
  };
  chartData: ChartDataPoint[];
  forecasts: ForecastTableItem[];
  reorderAlerts: ForecastResult[];
}

export interface ChartDataPoint {
  date: string;
  sales: number;
  forecast: number;
  isEventDay: boolean;
  eventName?: string;
}

export interface ForecastTableItem {
  productId: number;
  productName: string;
  barcode: string | null;
  category: string;
  currentStock: number;
  velocity7Day: number;
  predictedDemand: number;
  recommendedAction: string;
  recommendedQty: number;
  stockStatus: string;
  confidence: string;
  costPrice: number; // Supply cost for budgeting
}

// =============================================================================
// Data Fetching
// =============================================================================

export async function getAnalyticsData(): Promise<AnalyticsData> {
  try {
    // Get all product forecasts
    const forecasts = await getAllProductForecasts();
    const reorderAlerts = await getReorderAlerts();
    
    // Calculate forecasted revenue for next 7 days
    const forecastedRevenue = forecasts.reduce((sum, f) => {
      // Assume average price of ₱50 per unit (would need to join with product table for accurate data)
      return sum + (f.forecastedWeeklyUnits * 50);
    }, 0);
    
    // Find top trending product
    const topTrending = forecasts
      .filter(f => f.velocityTrend === "INCREASING")
      .sort((a, b) => b.avgDailyVelocity - a.avgDailyVelocity)[0];
    
    // Get historical sales data for chart (last 30 days)
    const chartData = await getChartData();
    
    // Transform forecasts to table format - show ALL products (healthy, low, critical, dead)
    // UI filtering will handle visibility based on urgency selection
    const forecastTable: ForecastTableItem[] = forecasts
      .sort((a, b) => {
        // Priority: CRITICAL > LOW > DEAD_STOCK > HEALTHY
        const statusPriority: Record<string, number> = {
          "OUT_OF_STOCK": 0,
          "CRITICAL": 1,
          "LOW": 2,
          "DEAD_STOCK": 3,
          "HEALTHY": 4,
        };
        const aPriority = statusPriority[a.stockStatus] ?? 5;
        const bPriority = statusPriority[b.stockStatus] ?? 5;
        if (aPriority !== bPriority) return aPriority - bPriority;
        // Secondary sort by reorder qty (descending)
        return b.suggestedReorderQty - a.suggestedReorderQty;
      })
      .map(f => ({
        productId: f.productId,
        productName: f.productName,
        barcode: f.barcode,
        category: f.category,
        currentStock: f.currentStock,
        velocity7Day: Math.round(f.avgDailyVelocity * 7),
        predictedDemand: f.forecastedWeeklyUnits,
        recommendedAction: getRecommendedAction(f),
        recommendedQty: f.suggestedReorderQty,
        stockStatus: f.stockStatus,
        confidence: f.confidence,
        costPrice: f.costPrice,
      }));
    
    return {
      summary: {
        forecastedRevenue,
        topTrendingProduct: topTrending ? {
          name: topTrending.productName,
          velocity: topTrending.avgDailyVelocity,
          trend: topTrending.velocityTrend,
        } : null,
        restockAlertCount: reorderAlerts.length,
      },
      chartData,
      forecasts: forecastTable,
      reorderAlerts,
    };
  } catch (error) {
    console.error("[Analytics] Error fetching data:", error);
    // Return empty data on error
    return {
      summary: {
        forecastedRevenue: 0,
        topTrendingProduct: null,
        restockAlertCount: 0,
      },
      chartData: [],
      forecasts: [],
      reorderAlerts: [],
    };
  }
}

async function getChartData(): Promise<ChartDataPoint[]> {
  const endDate = new Date();
  const startDate = subDays(endDate, 30);
  
  // Try to get from aggregated table first
  const aggregates = await prisma.dailySalesAggregate.groupBy({
    by: ["date", "is_event_day"],
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      revenue: true,
      quantity_sold: true,
    },
  });
  
  if (aggregates.length > 0) {
    // Use aggregated data
    const dataMap = new Map<string, ChartDataPoint>();
    
    for (const agg of aggregates) {
      const dateKey = format(agg.date, "yyyy-MM-dd");
      const existing = dataMap.get(dateKey);
      const revenue = agg._sum.revenue?.toNumber() ?? 0;
      
      if (existing) {
        existing.sales += revenue;
        existing.isEventDay = existing.isEventDay || agg.is_event_day;
      } else {
        dataMap.set(dateKey, {
          date: dateKey,
          sales: revenue,
          forecast: revenue * 1.1, // Simple projection
          isEventDay: agg.is_event_day,
        });
      }
    }
    
    return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }
  
  // Fallback: Calculate from transactions
  const transactions = await prisma.transaction.findMany({
    where: {
      created_at: {
        gte: startDate,
        lte: endDate,
      },
      status: "COMPLETED",
    },
    select: {
      created_at: true,
      total_amount: true,
    },
  });
  
  // Get active events for the period
  const events = await prisma.eventLog.findMany({
    where: {
      start_date: { lte: endDate },
      end_date: { gte: startDate },
      is_active: true,
    },
  });
  
  // Group by date
  const dataMap = new Map<string, ChartDataPoint>();
  
  for (const txn of transactions) {
    const dateKey = format(txn.created_at, "yyyy-MM-dd");
    const txnDate = startOfDay(txn.created_at);
    
    // Check if this date has an event
    const activeEvent = events.find(e => 
      e.start_date <= txnDate && e.end_date >= txnDate
    );
    
    const existing = dataMap.get(dateKey);
    const amount = txn.total_amount.toNumber();
    
    if (existing) {
      existing.sales += amount;
    } else {
      dataMap.set(dateKey, {
        date: dateKey,
        sales: amount,
        forecast: 0, // Will calculate after
        isEventDay: !!activeEvent,
        eventName: activeEvent?.name,
      });
    }
  }
  
  // Calculate rolling average forecast
  const sortedData = Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  
  for (let i = 0; i < sortedData.length; i++) {
    if (i < 7) {
      // Not enough data for forecast
      sortedData[i].forecast = sortedData[i].sales;
    } else {
      // 7-day rolling average
      const prev7 = sortedData.slice(i - 7, i);
      const avg = prev7.reduce((sum, d) => sum + d.sales, 0) / 7;
      sortedData[i].forecast = Math.round(avg);
    }
  }
  
  return sortedData;
}

// =============================================================================
// Date Range Queries for Analytics Dashboard
// =============================================================================

export interface DashboardChartDataPoint {
  date: string;
  fullDate: string;
  revenue: number;
  cost: number;
  profit: number;
}

/**
 * Get dashboard chart data for a custom date range WITH revenue/cost/profit
 * This queries ALL transactions and calculates actual profit from transaction items
 */
export async function getDashboardChartDataByDateRange(
  startDate: Date, 
  endDate: Date
): Promise<DashboardChartDataPoint[]> {
  try {
    const rangeStart = startOfDay(startDate);
    const rangeEnd = endOfDay(endDate);
    
    // Get transactions for the date range WITH items for cost calculation
    const transactions = await prisma.transaction.findMany({
      where: {
        created_at: {
          gte: rangeStart,
          lte: rangeEnd,
        },
        status: "COMPLETED",
      },
      select: {
        created_at: true,
        total_amount: true,
        items: {
          select: {
            price_at_sale: true,
            cost_at_sale: true,
            quantity: true,
          },
        },
      },
    });
    
    // Create a map for all days in the range
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    const dataMap = new Map<string, DashboardChartDataPoint>();
    
    // Initialize all days with zero values
    days.forEach(day => {
      const dateKey = format(day, "yyyy-MM-dd");
      dataMap.set(dateKey, {
        date: dateKey,
        fullDate: format(day, "EEE, MMM d, yyyy"),
        revenue: 0,
        cost: 0,
        profit: 0,
      });
    });
    
    // Aggregate transactions by day with actual cost/profit
    for (const txn of transactions) {
      const dateKey = format(txn.created_at, "yyyy-MM-dd");
      const existing = dataMap.get(dateKey);
      
      if (existing) {
        // Calculate revenue and cost from transaction items
        let txRevenue = 0;
        let txCost = 0;
        
        for (const item of txn.items) {
          txRevenue += Number(item.price_at_sale) * item.quantity;
          txCost += Number(item.cost_at_sale) * item.quantity;
        }
        
        existing.revenue += txRevenue;
        existing.cost += txCost;
        existing.profit += (txRevenue - txCost);
      }
    }
    
    // Format date labels based on range length
    const diffDays = days.length;
    const sortedData = Array.from(dataMap.values())
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // For year view (>60 days), aggregate by month
    if (diffDays > 60) {
      const monthlyMap = new Map<string, DashboardChartDataPoint>();
      
      for (const point of sortedData) {
        const date = new Date(point.date);
        const monthKey = format(date, "yyyy-MM");
        const monthLabel = format(date, "MMM");
        
        const existing = monthlyMap.get(monthKey);
        if (existing) {
          existing.revenue += point.revenue;
          existing.cost += point.cost;
          existing.profit += point.profit;
        } else {
          monthlyMap.set(monthKey, {
            date: monthLabel,
            fullDate: format(date, "MMMM yyyy"),
            revenue: point.revenue,
            cost: point.cost,
            profit: point.profit,
          });
        }
      }
      
      return Array.from(monthlyMap.values());
    }
    
    // For shorter ranges, show individual days
    const result = sortedData.map(point => {
      const date = new Date(point.date);
      const dateLabel = diffDays > 14 
        ? format(date, "d") 
        : format(date, "MMM d");
      
      return {
        ...point,
        date: dateLabel,
      };
    });
    
    return result;
  } catch (error) {
    console.error("[Analytics] Error fetching dashboard chart data:", error);
    return [];
  }
}

/**
 * Get chart data for a custom date range
 * This is used by the analytics dashboard to fetch data based on selected dates
 */
export async function getChartDataByDateRange(startDate: Date, endDate: Date): Promise<ChartDataPoint[]> {
  try {
    const rangeStart = startOfDay(startDate);
    const rangeEnd = endOfDay(endDate);
    
    // Get transactions for the date range
    const transactions = await prisma.transaction.findMany({
      where: {
        created_at: {
          gte: rangeStart,
          lte: rangeEnd,
        },
        status: "COMPLETED",
      },
      select: {
        created_at: true,
        total_amount: true,
        items: {
          select: {
            price_at_sale: true,
            cost_at_sale: true,
            quantity: true,
          },
        },
      },
    });
    
    // Get active events for the period
    const events = await prisma.eventLog.findMany({
      where: {
        start_date: { lte: rangeEnd },
        end_date: { gte: rangeStart },
        is_active: true,
      },
    });
    
    // Create a map for all days in the range
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    const dataMap = new Map<string, ChartDataPoint>();
    
    // Initialize all days with zero values
    days.forEach(day => {
      const dateKey = format(day, "yyyy-MM-dd");
      
      // Check if this date has an event
      const activeEvent = events.find(e => 
        startOfDay(e.start_date) <= day && endOfDay(e.end_date) >= day
      );
      
      dataMap.set(dateKey, {
        date: dateKey,
        sales: 0,
        forecast: 0,
        isEventDay: !!activeEvent,
        eventName: activeEvent?.name,
      });
    });
    
    // Aggregate transactions by day
    for (const txn of transactions) {
      const dateKey = format(txn.created_at, "yyyy-MM-dd");
      const existing = dataMap.get(dateKey);
      const amount = txn.total_amount.toNumber();
      
      if (existing) {
        existing.sales += amount;
      }
    }
    
    // Calculate rolling average forecast
    const sortedData = Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    
    for (let i = 0; i < sortedData.length; i++) {
      if (i < 7) {
        sortedData[i].forecast = sortedData[i].sales;
      } else {
        const prev7 = sortedData.slice(i - 7, i);
        const avg = prev7.reduce((sum, d) => sum + d.sales, 0) / 7;
        sortedData[i].forecast = Math.round(avg);
      }
    }
    
    return sortedData;
  } catch (error) {
    console.error("[Analytics] Error fetching chart data by date range:", error);
    return [];
  }
}

/**
 * Get sales stats for a custom date range with comparison to previous period
 */
export async function getStatsByDateRange(startDate: Date, endDate: Date) {
  try {
    const rangeStart = startOfDay(startDate);
    const rangeEnd = endOfDay(endDate);
    
    // Calculate the length of the period in milliseconds
    const periodLength = rangeEnd.getTime() - rangeStart.getTime();
    const periodDays = Math.ceil(periodLength / (1000 * 60 * 60 * 24));
    
    // Calculate previous period (same length, immediately before)
    const prevEnd = new Date(rangeStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodLength);
    
    // Current period transactions
    const currentTransactions = await prisma.transaction.findMany({
      where: {
        created_at: { gte: rangeStart, lte: rangeEnd },
        status: "COMPLETED",
      },
      include: { items: true },
    });
    
    // Previous period transactions for comparison
    const previousTransactions = await prisma.transaction.findMany({
      where: {
        created_at: { gte: prevStart, lte: prevEnd },
        status: "COMPLETED",
      },
      include: { items: true },
    });
    
    const calculateStats = (transactions: typeof currentTransactions) => {
      let revenue = 0;
      let cost = 0;
      
      for (const tx of transactions) {
        for (const item of tx.items) {
          const itemPrice = Number(item.price_at_sale);
          const itemCost = Number(item.cost_at_sale);
          
          if (itemPrice > 0) {
            revenue += itemPrice * item.quantity;
            cost += itemCost * item.quantity;
          }
        }
      }
      
      return {
        count: transactions.length,
        revenue,
        cost,
        profit: revenue - cost,
      };
    };
    
    return {
      current: calculateStats(currentTransactions),
      previous: calculateStats(previousTransactions),
      periodDays,
    };
  } catch (error) {
    console.error("[Analytics] Error fetching stats by date range:", error);
    return {
      current: { count: 0, revenue: 0, cost: 0, profit: 0 },
      previous: { count: 0, revenue: 0, cost: 0, profit: 0 },
      periodDays: 30,
    };
  }
}

function getRecommendedAction(forecast: ForecastResult): string {
  // COVERAGE-BASED STATUS LOGIC
  // Status is now determined by Days of Supply (coverageDays = stock / velocity)
  
  // Dead Stock: 0 velocity = not selling, don't restock
  if (forecast.stockStatus === "DEAD_STOCK") {
    return "Dead Stock";
  }
  
  // Out of Stock: Zero inventory
  if (forecast.stockStatus === "OUT_OF_STOCK") {
    if (forecast.avgDailyVelocity >= 0.1) {
      return "Critical Restock";
    }
    return "Out (No demand)";
  }
  
  // CRITICAL: ≤2 days of supply left
  if (forecast.stockStatus === "CRITICAL") {
    const daysLeft = forecast.daysOfStock;
    return `Critical (${daysLeft}d left)`;
  }
  
  // LOW: 2-7 days of supply left
  if (forecast.stockStatus === "LOW") {
    const daysLeft = forecast.daysOfStock;
    return `Restock (${daysLeft}d left)`;
  }
  
  // HEALTHY: >7 days of supply
  if (forecast.velocityTrend === "INCREASING" && forecast.suggestedReorderQty > 0) {
    return "Maintain Stock";
  }
  
  if (forecast.activeEvents.length > 0) {
    return `Event: ${forecast.activeEvents[0].name.slice(0, 15)}`;
  }
  
  return "Maintain Stock";
}

// =============================================================================
// Event Management Actions
// =============================================================================

export interface CreateEventInput {
  name: string;
  description?: string;
  source: "STORE_DISCOUNT" | "MANUFACTURER_CAMPAIGN" | "HOLIDAY";
  startDate: string;
  endDate: string;
  multiplier?: number;
  affectedBrand?: string;
  affectedCategory?: string;
  productIds?: number[];
}

export async function createEvent(input: CreateEventInput) {
  try {
    const event = await prisma.eventLog.create({
      data: {
        name: input.name,
        description: input.description,
        source: input.source,
        start_date: new Date(input.startDate),
        end_date: new Date(input.endDate),
        multiplier: input.multiplier ?? 2.0,
        affected_brand: input.affectedBrand,
        affected_category: input.affectedCategory,
        created_by: "Admin UI",
        products: input.productIds?.length ? {
          create: input.productIds.map(productId => ({
            product_id: productId,
          })),
        } : undefined,
      },
      include: {
        products: {
          include: {
            product: {
              select: { product_id: true, product_name: true },
            },
          },
        },
      },
    });
    
    return { success: true, data: event };
  } catch (error) {
    console.error("[Analytics] Error creating event:", error);
    return { success: false, error: "Failed to create event" };
  }
}

export async function getEvents() {
  try {
    const events = await prisma.eventLog.findMany({
      orderBy: { start_date: "desc" },
      include: {
        products: {
          include: {
            product: {
              select: { product_id: true, product_name: true, barcode: true },
            },
          },
        },
      },
    });
    
    // Convert Decimal to number for client component serialization
    return events.map(event => ({
      ...event,
      multiplier: event.multiplier ? Number(event.multiplier) : null,
    }));
  } catch (error) {
    console.error("[Analytics] Error fetching events:", error);
    return [];
  }
}

export async function deleteEvent(eventId: number) {
  try {
    await prisma.eventLog.delete({
      where: { id: eventId },
    });
    
    return { success: true };
  } catch (error) {
    console.error("[Analytics] Error deleting event:", error);
    return { success: false, error: "Failed to delete event" };
  }
}

export async function toggleEventActive(eventId: number, isActive: boolean) {
  try {
    await prisma.eventLog.update({
      where: { id: eventId },
      data: { is_active: isActive },
    });
    
    return { success: true };
  } catch (error) {
    console.error("[Analytics] Error toggling event:", error);
    return { success: false, error: "Failed to update event" };
  }
}

// =============================================================================
// Event Log CSV Import
// =============================================================================

export interface CsvEventRow {
  name: string;
  source: string; // STORE_DISCOUNT, MANUFACTURER_CAMPAIGN, HOLIDAY
  start_date: string;
  end_date: string;
  multiplier?: number | string;
  affected_brand?: string;
  affected_barcodes?: string; // Pipe-separated list
}

export interface EventImportResult {
  successCount: number;
  failedCount: number;
  failedRows: { row: number; reason: string }[];
}

/**
 * Import events from CSV (events_log.csv from generate_history_v2.py)
 * 
 * Expected columns: name, source, start_date, end_date, multiplier, affected_brand, affected_barcodes
 */
export async function importEventsCsv(data: CsvEventRow[]): Promise<EventImportResult> {
  let successCount = 0;
  const failedRows: { row: number; reason: string }[] = [];
  
  const validSources = ["STORE_DISCOUNT", "MANUFACTURER_CAMPAIGN", "HOLIDAY"];
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2; // +2 for header row and 0-indexing
    
    try {
      // Validate source
      const source = String(row.source).toUpperCase().trim();
      if (!validSources.includes(source)) {
        failedRows.push({ row: rowNum, reason: `Invalid source: ${row.source}. Must be STORE_DISCOUNT, MANUFACTURER_CAMPAIGN, or HOLIDAY` });
        continue;
      }
      
      // Parse dates
      const startDate = new Date(row.start_date);
      const endDate = new Date(row.end_date);
      
      if (isNaN(startDate.getTime())) {
        failedRows.push({ row: rowNum, reason: `Invalid start_date: ${row.start_date}` });
        continue;
      }
      
      if (isNaN(endDate.getTime())) {
        failedRows.push({ row: rowNum, reason: `Invalid end_date: ${row.end_date}` });
        continue;
      }
      
      // Parse multiplier
      const multiplier = row.multiplier 
        ? parseFloat(String(row.multiplier)) 
        : 2.0;
      
      if (isNaN(multiplier) || multiplier <= 0) {
        failedRows.push({ row: rowNum, reason: `Invalid multiplier: ${row.multiplier}` });
        continue;
      }
      
      // Find products by barcodes if provided
      let productIds: number[] = [];
      if (row.affected_barcodes && row.affected_barcodes.trim()) {
        const barcodes = row.affected_barcodes.split("|").map(b => b.trim()).filter(Boolean);
        if (barcodes.length > 0) {
          const products = await prisma.product.findMany({
            where: { barcode: { in: barcodes } },
            select: { product_id: true },
          });
          productIds = products.map(p => p.product_id);
        }
      }
      
      // Create the event
      await prisma.eventLog.create({
        data: {
          name: row.name.trim(),
          source: source as "STORE_DISCOUNT" | "MANUFACTURER_CAMPAIGN" | "HOLIDAY",
          start_date: startDate,
          end_date: endDate,
          multiplier: multiplier,
          affected_brand: row.affected_brand?.trim() || null,
          created_by: "CSV Import",
          products: productIds.length > 0 ? {
            create: productIds.map(productId => ({
              product_id: productId,
            })),
          } : undefined,
        },
      });
      
      successCount++;
    } catch (error) {
      console.error(`[Analytics] Error importing event row ${rowNum}:`, error);
      failedRows.push({ 
        row: rowNum, 
        reason: error instanceof Error ? error.message : "Database error" 
      });
    }
  }
  
  return {
    successCount,
    failedCount: failedRows.length,
    failedRows,
  };
}

// =============================================================================
// Analytics Hub - Additional Data Fetching
// =============================================================================

export interface TopMoverResult {
  product_id: number;
  product_name: string;
  velocity: number;
  total_sold: number;
  current_stock: number;
  category: string;
  image_url: string | null;
}

/**
 * Get top products by sales velocity for a given date range
 */
export async function getTopMovers(startDate: Date, endDate: Date): Promise<TopMoverResult[]> {
  try {
    const rangeStart = startOfDay(startDate);
    const rangeEnd = endOfDay(endDate);
    
    // Calculate the number of days in the range
    const diffTime = rangeEnd.getTime() - rangeStart.getTime();
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    
    // Get top products by quantity sold
    const topProducts = await prisma.transactionItem.groupBy({
      by: ["product_id"],
      where: {
        transaction: {
          created_at: { gte: rangeStart, lte: rangeEnd },
          status: "COMPLETED",
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 10,
    });
    
    // Get product details with inventory for stock
    const productIds = topProducts.map(p => p.product_id);
    const products = await prisma.product.findMany({
      where: { product_id: { in: productIds } },
      select: {
        product_id: true,
        product_name: true,
        category: true,
        image_url: true,
        inventory: {
          select: {
            current_stock: true,
          },
        },
      },
    });
    
    const productMap = new Map(products.map(p => [p.product_id, p]));
    
    return topProducts
      .map(p => {
        const product = productMap.get(p.product_id);
        if (!product) return null;
        
        return {
          product_id: product.product_id,
          product_name: product.product_name,
          velocity: Math.round((p._sum.quantity ?? 0) / diffDays * 10) / 10,
          total_sold: p._sum.quantity ?? 0,
          current_stock: product.inventory?.current_stock ?? 0,
          category: product.category,
          image_url: product.image_url,
        };
      })
      .filter((p): p is TopMoverResult => p !== null);
  } catch (error) {
    console.error("[Analytics] Error fetching top movers:", error);
    return [];
  }
}

// =============================================================================
// Category Sales Share - For Donut Chart
// =============================================================================

export interface CategorySalesResult {
  category: string;
  label: string;
  revenue: number;
  percentage: number;
  color: string;
}

// Category color palette matching design system
const CATEGORY_COLORS: Record<string, string> = {
  BEVERAGES: "#2EAFC5",      // Teal
  SODA: "#10B981",           // Emerald
  SOFTDRINKS_CASE: "#6366F1", // Indigo
  SNACK: "#F59E0B",          // Amber
  CANNED_GOODS: "#EF4444",   // Red
  DAIRY: "#EC4899",          // Pink
  BREAD: "#F97316",          // Orange
  INSTANT_NOODLES: "#8B5CF6", // Purple
  CONDIMENTS: "#14B8A6",     // Teal
  PERSONAL_CARE: "#06B6D4",  // Cyan
  HOUSEHOLD: "#84CC16",      // Lime
  OTHER: "#6B7280",          // Gray
};

/**
 * Get sales distribution by category for a given date range
 */
export async function getCategorySalesShare(startDate: Date, endDate: Date): Promise<CategorySalesResult[]> {
  try {
    const rangeStart = startOfDay(startDate);
    const rangeEnd = endOfDay(endDate);
    
    // Get transaction items with product category
    const items = await prisma.transactionItem.findMany({
      where: {
        transaction: {
          created_at: { gte: rangeStart, lte: rangeEnd },
          status: "COMPLETED",
        },
      },
      select: {
        subtotal: true,
        product: {
          select: {
            category: true,
          },
        },
      },
    });
    
    // Aggregate by category
    const categoryMap = new Map<string, number>();
    let totalRevenue = 0;
    
    for (const item of items) {
      const category = item.product.category;
      const revenue = Number(item.subtotal);
      totalRevenue += revenue;
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + revenue);
    }
    
    // Format and sort by revenue
    const results: CategorySalesResult[] = Array.from(categoryMap.entries())
      .map(([category, revenue]) => ({
        category,
        label: category.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        revenue: Math.round(revenue),
        percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 1000) / 10 : 0,
        color: CATEGORY_COLORS[category] ?? CATEGORY_COLORS.OTHER,
      }))
      .sort((a, b) => b.revenue - a.revenue);
    
    // Return top 8 categories, group rest as "Other"
    if (results.length > 8) {
      const top7 = results.slice(0, 7);
      const others = results.slice(7);
      const otherRevenue = others.reduce((sum, c) => sum + c.revenue, 0);
      const otherPercentage = others.reduce((sum, c) => sum + c.percentage, 0);
      
      return [
        ...top7,
        {
          category: "OTHER",
          label: "Other",
          revenue: Math.round(otherRevenue),
          percentage: Math.round(otherPercentage * 10) / 10,
          color: CATEGORY_COLORS.OTHER,
        },
      ];
    }
    
    return results;
  } catch (error) {
    console.error("[Analytics] Error fetching category sales:", error);
    return [];
  }
}

export interface HourlyTrafficResult {
  hour: string;
  transactions: number;
  revenue: number;
}

/**
 * Get sales distribution by hour of day for a given date range
 */
export async function getPeakTrafficData(startDate: Date, endDate: Date): Promise<HourlyTrafficResult[]> {
  try {
    const rangeStart = startOfDay(startDate);
    const rangeEnd = endOfDay(endDate);
    
    // Get all transactions in the range
    const transactions = await prisma.transaction.findMany({
      where: {
        created_at: { gte: rangeStart, lte: rangeEnd },
        status: "COMPLETED",
      },
      select: {
        created_at: true,
        total_amount: true,
      },
    });
    
    // Initialize hourly buckets
    const hourlyData: Map<number, { transactions: number; revenue: number }> = new Map();
    for (let h = 0; h < 24; h++) {
      hourlyData.set(h, { transactions: 0, revenue: 0 });
    }
    
    // Aggregate by hour
    for (const txn of transactions) {
      const hour = txn.created_at.getHours();
      const existing = hourlyData.get(hour)!;
      existing.transactions += 1;
      existing.revenue += Number(txn.total_amount);
    }
    
    // Format results
    return Array.from(hourlyData.entries())
      .map(([hour, data]) => ({
        hour: `${hour.toString().padStart(2, "0")}:00`,
        transactions: data.transactions,
        revenue: Math.round(data.revenue),
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  } catch (error) {
    console.error("[Analytics] Error fetching peak traffic data:", error);
    return [];
  }
}

export interface ForecastDataPoint {
  date: string;
  historical: number | null;
  forecast: number | null;
  forecastUpper: number | null;  // Upper confidence band (+15%)
  forecastLower: number | null;  // Lower confidence band (-15%)
  bridge: number | null;         // Bridge connecting historical to forecast
  isEvent: boolean;
  eventName?: string;
}

/**
 * Get historical sales (last 7 days) and forecast (next 7 days)
 * with confidence interval and visual bridge
 */
export async function getForecastData(): Promise<ForecastDataPoint[]> {
  try {
    const today = startOfDay(new Date());
    const past7Days = subDays(today, 7);
    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);
    
    // Get historical transactions (last 7 days)
    const transactions = await prisma.transaction.findMany({
      where: {
        created_at: { gte: past7Days, lt: today },
        status: "COMPLETED",
      },
      select: {
        created_at: true,
        total_amount: true,
      },
    });
    
    // Aggregate historical by day
    const historicalMap = new Map<string, number>();
    for (const txn of transactions) {
      const dateKey = format(txn.created_at, "yyyy-MM-dd");
      historicalMap.set(dateKey, (historicalMap.get(dateKey) ?? 0) + Number(txn.total_amount));
    }
    
    // Get active events for next 7 days
    const events = await prisma.eventLog.findMany({
      where: {
        start_date: { lte: next7Days },
        end_date: { gte: today },
        is_active: true,
      },
    });
    
    // Calculate average daily revenue (for simple forecast)
    const historicalValues = Array.from(historicalMap.values());
    const avgDailyRevenue = historicalValues.length > 0
      ? historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length
      : 0;
    
    // Build the data points
    const result: ForecastDataPoint[] = [];
    let lastHistoricalValue = 0;
    let firstForecastValue = 0;
    
    // Past 7 days (historical)
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i + 1);
      const dateKey = format(date, "yyyy-MM-dd");
      const dateLabel = format(date, "MMM d");
      const historicalValue = historicalMap.get(dateKey) ?? 0;
      
      // Track last historical value for bridge
      if (i === 0) {
        lastHistoricalValue = historicalValue;
      }
      
      result.push({
        date: dateLabel,
        historical: historicalValue,
        forecast: null,
        forecastUpper: null,
        forecastLower: null,
        bridge: null,
        isEvent: false,
      });
    }
    
    // Today + Next 7 days (forecast)
    for (let i = 0; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateLabel = format(date, "MMM d");
      
      // Check for events
      const activeEvent = events.find(e => {
        const eventStart = startOfDay(e.start_date);
        const eventEnd = endOfDay(e.end_date);
        return date >= eventStart && date <= eventEnd;
      });
      
      // Simple forecast with event multiplier
      let forecastValue = avgDailyRevenue;
      if (activeEvent && activeEvent.multiplier) {
        forecastValue *= Number(activeEvent.multiplier);
      }
      
      // Add some randomness for visual effect
      forecastValue *= (0.85 + Math.random() * 0.3);
      forecastValue = Math.round(forecastValue);
      
      // Track first forecast value for bridge
      if (i === 0) {
        firstForecastValue = forecastValue;
      }
      
      // Calculate confidence interval (±15%)
      const confidenceMargin = 0.15;
      const upper = Math.round(forecastValue * (1 + confidenceMargin));
      const lower = Math.round(forecastValue * (1 - confidenceMargin));
      
      result.push({
        date: dateLabel,
        historical: null,
        forecast: forecastValue,
        forecastUpper: upper,
        forecastLower: lower,
        bridge: null,
        isEvent: !!activeEvent,
        eventName: activeEvent?.name,
      });
    }
    
    // Add bridge data - connects last historical point to first forecast point
    // Find the last historical entry and first forecast entry
    const lastHistoricalIdx = result.findIndex(r => r.forecast !== null) - 1;
    const firstForecastIdx = lastHistoricalIdx + 1;
    
    if (lastHistoricalIdx >= 0 && firstForecastIdx < result.length) {
      // Add bridge value to last historical point
      result[lastHistoricalIdx].bridge = lastHistoricalValue;
      // Add bridge value to first forecast point
      result[firstForecastIdx].bridge = firstForecastValue;
    }
    
    return result;
  } catch (error) {
    console.error("[Analytics] Error fetching forecast data:", error);
    return [];
  }
}

// =============================================================================
// Product-Specific Demand Forecast (Quantity-based)
// =============================================================================

export interface DemandForecastDataPoint {
  date: string;
  historical: number | null;  // Units sold
  forecast: number | null;    // Predicted units
  forecastUpper: number | null;
  forecastLower: number | null;
  bridge: number | null;
  isEvent: boolean;
  eventName?: string;
}

export interface ProductDemandInfo {
  productId: number;
  productName: string;
  productImage: string | null;
  currentStock: number;
  category: string;
}

/**
 * Get demand forecast data in UNITS (quantity), not revenue.
 * If productId is provided, returns product-specific data.
 * Otherwise returns total store demand.
 * 
 * @param productId - Optional product ID for product-specific forecast
 * @param historyDays - Number of historical days to show (7, 30, or 90)
 */
export async function getDemandForecastData(
  productId?: number | null,
  historyDays: 7 | 30 | 90 = 7
): Promise<{
  data: DemandForecastDataPoint[];
  product: ProductDemandInfo | null;
  totalStoreDemand: number;
}> {
  try {
    const today = startOfDay(new Date());
    const historyStart = subDays(today, historyDays);
    
    // Calculate forecast end date based on proportional forecasting
    // 7d history → 7d forecast, 30d → 14d, 90d → 30d
    const forecastDays = historyDays === 7 ? 7 : historyDays === 30 ? 14 : 30;
    const forecastEnd = new Date(today);
    forecastEnd.setDate(forecastEnd.getDate() + forecastDays);
    
    let product: ProductDemandInfo | null = null;
    
    // If productId provided, fetch product info
    if (productId) {
      const productData = await prisma.product.findUnique({
        where: { product_id: productId },
        include: {
          inventory: { select: { current_stock: true } },
        },
      });
      
      if (productData) {
        product = {
          productId: productData.product_id,
          productName: productData.product_name,
          productImage: productData.image_url,
          currentStock: productData.inventory?.current_stock ?? 0,
          category: productData.category,
        };
      }
    }
    
    // Get historical sales data from DailySalesAggregate (quantity-based)
    // This is much faster than querying TransactionItem directly
    const dailyAggregates = await prisma.dailySalesAggregate.findMany({
      where: {
        date: { gte: historyStart, lt: today },
        ...(productId ? { product_id: productId } : {}),
      },
      select: {
        date: true,
        quantity_sold: true,
        product_id: true,
      },
      orderBy: { date: "asc" },
    });
    
    // Aggregate historical by day (quantities)
    const historicalMap = new Map<string, number>();
    for (const agg of dailyAggregates) {
      const dateKey = format(agg.date, "yyyy-MM-dd");
      historicalMap.set(dateKey, (historicalMap.get(dateKey) ?? 0) + agg.quantity_sold);
    }
    
    // Get active events for the forecast period
    const events = await prisma.eventLog.findMany({
      where: {
        start_date: { lte: forecastEnd },
        end_date: { gte: today },
        is_active: true,
      },
    });
    
    // Calculate average daily quantity from history
    const historicalValues = Array.from(historicalMap.values());
    const avgDailyQty = historicalValues.length > 0
      ? historicalValues.reduce((a, b) => a + b, 0) / Math.max(historicalValues.length, 1)
      : 0;
    
    // Calculate total store demand (sum of all forecast days)
    const totalStoreDemand = Math.round(avgDailyQty * 7);
    
    // Build the data points
    const result: DemandForecastDataPoint[] = [];
    let lastHistoricalValue = 0;
    let firstForecastValue = 0;
    
    // Determine granularity based on history length
    // 7 days: daily, 30 days: daily, 90 days: weekly
    const useWeeklyGranularity = historyDays === 90;
    
    if (useWeeklyGranularity) {
      // Aggregate into weeks for 90-day view
      const weeklyMap = new Map<number, { sum: number; count: number; label: string }>();
      
      for (let i = historyDays - 1; i >= 0; i--) {
        const date = subDays(today, i + 1);
        const weekNum = Math.floor(i / 7);
        const dateKey = format(date, "yyyy-MM-dd");
        const dayValue = historicalMap.get(dateKey) ?? 0;
        
        const existing = weeklyMap.get(weekNum) || { sum: 0, count: 0, label: format(date, "MMM d") };
        existing.sum += dayValue;
        existing.count++;
        if (existing.count === 1) {
          existing.label = format(date, "MMM d");
        }
        weeklyMap.set(weekNum, existing);
      }
      
      // Sort weeks (most recent last)
      const sortedWeeks = Array.from(weeklyMap.entries()).sort((a, b) => b[0] - a[0]).reverse();
      
      for (const [, week] of sortedWeeks) {
        result.push({
          date: week.label,
          historical: week.sum,
          forecast: null,
          forecastUpper: null,
          forecastLower: null,
          bridge: null,
          isEvent: false,
        });
        lastHistoricalValue = week.sum;
      }
    } else {
      // Daily granularity for 7 and 30 day views
      for (let i = historyDays - 1; i >= 0; i--) {
        const date = subDays(today, i + 1);
        const dateKey = format(date, "yyyy-MM-dd");
        const dateLabel = format(date, historyDays <= 7 ? "MMM d" : "M/d");
        const historicalValue = historicalMap.get(dateKey) ?? 0;
        
        if (i === 0) {
          lastHistoricalValue = historicalValue;
        }
        
        result.push({
          date: dateLabel,
          historical: historicalValue,
          forecast: null,
          forecastUpper: null,
          forecastLower: null,
          bridge: null,
          isEvent: false,
        });
      }
    }
    
    // PROPORTIONAL FORECASTING:
    // 7-day history → 7-day forecast (daily bars)
    // 30-day history → 14-day forecast (daily bars)
    // 90-day history → 30-day forecast (weekly aggregation)
    const useForecastWeeklyGranularity = historyDays === 90;
    
    if (useForecastWeeklyGranularity) {
      // Weekly aggregation for 90-day view forecast (30 days = ~4-5 weeks)
      const weeksToForecast = Math.ceil(forecastDays / 7);
      
      for (let week = 0; week < weeksToForecast; week++) {
        const weekStartDay = week * 7;
        const weekStartDate = new Date(today);
        weekStartDate.setDate(weekStartDate.getDate() + weekStartDay);
        const dateLabel = format(weekStartDate, "MMM d");
        
        // Calculate weekly forecast (7 days worth)
        let weeklyForecast = 0;
        let hasEvent = false;
        let eventName: string | undefined;
        
        for (let d = 0; d < 7 && (weekStartDay + d) < forecastDays; d++) {
          const dayDate = new Date(today);
          dayDate.setDate(dayDate.getDate() + weekStartDay + d);
          
          // Check for events
          const activeEvent = events.find(e => {
            const eventStart = startOfDay(e.start_date);
            const eventEnd = endOfDay(e.end_date);
            return dayDate >= eventStart && dayDate <= eventEnd;
          });
          
          let dayForecast = avgDailyQty;
          if (activeEvent && activeEvent.multiplier) {
            dayForecast *= Number(activeEvent.multiplier);
            hasEvent = true;
            eventName = activeEvent.name;
          }
          
          // Add some variance
          dayForecast *= (0.9 + Math.random() * 0.2);
          weeklyForecast += dayForecast;
        }
        
        weeklyForecast = Math.round(weeklyForecast);
        
        if (week === 0) {
          firstForecastValue = weeklyForecast;
        }
        
        // Confidence interval (±20%)
        const confidenceMargin = 0.2;
        const upper = Math.round(weeklyForecast * (1 + confidenceMargin));
        const lower = Math.round(weeklyForecast * (1 - confidenceMargin));
        
        result.push({
          date: dateLabel,
          historical: null,
          forecast: weeklyForecast,
          forecastUpper: upper,
          forecastLower: lower,
          bridge: null,
          isEvent: hasEvent,
          eventName,
        });
      }
    } else {
      // Daily granularity for 7 and 30 day views
      for (let i = 0; i < forecastDays; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateLabel = format(date, historyDays <= 7 ? "MMM d" : "M/d");
        
        // Check for events
        const activeEvent = events.find(e => {
          const eventStart = startOfDay(e.start_date);
          const eventEnd = endOfDay(e.end_date);
          return date >= eventStart && date <= eventEnd;
        });
        
        // Simple forecast with event multiplier
        let forecastValue = avgDailyQty;
        if (activeEvent && activeEvent.multiplier) {
          forecastValue *= Number(activeEvent.multiplier);
        }
        
        // Add some variance
        forecastValue *= (0.9 + Math.random() * 0.2);
        forecastValue = Math.round(forecastValue);
        
        if (i === 0) {
          firstForecastValue = forecastValue;
        }
        
        // Confidence interval (±20%)
        const confidenceMargin = 0.2;
        const upper = Math.round(forecastValue * (1 + confidenceMargin));
        const lower = Math.round(forecastValue * (1 - confidenceMargin));
        
        result.push({
          date: dateLabel,
          historical: null,
          forecast: forecastValue,
          forecastUpper: upper,
          forecastLower: lower,
          bridge: null,
          isEvent: !!activeEvent,
          eventName: activeEvent?.name,
        });
      }
    }
    
    // Add bridge data
    const lastHistoricalIdx = result.findIndex(r => r.forecast !== null) - 1;
    const firstForecastIdx = lastHistoricalIdx + 1;
    
    if (lastHistoricalIdx >= 0 && firstForecastIdx < result.length) {
      result[lastHistoricalIdx].bridge = lastHistoricalValue;
      result[firstForecastIdx].bridge = firstForecastValue;
    }
    
    return { data: result, product, totalStoreDemand };
  } catch (error) {
    console.error("[Analytics] Error fetching demand forecast:", error);
    return { data: [], product: null, totalStoreDemand: 0 };
  }
}

// =============================================================================
// Smart Insights Data Fetching
// =============================================================================

/**
 * Get smart business insights based on current sales velocity and stock levels.
 * Returns up to 4 prioritized insights for the analytics dashboard.
 * 
 * Uses DailySalesAggregate for performance instead of TransactionItem.
 */
export async function getSmartInsights(): Promise<Insight[]> {
  try {
    const today = startOfDay(new Date());
    const last7Days = subDays(today, 7);
    const last14Days = subDays(today, 14);
    const last30Days = subDays(today, 30);
    const thisMonthStart = startOfMonth(today);
    const lastMonthStart = startOfMonth(subMonths(today, 1));
    const dayOfMonth = today.getDate();
    
    // Get all products with current stock via inventory relation
    const products = await prisma.product.findMany({
      where: { is_archived: false },
      select: {
        product_id: true,
        product_name: true,
        image_url: true,
        category: true,
        cost_price: true,
        retail_price: true,
        inventory: {
          select: {
            current_stock: true,
          },
        },
      },
    });
    
    // Get sales for last 14 days from DailySalesAggregate (this week + last week for velocity comparison)
    const recentAggregates = await prisma.dailySalesAggregate.findMany({
      where: {
        date: { gte: last14Days, lt: today },
      },
      select: {
        product_id: true,
        quantity_sold: true,
        date: true,
        revenue: true,
      },
    });
    
    // Get the ACTUAL last sale date for each product (not limited to 14 days)
    // This prevents the "27 years" bug for products that haven't sold recently
    const lastSaleDates = await prisma.dailySalesAggregate.groupBy({
      by: ["product_id"],
      _max: {
        date: true,
      },
      where: {
        quantity_sold: { gt: 0 },
      },
    });
    
    // Calculate this month's revenue vs last month (same day range) from DailySalesAggregate
    const thisMonthAggregates = await prisma.dailySalesAggregate.aggregate({
      where: {
        date: {
          gte: thisMonthStart,
          lte: today,
        },
      },
      _sum: { revenue: true },
    });
    
    // Last month up to the same day
    const lastMonthSameDay = new Date(lastMonthStart);
    lastMonthSameDay.setDate(Math.min(dayOfMonth, new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth() + 1, 0).getDate()));
    
    const lastMonthAggregates = await prisma.dailySalesAggregate.aggregate({
      where: {
        date: {
          gte: lastMonthStart,
          lte: lastMonthSameDay,
        },
      },
      _sum: { revenue: true },
    });
    
    // Build a map of actual last sale dates for each product
    const lastSaleDateMap = new Map<number, Date>();
    for (const record of lastSaleDates) {
      if (record._max.date) {
        lastSaleDateMap.set(record.product_id, record._max.date);
      }
    }
    
    // Build velocity data for each product from aggregated data
    const velocityMap = new Map<number, {
      thisWeek: number;
      lastWeek: number;
    }>();
    
    for (const agg of recentAggregates) {
      const productId = agg.product_id;
      const saleDate = agg.date;
      const isThisWeek = saleDate >= last7Days;
      
      const existing = velocityMap.get(productId) || {
        thisWeek: 0,
        lastWeek: 0,
      };
      
      if (isThisWeek) {
        existing.thisWeek += agg.quantity_sold;
      } else {
        existing.lastWeek += agg.quantity_sold;
      }
      
      velocityMap.set(productId, existing);
    }
    
    // Transform to VelocityData array
    const velocityData: VelocityData[] = products.map(product => {
      const sales = velocityMap.get(product.product_id);
      const thisWeekQty = sales?.thisWeek ?? 0;
      const lastWeekQty = sales?.lastWeek ?? 0;
      // Use the actual last sale date from our separate query, not limited to 14 days
      const lastSaleDate = lastSaleDateMap.get(product.product_id) ?? null;
      
      const dailyVelocity = thisWeekQty / 7;
      const weeklyVelocity = thisWeekQty;
      const lastWeekVelocity = lastWeekQty;
      
      // Calculate % change (handle division by zero)
      let velocityChange = 0;
      if (lastWeekVelocity > 0) {
        velocityChange = ((weeklyVelocity - lastWeekVelocity) / lastWeekVelocity) * 100;
      } else if (weeklyVelocity > 0) {
        velocityChange = 100; // New sales this week
      }
      
      // Days since last sale
      let daysSinceLastSale = 9999;
      if (lastSaleDate) {
        daysSinceLastSale = Math.floor((today.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      return {
        productId: product.product_id,
        productName: product.product_name,
        productImage: product.image_url,
        category: product.category,
        currentStock: product.inventory?.current_stock ?? 0,
        dailyVelocity,
        weeklyVelocity,
        lastWeekVelocity,
        velocityChange,
        lastSaleDate,
        daysSinceLastSale,
      };
    });
    
    // Generate insights
    const insights = generateBusinessInsights({
      velocityData,
      thisMonthRevenue: Number(thisMonthAggregates._sum.revenue ?? 0),
      lastMonthSameDayRevenue: Number(lastMonthAggregates._sum.revenue ?? 0),
    });
    
    // Return default insight if no insights generated
    if (insights.length === 0) {
      return [getDefaultInsight()];
    }
    
    return insights;
  } catch (error) {
    console.error("[Analytics] Error generating insights:", error);
    return [getDefaultInsight()];
  }
}

// =============================================================================
// Batched Analytics Data Fetcher - Performance Optimization
// =============================================================================

/**
 * Fetches all analytics dashboard data in a single batched call.
 * This significantly reduces the number of round-trips between client and server.
 * 
 * Previously: 7 separate server action calls (each ~500-2000ms)
 * Now: 1 batched call with parallel DB queries (~500-800ms total)
 */
export interface BatchedAnalyticsData {
  chartData: DashboardChartDataPoint[];
  previousChartData: DashboardChartDataPoint[];
  topMovers: TopMoverResult[];
  categoryData: CategorySalesResult[];
  peakTraffic: HourlyTrafficResult[];
  forecastData: ForecastDataPoint[];
  insights: Insight[];
}

export async function getBatchedAnalyticsData(
  startDate: Date,
  endDate: Date
): Promise<BatchedAnalyticsData> {
  try {
    const rangeStart = startOfDay(startDate);
    const rangeEnd = endOfDay(endDate);
    
    // Calculate previous period for comparison
    const periodLength = rangeEnd.getTime() - rangeStart.getTime();
    const prevEnd = new Date(rangeStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodLength);
    
    // Execute all queries in parallel for maximum performance
    const [
      chartData,
      previousChartData,
      topMovers,
      categoryData,
      peakTraffic,
      forecastData,
      insights,
    ] = await Promise.all([
      getDashboardChartDataByDateRange(rangeStart, rangeEnd),
      getDashboardChartDataByDateRange(prevStart, prevEnd),
      getTopMovers(rangeStart, rangeEnd),
      getCategorySalesShare(rangeStart, rangeEnd),
      getPeakTrafficData(rangeStart, rangeEnd),
      getForecastData(),
      getSmartInsights(),
    ]);
    
    return {
      chartData,
      previousChartData,
      topMovers,
      categoryData,
      peakTraffic,
      forecastData,
      insights,
    };
  } catch (error) {
    console.error("[Analytics] Error fetching batched data:", error);
    // Return empty data on error
    return {
      chartData: [],
      previousChartData: [],
      topMovers: [],
      categoryData: [],
      peakTraffic: [],
      forecastData: [],
      insights: [],
    };
  }
}

