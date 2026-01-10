/**
 * Christian Minimart - Enterprise Forecasting Engine
 * ==================================================
 * 
 * Advanced demand forecasting with outlier-corrected Weighted Moving Average (WMA).
 * 
 * Key Features:
 * 1. Data Cleaning: Filters out event-driven spikes (manufacturer ads, store promos)
 * 2. Seasonality: Applies Year-over-Year (YoY) growth adjustments
 * 3. Event Awareness: Adjusts forecasts when active events are detected
 * 
 * Algorithm: "Outlier-Corrected Hybrid Forecast"
 * - Baseline = WMA of "Clean/Organic" days only
 * - Seasonality = YoY growth factor
 * - Event Adjustment = Manual multiplier if event is currently active
 */

import { prisma } from "./prisma";
import { Prisma, EventSource as PrismaEventSource } from "@prisma/client";
import Decimal from "decimal.js";

// Re-export EventSource type from Prisma for external use
export type EventSourceType = PrismaEventSource;

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface ForecastInput {
  productId: number;
  forecastDate?: Date; // Defaults to today
  lookbackDays?: number; // Days of history to analyze (default: 30)
  includeEventAdjustment?: boolean; // Whether to apply event multipliers
}

export interface ForecastResult {
  productId: number;
  productName: string;
  barcode: string | null;
  category: string;
  costPrice: number; // Supply cost for budgeting
  
  // Forecast values
  forecastedDailyUnits: number;
  forecastedWeeklyUnits: number;
  suggestedReorderQty: number;
  
  // Confidence metrics
  confidence: "HIGH" | "MEDIUM" | "LOW";
  dataPoints: number;
  cleanDataPoints: number; // Days without events
  
  // Context
  seasonalityFactor: number;
  eventAdjustment: number;
  activeEvents: ActiveEvent[];
  
  // Historical stats
  avgDailyVelocity: number;
  cleanAvgDailyVelocity: number; // Organic-only average
  velocityTrend: "INCREASING" | "STABLE" | "DECREASING";
  
  // Stock status
  currentStock: number;
  reorderLevel: number;
  daysOfStock: number;
  stockStatus: "HEALTHY" | "LOW" | "CRITICAL" | "OUT_OF_STOCK" | "DEAD_STOCK";
}

export interface ActiveEvent {
  id: number;
  name: string;
  source: PrismaEventSource;
  multiplier: number;
  startDate: Date;
  endDate: Date;
}

export interface DailySalesData {
  date: Date;
  quantity: number;
  isEventDay: boolean;
  eventSource: PrismaEventSource | null;
  eventId: number | null;
}

export interface SeasonalityConfig {
  december: number; // Christmas season multiplier
  summer: { months: number[]; beverageMultiplier: number };
  weekendMultiplier: number;
}

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_CONFIG: SeasonalityConfig = {
  december: 1.5,
  summer: {
    months: [4, 5], // April, May (Philippine summer)
    beverageMultiplier: 1.4,
  },
  weekendMultiplier: 1.25,
};

const BEVERAGE_CATEGORIES = ["BEVERAGES", "SODA", "SOFTDRINKS_CASE"];

// WMA weights for 30-day period (more recent = higher weight)
const WMA_WEIGHTS = generateWMAWeights(30);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate exponentially decaying weights for WMA
 * More recent days have higher weights
 */
function generateWMAWeights(days: number): number[] {
  const weights: number[] = [];
  let totalWeight = 0;
  
  for (let i = 0; i < days; i++) {
    // Exponential decay: most recent day = days, oldest = 1
    const weight = Math.exp(-0.1 * i);
    weights.push(weight);
    totalWeight += weight;
  }
  
  // Normalize weights to sum to 1
  return weights.map(w => w / totalWeight);
}

/**
 * Calculate weighted moving average
 */
function calculateWMA(values: number[], weights: number[]): number {
  if (values.length === 0) return 0;
  
  const effectiveWeights = weights.slice(0, values.length);
  const normalizedWeights = normalizeWeights(effectiveWeights);
  
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i] * normalizedWeights[i];
  }
  
  return sum;
}

/**
 * Normalize weights to sum to 1
 */
function normalizeWeights(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map(w => w / total);
}

/**
 * Get seasonality multiplier for a given date and category
 */
function getSeasonalityMultiplier(
  date: Date, 
  category: string, 
  config: SeasonalityConfig = DEFAULT_CONFIG
): number {
  const month = date.getMonth() + 1; // 1-indexed
  const dayOfWeek = date.getDay();
  
  let multiplier = 1.0;
  
  // December Christmas boost
  if (month === 12) {
    multiplier *= config.december;
  }
  
  // November pre-Christmas
  if (month === 11) {
    multiplier *= 1.2;
  }
  
  // Summer boost for beverages
  if (config.summer.months.includes(month) && BEVERAGE_CATEGORIES.includes(category)) {
    multiplier *= config.summer.beverageMultiplier;
  }
  
  // Weekend boost (Saturday/Sunday)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    multiplier *= config.weekendMultiplier;
  }
  
  return multiplier;
}

