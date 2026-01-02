"use server";

import { prisma } from "@/lib/prisma";
import { 
  getAllProductForecasts, 
  getReorderAlerts,
  type ForecastResult 
} from "@/lib/forecasting";
import { subDays, format, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";

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
    
    // Transform forecasts to table format
    const forecastTable: ForecastTableItem[] = forecasts
      .filter(f => f.suggestedReorderQty > 0)
      .sort((a, b) => b.suggestedReorderQty - a.suggestedReorderQty)
      .slice(0, 20)
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
    const result = Array.from(dataMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(point => {
        const date = new Date(point.date);
        // Format date label based on range length
        const dateLabel = diffDays > 60 
          ? format(date, "MMM") 
          : diffDays > 14 
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
  if (forecast.stockStatus === "OUT_OF_STOCK") {
    return "Urgent: Restock immediately";
  }
  
  if (forecast.stockStatus === "CRITICAL") {
    return "Critical: Order within 24h";
  }
  
  if (forecast.stockStatus === "LOW") {
    return "Order soon";
  }
  
  if (forecast.velocityTrend === "INCREASING" && forecast.suggestedReorderQty > 0) {
    return "Trending up - Consider larger order";
  }
  
  if (forecast.activeEvents.length > 0) {
    return `Event active: ${forecast.activeEvents[0].name}`;
  }
  
  return "Maintain stock levels";
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
  product_name: string;
  velocity: number;
  current_stock: number;
  category: string;
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
          product_name: product.product_name,
          velocity: Math.round((p._sum.quantity ?? 0) / diffDays * 10) / 10,
          current_stock: product.inventory?.current_stock ?? 0,
          category: product.category,
        };
      })
      .filter((p): p is TopMoverResult => p !== null);
  } catch (error) {
    console.error("[Analytics] Error fetching top movers:", error);
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
  isEvent: boolean;
  eventName?: string;
}

/**
 * Get historical sales (last 7 days) and forecast (next 7 days)
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
    
    // Past 7 days (historical)
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i + 1);
      const dateKey = format(date, "yyyy-MM-dd");
      const dateLabel = format(date, "MMM d");
      
      result.push({
        date: dateLabel,
        historical: historicalMap.get(dateKey) ?? 0,
        forecast: null,
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
      
      result.push({
        date: dateLabel,
        historical: null,
        forecast: Math.round(forecastValue),
        isEvent: !!activeEvent,
        eventName: activeEvent?.name,
      });
    }
    
    return result;
  } catch (error) {
    console.error("[Analytics] Error fetching forecast data:", error);
    return [];
  }
}