/**
 * Calculate velocity trend from historical data
 */
function calculateTrend(values: number[]): "INCREASING" | "STABLE" | "DECREASING" {
  if (values.length < 7) return "STABLE";
  
  // Compare first half vs second half average
  const midPoint = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, midPoint);
  const secondHalf = values.slice(midPoint);
  
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  if (changePercent > 10) return "INCREASING";
  if (changePercent < -10) return "DECREASING";
  return "STABLE";
}

/**
 * Determine confidence level based on data quality
 */
function determineConfidence(
  totalDays: number, 
  cleanDays: number, 
  hasYoYData: boolean
): "HIGH" | "MEDIUM" | "LOW" {
  if (cleanDays >= 21 && hasYoYData) return "HIGH";
  if (cleanDays >= 14) return "MEDIUM";
  return "LOW";
}

/**
 * Calculate stock status based on DAYS OF SUPPLY (coverage days)
 * 
 * CRITICAL FIX: Status must reflect actual runway, not static reorder levels.
 * Example: 173 stock / 160 daily velocity = 1.08 days = CRITICAL (not "healthy")
 * 
 * Coverage Thresholds:
 * - ≤2 days: CRITICAL (Red) - Will run out within 48 hours
 * - 2-7 days: LOW (Orange) - Needs attention within a week  
 * - >7 days: HEALTHY (Green) - Safe for now
 * - 0 velocity with stock: DEAD_STOCK (Grey) - Not selling, don't restock
 */
function calculateStockStatus(
  currentStock: number, 
  reorderLevel: number, 
  dailyVelocity: number
): { status: "HEALTHY" | "LOW" | "CRITICAL" | "OUT_OF_STOCK" | "DEAD_STOCK"; daysOfStock: number } {
  // Case 1: No stock at all
  if (currentStock <= 0) {
    return { status: "OUT_OF_STOCK", daysOfStock: 0 };
  }
  
  // Case 2: Dead stock - has stock but zero velocity (not selling)
  // Threshold: Less than 0.1 units/day = effectively dead
  if (dailyVelocity < 0.1) {
    return { status: "DEAD_STOCK", daysOfStock: 999 };
  }
  
  // Case 3: Calculate coverage days (how long until stockout)
  const coverageDays = currentStock / dailyVelocity;
  
  // CRITICAL: ≤2 days of supply - urgent restock needed
  if (coverageDays <= 2) {
    return { status: "CRITICAL", daysOfStock: Math.floor(coverageDays) };
  }
  
  // LOW: 2-7 days of supply - order soon
  if (coverageDays <= 7) {
    return { status: "LOW", daysOfStock: Math.floor(coverageDays) };
  }
  
  // HEALTHY: >7 days of supply
  return { status: "HEALTHY", daysOfStock: Math.floor(coverageDays) };
}

// =============================================================================
// Data Fetching Functions
// =============================================================================

/**
 * Get daily sales history for a product
 * Includes event tagging for each day
 */
async function getDailySalesHistory(
  productId: number,
  startDate: Date,
  endDate: Date
): Promise<DailySalesData[]> {
  // First, try to get from pre-aggregated table
  const aggregates = await prisma.dailySalesAggregate.findMany({
    where: {
      product_id: productId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: "desc" },
  });
  
  if (aggregates.length > 0) {
    return aggregates.map(a => ({
      date: a.date,
      quantity: a.quantity_sold,
      isEventDay: a.is_event_day,
      eventSource: a.event_source,
      eventId: a.event_id,
    }));
  }
  
  // Fallback: Calculate from transaction items
  const transactions = await prisma.transactionItem.groupBy({
    by: ["transaction_id"],
    where: {
      product_id: productId,
      transaction: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
        status: "COMPLETED",
      },
    },
    _sum: {
      quantity: true,
    },
  });
  
  // Get transaction dates
  const transactionIds = transactions.map(t => t.transaction_id);
  const transactionDates = await prisma.transaction.findMany({
    where: { transaction_id: { in: transactionIds } },
    select: { transaction_id: true, created_at: true },
  });
  
  // Get active events for the date range
  const activeEvents = await prisma.eventLog.findMany({
    where: {
      OR: [
        { affected_brand: { not: null } },
        { products: { some: { product_id: productId } } },
      ],
      start_date: { lte: endDate },
      end_date: { gte: startDate },
      is_active: true,
    },
    include: {
      products: { where: { product_id: productId } },
    },
  });
  
  // Map transactions to daily data
  const dailyMap = new Map<string, DailySalesData>();
  
  for (const txn of transactions) {
    const txnDate = transactionDates.find(td => td.transaction_id === txn.transaction_id);
    if (!txnDate) continue;
    
    const dateKey = txnDate.created_at.toISOString().split("T")[0];
    const date = new Date(dateKey);
    
    // Check if this date has an active event
    let isEventDay = false;
    let eventSource: PrismaEventSource | null = null;
    let eventId: number | null = null;
    
    for (const event of activeEvents) {
      if (event.start_date <= date && event.end_date >= date) {
        isEventDay = true;
        eventSource = event.source;
        eventId = event.id;
        break;
      }
    }
    
    const existing = dailyMap.get(dateKey);
    if (existing) {
      existing.quantity += txn._sum.quantity || 0;
    } else {
      dailyMap.set(dateKey, {
        date,
        quantity: txn._sum.quantity || 0,
        isEventDay,
        eventSource,
        eventId,
      });
    }
  }
  
  return Array.from(dailyMap.values()).sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
}

/**
 * Get active events for a product on a specific date
 */
async function getActiveEvents(
  productId: number,
  date: Date
): Promise<ActiveEvent[]> {
  const product = await prisma.product.findUnique({
    where: { product_id: productId },
    select: { category: true, product_name: true },
  });
  
  if (!product) return [];
  
  // Find events that match by brand (from product name) or direct product link
  const events = await prisma.eventLog.findMany({
    where: {
      start_date: { lte: date },
      end_date: { gte: date },
      is_active: true,
      OR: [
        { products: { some: { product_id: productId } } },
        { affected_category: product.category },
      ],
    },
  });
  
  return events.map(e => ({
    id: e.id,
    name: e.name,
    source: e.source,
    multiplier: new Decimal(e.multiplier).toNumber(),
    startDate: e.start_date,
    endDate: e.end_date,
  }));
}

/**
 * Get Year-over-Year data for seasonality comparison
 */
async function getYoYData(
  productId: number,
  targetDate: Date,
  windowDays: number = 14
): Promise<{ lastYearAvg: number; thisYearAvg: number } | null> {
  const lastYearStart = new Date(targetDate);
  lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
  lastYearStart.setDate(lastYearStart.getDate() - windowDays / 2);
  
  const lastYearEnd = new Date(lastYearStart);
  lastYearEnd.setDate(lastYearEnd.getDate() + windowDays);
  
  const lastYearData = await getDailySalesHistory(productId, lastYearStart, lastYearEnd);
  
  if (lastYearData.length < 7) return null;
  
  const lastYearClean = lastYearData.filter(d => !d.isEventDay);
  if (lastYearClean.length < 5) return null;
  
  const lastYearAvg = lastYearClean.reduce((a, b) => a + b.quantity, 0) / lastYearClean.length;
  
  // Get this year's data (clean only)
  const thisYearStart = new Date(targetDate);
  thisYearStart.setDate(thisYearStart.getDate() - windowDays);
  
  const thisYearData = await getDailySalesHistory(productId, thisYearStart, targetDate);
  const thisYearClean = thisYearData.filter(d => !d.isEventDay);
  
  if (thisYearClean.length < 5) return null;
  
  const thisYearAvg = thisYearClean.reduce((a, b) => a + b.quantity, 0) / thisYearClean.length;
  
  return { lastYearAvg, thisYearAvg };
}

// =============================================================================
// Main Forecast Function
// =============================================================================

/**
 * Generate demand forecast for a product
 * 
 * Algorithm:
 * 1. Fetch historical daily sales (default: 30 days)
 * 2. Filter out event-driven days (manufacturer ads, store promos, holidays)
 * 3. Calculate Weighted Moving Average on "clean" organic days
 * 4. Apply seasonality adjustments based on forecast date
 * 5. Apply event multiplier if active event exists on forecast date
 * 6. Calculate suggested reorder quantity
 */
export async function getForecast(input: ForecastInput): Promise<ForecastResult> {
  const {
    productId,
    forecastDate = new Date(),
    lookbackDays = 30,
    includeEventAdjustment = true,
  } = input;
  
  // Get product info
  const product = await prisma.product.findUnique({
    where: { product_id: productId },
    include: {
      inventory: true,
    },
  });
  
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }
  
  // Calculate date range for historical data
  const endDate = new Date(forecastDate);
  endDate.setDate(endDate.getDate() - 1); // Yesterday
  
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - lookbackDays);
  
  // Get historical sales data
  const salesHistory = await getDailySalesHistory(productId, startDate, endDate);
  
  // Separate clean (organic) days from event days
  const cleanDays = salesHistory.filter(d => !d.isEventDay);
  const eventDays = salesHistory.filter(d => d.isEventDay);
  
  // Calculate velocities
  const allQuantities = salesHistory.map(d => d.quantity);
  const cleanQuantities = cleanDays.map(d => d.quantity);
  
  // ==========================================================================
  // ROLLING 30-DAY VELOCITY (Critical Fix)
  // ==========================================================================
  // Problem: Dividing by # of data points inflates velocity when sales are sparse.
  // Solution: Always divide by calendar days (30), not by data point count.
  //
  // Example: 100 units sold over 60 days with 15 transaction days
  //   OLD (Wrong): 100/15 = 6.67/day (inflated!)
  //   NEW (Correct): Sum of last 30 days' sales / 30 = actual velocity
  // ==========================================================================
  
  const totalSalesIn30Days = allQuantities.reduce((a, b) => a + b, 0);
  const totalCleanSalesIn30Days = cleanQuantities.reduce((a, b) => a + b, 0);
  
  // Calculate actual calendar days in our lookback window
  const actualCalendarDays = Math.min(lookbackDays, 30);
  
  // Rolling 30-day velocity = total sales / 30 (or actual days if < 30)
  const avgDailyVelocity = actualCalendarDays > 0
    ? totalSalesIn30Days / actualCalendarDays
    : 0;
  
  // Clean velocity (organic sales only, same divisor)
  const cleanAvgDailyVelocity = actualCalendarDays > 0
    ? totalCleanSalesIn30Days / actualCalendarDays
    : avgDailyVelocity;
  
  // Calculate WMA on clean data
  const wmaBaseline = cleanQuantities.length > 0
    ? calculateWMA(cleanQuantities, WMA_WEIGHTS)
    : avgDailyVelocity;
  
  // Get YoY data for seasonality
  const yoyData = await getYoYData(productId, forecastDate);
  const yoyGrowthFactor = yoyData && yoyData.lastYearAvg > 0
    ? yoyData.thisYearAvg / yoyData.lastYearAvg
    : 1.0;
  
  // Get seasonality multiplier for forecast date
  const seasonalityFactor = getSeasonalityMultiplier(forecastDate, product.category);
  
  // Check for active events on forecast date
  let eventAdjustment = 1.0;
  let activeEvents: ActiveEvent[] = [];
  
  if (includeEventAdjustment) {
    activeEvents = await getActiveEvents(productId, forecastDate);
    
    if (activeEvents.length > 0) {
      // Apply the highest multiplier from active events
      eventAdjustment = Math.max(...activeEvents.map(e => e.multiplier));
    }
  }
  
  // Calculate final forecast
  // Baseline × Seasonality × YoY Growth × Event Adjustment
  const forecastedDailyUnits = Math.round(
    wmaBaseline * seasonalityFactor * Math.min(yoyGrowthFactor, 1.5) * eventAdjustment
  );
  
  const forecastedWeeklyUnits = forecastedDailyUnits * 7;
  
  // Calculate suggested reorder quantity
  // Target: 7 days of stock (1 week restock cycle)
  const targetDays = 7;
  const reorderLevel = product.inventory?.reorder_level ?? 10;
  const currentStock = product.inventory?.current_stock ?? 0;
  
  const targetStock = (forecastedDailyUnits * targetDays) + reorderLevel;
  let suggestedReorderQty = Math.max(0, targetStock - currentStock);
  
  // UPDATED LOGIC: Trust high-velocity data, no arbitrary hard caps
  // Rule 1: If velocity is 0 (dead stock), don't suggest reordering
  // Rule 2: Cap at 14 days supply to avoid over-ordering
  if (forecastedDailyUnits < 0.1) {
    suggestedReorderQty = 0;
  } else {
    // Only cap to prevent extreme over-ordering (14 days max supply)
    const maxByVelocity = Math.ceil(forecastedDailyUnits * 14);
    suggestedReorderQty = Math.min(suggestedReorderQty, maxByVelocity);
  }
  
  // Determine confidence level
  const hasYoYData = yoyData !== null;
  const confidence = determineConfidence(salesHistory.length, cleanDays.length, hasYoYData);
  
  // Calculate stock status
  const { status: stockStatus, daysOfStock } = calculateStockStatus(
    currentStock,
    reorderLevel,
    forecastedDailyUnits
  );
  
  // Calculate velocity trend
  const velocityTrend = calculateTrend(cleanQuantities);
  
  // Get cost price for budgeting
  const costPrice = product.cost_price ? new Decimal(product.cost_price.toString()).toNumber() : 0;
  
  return {
    productId,
    productName: product.product_name,
    barcode: product.barcode,
    category: product.category,
    costPrice,
    
    forecastedDailyUnits,
    forecastedWeeklyUnits,
    suggestedReorderQty,
    
    confidence,
    dataPoints: salesHistory.length,
    cleanDataPoints: cleanDays.length,
    
    seasonalityFactor: Math.round(seasonalityFactor * 100) / 100,
    eventAdjustment: Math.round(eventAdjustment * 100) / 100,
    activeEvents,
    
    avgDailyVelocity: Math.round(avgDailyVelocity * 10) / 10,
    cleanAvgDailyVelocity: Math.round(cleanAvgDailyVelocity * 10) / 10,
    velocityTrend,
    
    currentStock,
    reorderLevel,
    daysOfStock,
    stockStatus,
  };
}

// =============================================================================
// Batch Forecast Function
// =============================================================================

/**
 * Generate forecasts for multiple products
 */
export async function getBatchForecasts(
  productIds: number[],
  options?: Omit<ForecastInput, "productId">
): Promise<ForecastResult[]> {
  const forecasts = await Promise.all(
    productIds.map(productId =>
      getForecast({ productId, ...options }).catch(error => {
        console.error(`Forecast failed for product ${productId}:`, error);
        return null;
      })
    )
  );
  
  return forecasts.filter((f): f is ForecastResult => f !== null);
}

/**
 * Get forecasts for all active products
 * 
 * ⚡ OPTIMIZED: Uses bulk data fetching to avoid N+1 queries.
 * Pre-fetches all products, inventory, and sales data in parallel,
 * then calculates forecasts in-memory.
 */
export async function getAllProductForecasts(
  options?: Omit<ForecastInput, "productId">
): Promise<ForecastResult[]> {
  const lookbackDays = options?.lookbackDays ?? 30;
  const forecastDate = options?.forecastDate ?? new Date();
  
  // Calculate date range
  const endDate = new Date(forecastDate);
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - lookbackDays);
  
  // ⚡ Fetch ALL data in parallel (bulk queries)
  const [products, allAggregates, activeEvents] = await Promise.all([
    // 1. Get all active products with inventory
    prisma.product.findMany({
      where: { is_archived: false },
      include: { inventory: true },
    }),
    
    // 2. Get all daily aggregates for all products at once
    prisma.dailySalesAggregate.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "desc" },
    }),
    
    // 3. Get all active events
    prisma.eventLog.findMany({
      where: {
        start_date: { lte: forecastDate },
        end_date: { gte: startDate },
        is_active: true,
      },
      include: { products: true },
    }),
  ]);
  
  // Group aggregates by product_id for O(1) lookup
  const aggregatesByProduct = new Map<number, typeof allAggregates>();
  for (const agg of allAggregates) {
    const existing = aggregatesByProduct.get(agg.product_id) ?? [];
    existing.push(agg);
    aggregatesByProduct.set(agg.product_id, existing);
  }
  
  // Calculate forecasts in parallel (CPU-bound, no more DB calls)
  const forecasts = await Promise.all(
    products.map(async (product) => {
      try {
        const salesHistory = aggregatesByProduct.get(product.product_id) ?? [];
        
        // Separate clean (organic) days from event days
        const cleanDays = salesHistory.filter(d => !d.is_event_day);
        
        // Calculate velocities using calendar days (not data points)
        const actualCalendarDays = Math.min(lookbackDays, 30);
        const totalSales = salesHistory.reduce((a, b) => a + b.quantity_sold, 0);
        const cleanSales = cleanDays.reduce((a, b) => a + b.quantity_sold, 0);
        
        const avgDailyVelocity = actualCalendarDays > 0 ? totalSales / actualCalendarDays : 0;
        const cleanAvgDailyVelocity = actualCalendarDays > 0 ? cleanSales / actualCalendarDays : avgDailyVelocity;
        
        // Calculate WMA baseline
        const cleanQuantities = cleanDays.map(d => d.quantity_sold);
        const wmaBaseline = cleanQuantities.length > 0
          ? calculateWMA(cleanQuantities, WMA_WEIGHTS)
          : avgDailyVelocity;
        
        // Seasonality
        const seasonalityFactor = getSeasonalityMultiplier(forecastDate, product.category);
        
        // Check for active events
        let eventAdjustment = 1.0;
        const productEvents: ActiveEvent[] = [];
        
        for (const event of activeEvents) {
          const affectsProduct = 
            event.products.some(p => p.product_id === product.product_id) ||
            event.affected_category === product.category;
            
          if (affectsProduct && event.start_date <= forecastDate && event.end_date >= forecastDate) {
            productEvents.push({
              id: event.id,
              name: event.name,
              source: event.source,
              multiplier: new Decimal(event.multiplier.toString()).toNumber(),
              startDate: event.start_date,
              endDate: event.end_date,
            });
          }
        }
        
        if (productEvents.length > 0) {
          eventAdjustment = Math.max(...productEvents.map(e => e.multiplier));
        }
        
        // Calculate forecast
        const forecastedDailyUnits = Math.round(wmaBaseline * seasonalityFactor * eventAdjustment);
        const forecastedWeeklyUnits = forecastedDailyUnits * 7;
        
        // Stock calculations
        const currentStock = product.inventory?.current_stock ?? 0;
        const reorderLevel = product.inventory?.reorder_level ?? 10;
        
        const targetDays = 7;
        const targetStock = (forecastedDailyUnits * targetDays) + reorderLevel;
        let suggestedReorderQty = Math.max(0, targetStock - currentStock);
        
        if (forecastedDailyUnits < 0.1) {
          suggestedReorderQty = 0;
        } else {
          const maxByVelocity = Math.ceil(forecastedDailyUnits * 14);
          suggestedReorderQty = Math.min(suggestedReorderQty, maxByVelocity);
        }
        
        // Stock status
        const { status: stockStatus, daysOfStock } = calculateStockStatus(
          currentStock,
          reorderLevel,
          forecastedDailyUnits
        );
        
        // Velocity trend
        const velocityTrend = calculateTrend(cleanQuantities);
        
        // Confidence
        const confidence = determineConfidence(salesHistory.length, cleanDays.length, false);
        
        const costPrice = product.cost_price ? new Decimal(product.cost_price.toString()).toNumber() : 0;
        
        return {
          productId: product.product_id,
          productName: product.product_name,
          barcode: product.barcode,
          category: product.category,
          costPrice,
          forecastedDailyUnits,
          forecastedWeeklyUnits,
          suggestedReorderQty,
          confidence,
          dataPoints: salesHistory.length,
          cleanDataPoints: cleanDays.length,
          seasonalityFactor: Math.round(seasonalityFactor * 100) / 100,
          eventAdjustment: Math.round(eventAdjustment * 100) / 100,
          activeEvents: productEvents,
          avgDailyVelocity: Math.round(avgDailyVelocity * 10) / 10,
          cleanAvgDailyVelocity: Math.round(cleanAvgDailyVelocity * 10) / 10,
          velocityTrend,
          currentStock,
          reorderLevel,
          daysOfStock,
          stockStatus,
        } satisfies ForecastResult;
      } catch (error) {
        console.error(`Forecast failed for product ${product.product_id}:`, error);
        return null;
      }
    })
  );
  
  return forecasts.filter((f): f is ForecastResult => f !== null);
}

/**
 * Get products that need reordering based on forecasts
 */
export async function getReorderAlerts(
  options?: Omit<ForecastInput, "productId">
): Promise<ForecastResult[]> {
  const forecasts = await getAllProductForecasts(options);
  
  // Only include items that actually need restocking (have velocity > 0)
  // DEAD_STOCK items are excluded since they have no demand
  return forecasts.filter(f => 
    (f.stockStatus === "LOW" || 
    f.stockStatus === "CRITICAL" || 
    f.stockStatus === "OUT_OF_STOCK")
  ).sort((a, b) => {
    // Sort by urgency: OUT_OF_STOCK > CRITICAL > LOW
    const priority: Record<string, number> = { 
      OUT_OF_STOCK: 3, 
      CRITICAL: 2, 
      LOW: 1, 
      HEALTHY: 0,
      DEAD_STOCK: -1  // Lowest priority - should discount, not restock
    };
    return (priority[b.stockStatus] ?? 0) - (priority[a.stockStatus] ?? 0);
  });
}

// =============================================================================
// Daily Aggregation Function (for CRON job)
// =============================================================================

/**
 * Aggregate daily sales data for faster forecasting
 * Should be run daily via CRON job
 */
export async function aggregateDailySales(date?: Date): Promise<void> {
  const targetDate = date ?? new Date();
  targetDate.setHours(0, 0, 0, 0);
  
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  
  // Get all transactions for the day
  const dailyTransactions = await prisma.transactionItem.groupBy({
    by: ["product_id"],
    where: {
      transaction: {
        created_at: {
          gte: targetDate,
          lt: nextDay,
        },
        status: "COMPLETED",
      },
    },
    _sum: {
      quantity: true,
      subtotal: true,
      cost_at_sale: true,
    },
    _count: {
      transaction_id: true,
    },
  });
  
  // Get active events for this date
  const activeEvents = await prisma.eventLog.findMany({
    where: {
      start_date: { lte: targetDate },
      end_date: { gte: targetDate },
      is_active: true,
    },
    include: { products: true },
  });
  
  // Upsert aggregates
  for (const txn of dailyTransactions) {
    const quantity = txn._sum.quantity ?? 0;
    const revenue = txn._sum.subtotal ?? new Prisma.Decimal(0);
    const cost = txn._sum.cost_at_sale ?? new Prisma.Decimal(0);
    const profit = new Decimal(revenue.toString()).minus(cost.toString());
    
    // Check if product is affected by any event
    let isEventDay = false;
    let eventSource: PrismaEventSource | null = null;
    let eventId: number | null = null;
    
    for (const event of activeEvents) {
      const affectsProduct = event.products.some((p: { product_id: number }) => p.product_id === txn.product_id);
      if (affectsProduct || event.affected_category) {
        isEventDay = true;
        eventSource = event.source;
        eventId = event.id;
        break;
      }
    }
    
    await prisma.dailySalesAggregate.upsert({
      where: {
        product_id_date: {
          product_id: txn.product_id,
          date: targetDate,
        },
      },
      create: {
        product_id: txn.product_id,
        date: targetDate,
        quantity_sold: quantity,
        revenue: revenue,
        cost: cost,
        profit: new Prisma.Decimal(profit.toString()),
        transaction_count: txn._count.transaction_id,
        is_event_day: isEventDay,
        event_source: eventSource,
        event_id: eventId,
      },
      update: {
        quantity_sold: quantity,
        revenue: revenue,
        cost: cost,
        profit: new Prisma.Decimal(profit.toString()),
        transaction_count: txn._count.transaction_id,
        is_event_day: isEventDay,
        event_source: eventSource,
        event_id: eventId,
      },
    });
  }
  
  console.log(`[Forecasting] Aggregated ${dailyTransactions.length} products for ${targetDate.toISOString().split("T")[0]}`);
}

// =============================================================================
// Product Analysis Function (for Intelligence API)
// =============================================================================

export interface ProductAnalysis {
  product: {
    id: number;
    name: string;
    barcode: string | null;
    category: string;
    retailPrice: number;
    costPrice: number;
    profitMargin: number;
  };
  inventory: {
    currentStock: number;
    reorderLevel: number;
    stockStatus: string;
    daysOfStock: number;
  };
  velocity: {
    daily: number;
    weekly: number;
    monthly: number;
    trend: string;
  };
  forecast: {
    expectedDaily: number;
    expectedWeekly: number;
    suggestedReorder: number;
    confidence: string;
  };
  activeEvents: ActiveEvent[];
}

/**
 * Get comprehensive analysis for a product
 * Used by Intelligence API
 */
export async function analyzeProduct(
  identifier: string | number
): Promise<ProductAnalysis | null> {
  // Find product by ID or barcode
  const product = await prisma.product.findFirst({
    where: typeof identifier === "number"
      ? { product_id: identifier }
      : { OR: [
          { barcode: identifier },
          { product_name: { contains: identifier, mode: "insensitive" } },
        ]},
    include: { inventory: true },
  });
  
  if (!product) return null;
  
  // Get forecast
  const forecast = await getForecast({ productId: product.product_id });
  
  // Calculate profit margin
  const retailPrice = new Decimal(product.retail_price.toString()).toNumber();
  const costPrice = new Decimal(product.cost_price.toString()).toNumber();
  const profitMargin = retailPrice > 0
    ? ((retailPrice - costPrice) / retailPrice) * 100
    : 0;
  
  return {
    product: {
      id: product.product_id,
      name: product.product_name,
      barcode: product.barcode,
      category: product.category,
      retailPrice,
      costPrice,
      profitMargin: Math.round(profitMargin * 10) / 10,
    },
    inventory: {
      currentStock: forecast.currentStock,
      reorderLevel: forecast.reorderLevel,
      stockStatus: forecast.stockStatus,
      daysOfStock: forecast.daysOfStock,
    },
    velocity: {
      daily: forecast.cleanAvgDailyVelocity,
      weekly: Math.round(forecast.cleanAvgDailyVelocity * 7),
      monthly: Math.round(forecast.cleanAvgDailyVelocity * 30),
      trend: forecast.velocityTrend,
    },
    forecast: {
      expectedDaily: forecast.forecastedDailyUnits,
      expectedWeekly: forecast.forecastedWeeklyUnits,
      suggestedReorder: forecast.suggestedReorderQty,
      confidence: forecast.confidence,
    },
    activeEvents: forecast.activeEvents,
  };
}

// =============================================================================
// Dynamic Reorder Point (ROP) Calculation
// =============================================================================

export interface DynamicROPResult {
  productId: number;
  reorderPoint: number;
  isAutoCalculated: boolean;
  formula: string;
  breakdown: {
    dailyVelocity: number;
    leadTimeDays: number;
    safetyBuffer: number;
    manualLevel: number;
  };
}

/**
 * Calculate Dynamic Reorder Point
 * 
 * Formula (when auto_reorder = true AND 30+ days of sales history):
 *   SafetyBuffer = Math.ceil(Daily_Velocity * 3)  // 3 days safety buffer
 *   ROP = (Daily_Velocity * lead_time_days) + SafetyBuffer
 * 
 * CRITICAL FIX: Dead Stock Protection
 *   - If Daily_Velocity === 0, then ROP = 0 (don't suggest reordering dead items)
 *   - This prevents dead inventory from getting high reorder recommendations
 * 
 * Falls back to manual reorder_level when:
 *   - auto_reorder is FALSE
 *   - Less than 30 days of sales history (but still uses velocity-based approach if available)
 */
export async function getDynamicReorderPoint(productId: number): Promise<DynamicROPResult> {
  const product = await prisma.product.findUnique({
    where: { product_id: productId },
    include: { inventory: true },
  });

  if (!product || !product.inventory) {
    return {
      productId,
      reorderPoint: 0, // Default to 0 for unknown products
      isAutoCalculated: false,
      formula: "Default (no inventory data)",
      breakdown: {
        dailyVelocity: 0,
        leadTimeDays: 7,
        safetyBuffer: 0,
        manualLevel: 0,
      },
    };
  }

  const { inventory } = product;
  const manualLevel = inventory.reorder_level;
  const autoReorder = inventory.auto_reorder;
  const leadTimeDays = inventory.lead_time_days;

  // If auto_reorder is disabled, use manual level
  if (!autoReorder) {
    return {
      productId,
      reorderPoint: manualLevel,
      isAutoCalculated: false,
      formula: "Manual (auto_reorder disabled)",
      breakdown: {
        dailyVelocity: 0,
        leadTimeDays,
        safetyBuffer: 0,
        manualLevel,
      },
    };
  }

  // Check sales history length (need 30+ days for reliable velocity)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const salesHistory = await prisma.transactionItem.findMany({
    where: {
      product_id: productId,
      transaction: {
        created_at: { gte: thirtyDaysAgo },
        status: "COMPLETED",
      },
    },
    include: {
      transaction: { select: { created_at: true } },
    },
  });

  // Calculate days of sales history
  const uniqueDates = new Set(
    salesHistory.map((item) =>
      item.transaction.created_at.toISOString().split("T")[0]
    )
  );
  const salesHistoryLength = uniqueDates.size;

  // Calculate 30-day total quantity sold
  const totalQuantitySold = salesHistory.reduce((sum, item) => sum + item.quantity, 0);
  const dailyVelocity = totalQuantitySold / 30;

  // CRITICAL: Dead Stock Protection
  // If velocity is 0 (no sales in 30 days), ROP should be 0
  // This prevents suggesting reorders for items that don't sell
  if (dailyVelocity === 0) {
    return {
      productId,
      reorderPoint: 0, // Dead stock = no reorder
      isAutoCalculated: true,
      formula: "Zero (no sales in 30 days - dead stock)",
      breakdown: {
        dailyVelocity: 0,
        leadTimeDays,
        safetyBuffer: 0,
        manualLevel,
      },
    };
  }

  // If less than 30 days of history but has some sales, still calculate with velocity
  if (salesHistoryLength < 30) {
    // Use available velocity data, just note the limited history
    const safetyBuffer = Math.ceil(dailyVelocity * 3);
    const dynamicROP = Math.ceil((dailyVelocity * leadTimeDays) + safetyBuffer);
    
    return {
      productId,
      reorderPoint: dynamicROP,
      isAutoCalculated: true,
      formula: `Limited history (${salesHistoryLength} days): (${dailyVelocity.toFixed(1)}/day × ${leadTimeDays}d) + ${safetyBuffer} safety`,
      breakdown: {
        dailyVelocity: Math.round(dailyVelocity * 10) / 10,
        leadTimeDays,
        safetyBuffer,
        manualLevel,
      },
    };
  }

  // Dynamic ROP Formula:
  // SafetyBuffer = ceil(Daily_Velocity * 3)  -- 3 days of safety stock
  // ROP = (Daily_Velocity * lead_time_days) + SafetyBuffer
  const safetyBuffer = Math.ceil(dailyVelocity * 3);
  const dynamicROP = Math.ceil((dailyVelocity * leadTimeDays) + safetyBuffer);

  return {
    productId,
    reorderPoint: dynamicROP,
    isAutoCalculated: true,
    formula: `(${dailyVelocity.toFixed(1)}/day × ${leadTimeDays}d) + ${safetyBuffer} safety`,
    breakdown: {
      dailyVelocity: Math.round(dailyVelocity * 10) / 10,
      leadTimeDays,
      safetyBuffer,
      manualLevel,
    },
  };
}

/**
 * Batch calculate dynamic reorder points for all products
 * Useful for inventory reports and bulk analysis
 */
export async function getAllDynamicReorderPoints(): Promise<Map<number, DynamicROPResult>> {
  const products = await prisma.product.findMany({
    where: { is_archived: false },
    include: { inventory: true },
    orderBy: { product_name: "asc" },
  });

  const results = new Map<number, DynamicROPResult>();

  for (const product of products) {
    const rop = await getDynamicReorderPoint(product.product_id);
    results.set(product.product_id, rop);
  }

  return results;
}

