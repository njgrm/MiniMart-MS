"use server";

import { prisma } from "@/lib/db";
import { Prisma, StockMovementType } from "@prisma/client";
import { startOfDay, endOfDay, subDays, format } from "date-fns";

// ============================================================================
// Types
// ============================================================================

export interface DateRangeInput {
  from: Date;
  to: Date;
}

// --- Spoilage & Wastage Report ---
export interface SpoilageItem {
  product_id: number;
  product_name: string;
  category: string;
  barcode: string | null;
  movement_type: StockMovementType;
  quantity_lost: number; // Absolute value (positive)
  cost_price: number;
  estimated_loss: number; // quantity * cost
  reason: string | null;
  supplier_name: string | null;
  logged_by: string;
  logged_at: Date;
}

export interface SpoilageReportResult {
  items: SpoilageItem[];
  summary: {
    total_items: number;
    total_units_lost: number;
    total_estimated_loss: number;
    by_type: Record<string, { count: number; units: number; loss: number }>;
  };
}

// --- Dead Stock / Inventory Velocity Report ---
export interface VelocityItem {
  product_id: number;
  product_name: string;
  category: string;
  barcode: string | null;
  current_stock: number;
  cost_price: number;
  retail_price: number;
  units_sold_30d: number;
  daily_velocity: number; // units_sold_30d / 30
  days_of_supply: number; // current_stock / daily_velocity (or Infinity)
  status: "dead_stock" | "slow_mover" | "moderate" | "fast_mover";
  last_sale_date: Date | null;
  capital_tied: number; // current_stock * cost_price
}

export interface VelocityReportResult {
  items: VelocityItem[];
  summary: {
    total_products: number;
    dead_stock_count: number;
    dead_stock_capital: number;
    slow_mover_count: number;
    slow_mover_capital: number;
    fast_mover_count: number;
    total_capital_tied: number;
  };
}

// --- Z-Read History ---
export interface ZReadRecord {
  date: Date;
  transaction_count: number;
  gross_sales: number;
  total_cost: number;
  gross_profit: number;
  cash_sales: number;
  gcash_sales: number;
  void_count: number;
  void_amount: number;
  closed_by: string | null;
}

export interface ZReadHistoryResult {
  records: ZReadRecord[];
  summary: {
    total_days: number;
    total_transactions: number;
    total_gross_sales: number;
    total_profit: number;
    avg_daily_sales: number;
  };
}

// --- Profit Margin Analysis ---
export interface MarginItem {
  product_id: number;
  product_name: string;
  category: string;
  barcode: string | null;
  cost_price: number;
  retail_price: number;
  margin_amount: number; // retail - cost
  margin_percent: number; // ((retail - cost) / retail) * 100
  units_sold_30d: number;
  total_profit_30d: number;
  status: "negative" | "low" | "moderate" | "healthy";
}

export interface MarginReportResult {
  items: MarginItem[];
  summary: {
    total_products: number;
    negative_margin_count: number;
    low_margin_count: number;
    avg_margin_percent: number;
    total_potential_profit: number;
  };
}

// ============================================================================
// Report Functions
// ============================================================================

/**
 * Get Spoilage & Wastage Report
 * Queries StockMovement where type is DAMAGE, SUPPLIER_RETURN, or ADJUSTMENT (negative)
 * Critical for proving FEFO system captures loss and for insurance/audit purposes
 */
export async function getSpoilageReport(
  dateRange?: DateRangeInput
): Promise<SpoilageReportResult> {
  const from = dateRange?.from ?? subDays(new Date(), 30);
  const to = dateRange?.to ?? new Date();

  // Wastage movement types
  const wastageTypes: StockMovementType[] = [
    "DAMAGE",
    "SUPPLIER_RETURN",
  ];

  const movements = await prisma.stockMovement.findMany({
    where: {
      movement_type: { in: wastageTypes },
      created_at: {
        gte: startOfDay(from),
        lte: endOfDay(to),
      },
      quantity_change: { lt: 0 }, // Only negative (stock removed)
    },
    include: {
      inventory: {
        include: {
          product: true,
        },
      },
      user: {
        select: { username: true },
      },
    },
    orderBy: { created_at: "desc" },
  });

  const items: SpoilageItem[] = movements.map((m) => {
    const product = m.inventory.product;
    const quantityLost = Math.abs(m.quantity_change);
    const costPrice = m.cost_price ? Number(m.cost_price) : Number(product.cost_price) || 0;
    
    return {
      product_id: product.product_id,
      product_name: product.product_name,
      category: product.category,
      barcode: product.barcode,
      movement_type: m.movement_type,
      quantity_lost: quantityLost,
      cost_price: costPrice,
      estimated_loss: quantityLost * costPrice,
      reason: m.reason,
      supplier_name: m.supplier_name,
      logged_by: m.user.username,
      logged_at: m.created_at,
    };
  });

  // Build summary by type
  const byType: Record<string, { count: number; units: number; loss: number }> = {};
  for (const item of items) {
    const type = item.movement_type;
    if (!byType[type]) {
      byType[type] = { count: 0, units: 0, loss: 0 };
    }
    byType[type].count += 1;
    byType[type].units += item.quantity_lost;
    byType[type].loss += item.estimated_loss;
  }

  return {
    items,
    summary: {
      total_items: items.length,
      total_units_lost: items.reduce((sum, i) => sum + i.quantity_lost, 0),
      total_estimated_loss: items.reduce((sum, i) => sum + i.estimated_loss, 0),
      by_type: byType,
    },
  };
}

/**
 * Get Inventory Velocity Report (Dead Stock vs Fast Movers)
 * Crucial for Dynamic ROP logic defense - identifies products with no movement
 * Uses DailySalesAggregate for consistent velocity calculation
 */
export async function getVelocityReport(): Promise<VelocityReportResult> {
  const thirtyDaysAgo = subDays(new Date(), 30);

  // Get all active products with inventory
  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
    },
    include: {
      inventory: true,
    },
  });

  // Get 30-day sales aggregates for all products
  const salesAggregates = await prisma.dailySalesAggregate.findMany({
    where: {
      date: { gte: thirtyDaysAgo },
    },
    select: {
      product_id: true,
      quantity_sold: true,
      date: true,
    },
  });

  // Build a map of product_id -> { total_sold, last_sale_date }
  const salesMap = new Map<number, { totalSold: number; lastSale: Date | null }>();
  for (const agg of salesAggregates) {
    const existing = salesMap.get(agg.product_id);
    if (existing) {
      existing.totalSold += agg.quantity_sold;
      if (!existing.lastSale || agg.date > existing.lastSale) {
        existing.lastSale = agg.date;
      }
    } else {
      salesMap.set(agg.product_id, {
        totalSold: agg.quantity_sold,
        lastSale: agg.date,
      });
    }
  }

  const items: VelocityItem[] = products.map((p) => {
    const currentStock = p.inventory?.current_stock ?? 0;
    const costPrice = Number(p.cost_price) || 0;
    const retailPrice = Number(p.retail_price);
    const sales = salesMap.get(p.product_id);
    const unitsSold30d = sales?.totalSold ?? 0;
    const dailyVelocity = unitsSold30d / 30;
    const daysOfSupply = dailyVelocity > 0 ? currentStock / dailyVelocity : Infinity;

    // Classify status
    let status: VelocityItem["status"];
    if (unitsSold30d === 0) {
      status = "dead_stock";
    } else if (dailyVelocity < 0.5) {
      status = "slow_mover";
    } else if (dailyVelocity < 2) {
      status = "moderate";
    } else {
      status = "fast_mover";
    }

    return {
      product_id: p.product_id,
      product_name: p.product_name,
      category: p.category,
      barcode: p.barcode,
      current_stock: currentStock,
      cost_price: costPrice,
      retail_price: retailPrice,
      units_sold_30d: unitsSold30d,
      daily_velocity: Math.round(dailyVelocity * 100) / 100,
      days_of_supply: daysOfSupply === Infinity ? 999 : Math.round(daysOfSupply),
      status,
      last_sale_date: sales?.lastSale ?? null,
      capital_tied: currentStock * costPrice,
    };
  });

  // Sort: dead stock first, then by capital tied (descending)
  items.sort((a, b) => {
    const statusOrder = { dead_stock: 0, slow_mover: 1, moderate: 2, fast_mover: 3 };
    const orderDiff = statusOrder[a.status] - statusOrder[b.status];
    if (orderDiff !== 0) return orderDiff;
    return b.capital_tied - a.capital_tied;
  });

  // Calculate summary
  const deadStock = items.filter((i) => i.status === "dead_stock");
  const slowMovers = items.filter((i) => i.status === "slow_mover");
  const fastMovers = items.filter((i) => i.status === "fast_mover");

  return {
    items,
    summary: {
      total_products: items.length,
      dead_stock_count: deadStock.length,
      dead_stock_capital: deadStock.reduce((sum, i) => sum + i.capital_tied, 0),
      slow_mover_count: slowMovers.length,
      slow_mover_capital: slowMovers.reduce((sum, i) => sum + i.capital_tied, 0),
      fast_mover_count: fastMovers.length,
      total_capital_tied: items.reduce((sum, i) => sum + i.capital_tied, 0),
    },
  };
}

/**
 * Get Z-Read History Report
 * Aggregates daily transaction summaries for each business day
 * Provides closure/end-of-day reporting data
 */
export async function getZReadHistory(
  dateRange?: DateRangeInput
): Promise<ZReadHistoryResult> {
  const from = dateRange?.from ?? subDays(new Date(), 30);
  const to = dateRange?.to ?? new Date();

  // Get all transactions in range grouped by date
  const transactions = await prisma.transaction.findMany({
    where: {
      created_at: {
        gte: startOfDay(from),
        lte: endOfDay(to),
      },
    },
    include: {
      payment: true,
      items: true,
      user: { select: { username: true } },
    },
    orderBy: { created_at: "asc" },
  });

  // Group transactions by date
  const dailyGroups = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const dateKey = format(tx.created_at, "yyyy-MM-dd");
    if (!dailyGroups.has(dateKey)) {
      dailyGroups.set(dateKey, []);
    }
    dailyGroups.get(dateKey)!.push(tx);
  }

  const records: ZReadRecord[] = [];

  for (const [dateKey, dayTransactions] of dailyGroups) {
    const completedTxs = dayTransactions.filter((tx) => tx.status === "COMPLETED");
    const voidedTxs = dayTransactions.filter((tx) => tx.status === "VOID" || tx.status === "CANCELLED");

    const grossSales = completedTxs.reduce((sum, tx) => sum + Number(tx.total_amount), 0);
    
    // Calculate total cost from transaction items
    const totalCost = completedTxs.reduce((sum, tx) => {
      const txCost = tx.items.reduce((itemSum, item) => {
        return itemSum + Number(item.cost_at_sale) * item.quantity;
      }, 0);
      return sum + txCost;
    }, 0);

    const cashSales = completedTxs
      .filter((tx) => tx.payment?.payment_method === "CASH")
      .reduce((sum, tx) => sum + Number(tx.total_amount), 0);

    const gcashSales = completedTxs
      .filter((tx) => tx.payment?.payment_method === "GCASH")
      .reduce((sum, tx) => sum + Number(tx.total_amount), 0);

    const voidAmount = voidedTxs.reduce((sum, tx) => sum + Number(tx.total_amount), 0);

    // Get the last cashier who processed a transaction that day
    const lastTx = dayTransactions[dayTransactions.length - 1];
    const closedBy = lastTx?.user?.username ?? null;

    records.push({
      date: new Date(dateKey),
      transaction_count: completedTxs.length,
      gross_sales: grossSales,
      total_cost: totalCost,
      gross_profit: grossSales - totalCost,
      cash_sales: cashSales,
      gcash_sales: gcashSales,
      void_count: voidedTxs.length,
      void_amount: voidAmount,
      closed_by: closedBy,
    });
  }

  // Sort by date descending (most recent first)
  records.sort((a, b) => b.date.getTime() - a.date.getTime());

  const totalGrossSales = records.reduce((sum, r) => sum + r.gross_sales, 0);
  const totalProfit = records.reduce((sum, r) => sum + r.gross_profit, 0);
  const totalTransactions = records.reduce((sum, r) => sum + r.transaction_count, 0);

  return {
    records,
    summary: {
      total_days: records.length,
      total_transactions: totalTransactions,
      total_gross_sales: totalGrossSales,
      total_profit: totalProfit,
      avg_daily_sales: records.length > 0 ? totalGrossSales / records.length : 0,
    },
  };
}

/**
 * Get Profit Margin Analysis Report
 * Compares cost vs retail price and highlights low-margin items
 * Helps identify pricing issues and optimize profitability
 */
export async function getMarginAnalysis(): Promise<MarginReportResult> {
  const thirtyDaysAgo = subDays(new Date(), 30);

  // Get all active products
  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
    },
  });

  // Get 30-day sales for profit calculation
  const salesAggregates = await prisma.dailySalesAggregate.findMany({
    where: {
      date: { gte: thirtyDaysAgo },
    },
    select: {
      product_id: true,
      quantity_sold: true,
      profit: true,
    },
  });

  // Map product_id -> { units_sold, total_profit }
  const salesMap = new Map<number, { unitsSold: number; totalProfit: number }>();
  for (const agg of salesAggregates) {
    const existing = salesMap.get(agg.product_id);
    if (existing) {
      existing.unitsSold += agg.quantity_sold;
      existing.totalProfit += Number(agg.profit);
    } else {
      salesMap.set(agg.product_id, {
        unitsSold: agg.quantity_sold,
        totalProfit: Number(agg.profit),
      });
    }
  }

  const items: MarginItem[] = products.map((p) => {
    const costPrice = Number(p.cost_price) || 0;
    const retailPrice = Number(p.retail_price);
    const marginAmount = retailPrice - costPrice;
    const marginPercent = retailPrice > 0 ? (marginAmount / retailPrice) * 100 : 0;

    const sales = salesMap.get(p.product_id);
    const unitsSold30d = sales?.unitsSold ?? 0;
    const totalProfit30d = sales?.totalProfit ?? 0;

    // Classify margin status
    let status: MarginItem["status"];
    if (marginPercent < 0) {
      status = "negative";
    } else if (marginPercent < 10) {
      status = "low";
    } else if (marginPercent < 25) {
      status = "moderate";
    } else {
      status = "healthy";
    }

    return {
      product_id: p.product_id,
      product_name: p.product_name,
      category: p.category,
      barcode: p.barcode,
      cost_price: costPrice,
      retail_price: retailPrice,
      margin_amount: Math.round(marginAmount * 100) / 100,
      margin_percent: Math.round(marginPercent * 10) / 10,
      units_sold_30d: unitsSold30d,
      total_profit_30d: Math.round(totalProfit30d * 100) / 100,
      status,
    };
  });

  // Sort: negative first, then low, then by margin percent ascending
  items.sort((a, b) => {
    const statusOrder = { negative: 0, low: 1, moderate: 2, healthy: 3 };
    const orderDiff = statusOrder[a.status] - statusOrder[b.status];
    if (orderDiff !== 0) return orderDiff;
    return a.margin_percent - b.margin_percent;
  });

  const negativeMargin = items.filter((i) => i.status === "negative");
  const lowMargin = items.filter((i) => i.status === "low");
  const avgMargin = items.length > 0
    ? items.reduce((sum, i) => sum + i.margin_percent, 0) / items.length
    : 0;

  return {
    items,
    summary: {
      total_products: items.length,
      negative_margin_count: negativeMargin.length,
      low_margin_count: lowMargin.length,
      avg_margin_percent: Math.round(avgMargin * 10) / 10,
      total_potential_profit: items.reduce((sum, i) => sum + i.total_profit_30d, 0),
    },
  };
}

// ============================================================================
// Utility: Export data to Excel format
// ============================================================================

// --- Sales by Category Report ---
export interface CategorySalesItem {
  category: string;
  product_count: number;
  units_sold_30d: number;
  revenue_30d: number;
  cost_30d: number;
  profit_30d: number;
  margin_percent: number;
  revenue_share: number; // Percentage of total revenue
}

export interface CategorySalesResult {
  items: CategorySalesItem[];
  summary: {
    total_categories: number;
    total_revenue: number;
    total_profit: number;
    avg_margin: number;
  };
}

/**
 * Get Sales by Category Report
 * Aggregates sales data by product category for the last 30 days
 * Shows revenue distribution and profit contribution by category
 */
export async function getSalesByCategory(): Promise<CategorySalesResult> {
  const thirtyDaysAgo = subDays(new Date(), 30);

  // Get all active products with their categories
  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
    },
    select: {
      product_id: true,
      category: true,
    },
  });

  // Build product_id -> category map AND category -> product_ids map
  const productCategoryMap = new Map<number, string>();
  const categoryProducts = new Map<string, number[]>();
  for (const p of products) {
    productCategoryMap.set(p.product_id, p.category);
    const existing = categoryProducts.get(p.category) ?? [];
    existing.push(p.product_id);
    categoryProducts.set(p.category, existing);
  }

  // Get 30-day sales aggregates
  const salesAggregates = await prisma.dailySalesAggregate.findMany({
    where: {
      date: { gte: thirtyDaysAgo },
    },
    select: {
      product_id: true,
      quantity_sold: true,
      revenue: true,
      cost: true,
      profit: true,
    },
  });

  // Aggregate by category
  const categoryStats = new Map<string, {
    units: number;
    revenue: number;
    cost: number;
    profit: number;
  }>();

  for (const agg of salesAggregates) {
    const category = productCategoryMap.get(agg.product_id);
    if (!category) continue; // Skip if product not found or inactive
    
    const existing = categoryStats.get(category) ?? { units: 0, revenue: 0, cost: 0, profit: 0 };
    existing.units += agg.quantity_sold;
    existing.revenue += Number(agg.revenue);
    existing.cost += Number(agg.cost);
    existing.profit += Number(agg.profit);
    categoryStats.set(category, existing);
  }

  // Calculate total revenue for share calculation
  const totalRevenue = Array.from(categoryStats.values()).reduce((sum, s) => sum + s.revenue, 0);
  const totalProfit = Array.from(categoryStats.values()).reduce((sum, s) => sum + s.profit, 0);

  // Build items array
  const items: CategorySalesItem[] = [];

  for (const [category, productIds] of categoryProducts) {
    const stats = categoryStats.get(category) ?? { units: 0, revenue: 0, cost: 0, profit: 0 };
    const marginPercent = stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0;
    const revenueShare = totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0;

    items.push({
      category,
      product_count: productIds.length,
      units_sold_30d: stats.units,
      revenue_30d: Math.round(stats.revenue * 100) / 100,
      cost_30d: Math.round(stats.cost * 100) / 100,
      profit_30d: Math.round(stats.profit * 100) / 100,
      margin_percent: Math.round(marginPercent * 10) / 10,
      revenue_share: Math.round(revenueShare * 10) / 10,
    });
  }

  // Sort by revenue descending
  items.sort((a, b) => b.revenue_30d - a.revenue_30d);

  // Calculate average margin
  const avgMargin = items.length > 0
    ? items.reduce((sum, i) => sum + i.margin_percent, 0) / items.length
    : 0;

  return {
    items,
    summary: {
      total_categories: items.length,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_profit: Math.round(totalProfit * 100) / 100,
      avg_margin: Math.round(avgMargin * 10) / 10,
    },
  };
}

// --- Expiring Products Report ---
export interface ExpiringItem {
  product_id: number;
  product_name: string;
  category: string;
  barcode: string | null;
  batch_id: number;
  batch_number: string | null;
  quantity: number;
  expiry_date: Date;
  days_until_expiry: number;
  cost_price: number;
  value_at_risk: number; // quantity * cost_price
  urgency: "expired" | "critical" | "warning" | "caution";
  supplier_name: string | null;
}

export interface ExpiringReportResult {
  items: ExpiringItem[];
  summary: {
    total_batches: number;
    total_units_at_risk: number;
    total_value_at_risk: number;
    expired_count: number;
    critical_count: number; // 7 days
    warning_count: number;  // 14 days
    caution_count: number;  // 30 days
  };
}

/**
 * Get Expiring Products Report
 * Tracks products with batches expiring within 7, 14, and 30 days
 * Critical for FEFO compliance and proactive inventory management
 */
export async function getExpiringReport(): Promise<ExpiringReportResult> {
  const today = startOfDay(new Date());
  const thirtyDaysFromNow = subDays(today, -30); // 30 days in the future

  // Get all batches expiring within 30 days (including already expired)
  const batches = await prisma.inventoryBatch.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      quantity: { gt: 0 },
      expiry_date: {
        lte: thirtyDaysFromNow,
      },
    },
    include: {
      product: true,
    },
    orderBy: {
      expiry_date: "asc",
    },
  });

  const items: ExpiringItem[] = batches.map((batch) => {
    const product = batch.product;
    const expiryDate = batch.expiry_date ? new Date(batch.expiry_date) : today;
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    const costPrice = Number(batch.cost_price) || Number(product.cost_price) || 0;
    const valueAtRisk = batch.quantity * costPrice;

    // Classify urgency
    let urgency: ExpiringItem["urgency"];
    if (daysUntilExpiry <= 0) {
      urgency = "expired";
    } else if (daysUntilExpiry <= 7) {
      urgency = "critical";
    } else if (daysUntilExpiry <= 14) {
      urgency = "warning";
    } else {
      urgency = "caution";
    }

    return {
      product_id: product.product_id,
      product_name: product.product_name,
      category: product.category,
      barcode: product.barcode,
      batch_id: batch.id,
      batch_number: batch.supplier_ref,
      quantity: batch.quantity,
      expiry_date: expiryDate,
      days_until_expiry: daysUntilExpiry,
      cost_price: costPrice,
      value_at_risk: valueAtRisk,
      urgency,
      supplier_name: batch.supplier_name,
    };
  });

  // Calculate summary
  const expired = items.filter((i) => i.urgency === "expired");
  const critical = items.filter((i) => i.urgency === "critical");
  const warning = items.filter((i) => i.urgency === "warning");
  const caution = items.filter((i) => i.urgency === "caution");

  return {
    items,
    summary: {
      total_batches: items.length,
      total_units_at_risk: items.reduce((sum, i) => sum + i.quantity, 0),
      total_value_at_risk: items.reduce((sum, i) => sum + i.value_at_risk, 0),
      expired_count: expired.length,
      critical_count: critical.length,
      warning_count: warning.length,
      caution_count: caution.length,
    },
  };
}

// ============================================================================
// Dashboard Summary Actions (Lightweight metrics for Reports landing page)
// ============================================================================

export interface DashboardSummary {
  deadStockCount: number;
  deadStockCapital: number;
  spoilageLossThisMonth: number;
  lastZReadDate: Date | null;
  lastZReadAmount: number;
  expiringCriticalCount: number;
}

/**
 * Get lightweight summary data for the Reports dashboard
 * Optimized for fast loading - only fetches aggregate counts
 */
export async function getReportsDashboardSummary(): Promise<DashboardSummary> {
  const thirtyDaysAgo = subDays(new Date(), 30);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const today = startOfDay(new Date());
  const sevenDaysFromNow = subDays(today, -7);

  // Run all queries in parallel for speed
  const [
    deadStockData,
    spoilageData,
    lastZRead,
    expiringData,
  ] = await Promise.all([
    // Dead stock count and capital - using Prisma for safety
    (async () => {
      // Get products with no sales in last 30 days
      const salesProductIds = await prisma.dailySalesAggregate.findMany({
        where: { date: { gte: thirtyDaysAgo } },
        select: { product_id: true },
        distinct: ['product_id'],
      });
      const productIdsWithSales = new Set(salesProductIds.map(s => s.product_id));
      
      const products = await prisma.product.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
        },
        include: { inventory: true },
      });
      
      let count = 0;
      let capital = 0;
      for (const p of products) {
        const stock = p.inventory?.current_stock ?? 0;
        if (stock > 0 && !productIdsWithSales.has(p.product_id)) {
          count++;
          capital += stock * Number(p.cost_price || 0);
        }
      }
      return { count, capital };
    })(),
    
    // Spoilage loss this month
    prisma.stockMovement.aggregate({
      where: {
        movement_type: { in: ["DAMAGE", "SUPPLIER_RETURN"] },
        quantity_change: { lt: 0 },
        created_at: { gte: startOfMonth },
      },
      _sum: {
        quantity_change: true,
      },
    }),
    
    // Last Z-Read (most recent completed transaction date)
    prisma.transaction.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { created_at: "desc" },
      select: { created_at: true, total_amount: true },
    }),
    
    // Critical expiring items (within 7 days) - use 'quantity' not 'current_quantity'
    prisma.inventoryBatch.count({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        quantity: { gt: 0 },
        expiry_date: {
          lte: sevenDaysFromNow,
        },
      },
    }),
  ]);

  // Calculate spoilage loss - need to get costs
  let spoilageLoss = 0;
  if (spoilageData._sum.quantity_change) {
    const movements = await prisma.stockMovement.findMany({
      where: {
        movement_type: { in: ["DAMAGE", "SUPPLIER_RETURN"] },
        quantity_change: { lt: 0 },
        created_at: { gte: startOfMonth },
      },
      include: {
        inventory: {
          include: { product: true },
        },
      },
    });
    
    spoilageLoss = movements.reduce((sum, m) => {
      const cost = Number(m.cost_price) || Number(m.inventory.product.cost_price) || 0;
      return sum + Math.abs(m.quantity_change) * cost;
    }, 0);
  }

  return {
    deadStockCount: deadStockData.count,
    deadStockCapital: Math.round(deadStockData.capital * 100) / 100,
    spoilageLossThisMonth: Math.round(spoilageLoss * 100) / 100,
    lastZReadDate: lastZRead?.created_at ?? null,
    lastZReadAmount: lastZRead ? Number(lastZRead.total_amount) : 0,
    expiringCriticalCount: expiringData,
  };
}

// ============================================================================
// Enhanced Dashboard Data (Live Widgets for Reports Shell)
// ============================================================================

export interface TodaySnapshot {
  date: Date;
  transactionCount: number;
  grossSales: number;
  grossProfit: number;
  cashSales: number;
  gcashSales: number;
  voidCount: number;
  voidAmount: number;
  avgTicket: number;
  // Comparison with same day last week
  salesChangePercent: number;
  profitChangePercent: number;
}

export interface SalesSparklineData {
  date: string; // ISO date
  revenue: number;
  profit: number;
}

export interface TopCategoryData {
  category: string;
  revenue: number;
  percent: number;
}

export interface TopDeadStockItem {
  productId: number;
  productName: string;
  daysWithoutSale: number;
  capitalTied: number;
}

export interface InventoryHealthData {
  healthyPercent: number;
  deadStockCount: number;
  slowMoverCount: number;
  fastMoverCount: number;
  totalProducts: number;
}

export interface EnhancedDashboardData {
  // Today's live Z-Read data
  todaySnapshot: TodaySnapshot | null;
  // Last 7 days of sales for sparkline
  salesSparkline: SalesSparklineData[];
  // Top 3 categories by revenue (last 30 days)
  topCategories: TopCategoryData[];
  // Top 3 dead stock items by capital tied
  topDeadStock: TopDeadStockItem[];
  // Inventory health summary
  inventoryHealth: InventoryHealthData;
  // Existing summary data
  spoilageLossThisMonth: number;
  expiringCriticalCount: number;
  lastZReadDate: Date | null;
}

/**
 * Get comprehensive dashboard data for live widgets
 * This powers the "Command Center" view of the Reports shell
 */
export async function getEnhancedDashboardData(): Promise<EnhancedDashboardData> {
  const today = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const sevenDaysAgo = subDays(today, 7);
  const thirtyDaysAgo = subDays(today, 30);
  const sameDayLastWeek = subDays(today, 7);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const sevenDaysFromNow = subDays(today, -7);

  // Run all queries in parallel
  const [
    todayTransactions,
    lastWeekSameDayTransactions,
    last7DaysSales,
    top3Categories,
    inventoryHealthData,
    spoilageData,
    expiringData,
    lastZRead,
  ] = await Promise.all([
    // Today's transactions with payment info
    prisma.transaction.findMany({
      where: {
        status: "COMPLETED",
        created_at: { gte: today, lte: todayEnd },
      },
      select: {
        total_amount: true,
        payment: {
          select: { payment_method: true },
        },
      },
    }),

    // Same day last week for comparison
    prisma.transaction.findMany({
      where: {
        status: "COMPLETED",
        created_at: { 
          gte: startOfDay(sameDayLastWeek), 
          lte: endOfDay(sameDayLastWeek) 
        },
      },
      select: { total_amount: true },
    }),

    // Last 7 days sales aggregates for sparkline
    prisma.dailySalesAggregate.groupBy({
      by: ['date'],
      where: {
        date: { gte: sevenDaysAgo },
      },
      _sum: {
        revenue: true,
        profit: true,
      },
      orderBy: { date: 'asc' },
    }),

    // Top 3 categories by revenue (last 30 days) - need to aggregate manually
    (async () => {
      // Get sales data
      const salesData = await prisma.dailySalesAggregate.findMany({
        where: { date: { gte: thirtyDaysAgo } },
        select: { product_id: true, revenue: true },
      });
      
      // Get products for category info
      const productIds = [...new Set(salesData.map(s => s.product_id))];
      const products = await prisma.product.findMany({
        where: { product_id: { in: productIds } },
        select: { product_id: true, category: true },
      });
      const productMap = new Map(products.map(p => [p.product_id, p.category]));
      
      // Group by category
      const categoryMap = new Map<string, number>();
      for (const sale of salesData) {
        const cat = productMap.get(sale.product_id) || "Uncategorized";
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(sale.revenue));
      }
      
      // Sort and take top 3
      return Array.from(categoryMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category, revenue]) => ({ category, revenue }));
    })(),

    // Inventory health - get all products with sales data
    (async () => {
      const salesProductIds = await prisma.dailySalesAggregate.findMany({
        where: { date: { gte: thirtyDaysAgo } },
        select: { product_id: true },
        distinct: ['product_id'],
      });
      const productIdsWithSales = new Set(salesProductIds.map(s => s.product_id));

      const products = await prisma.product.findMany({
        where: { deletedAt: null, status: "ACTIVE" },
        include: { inventory: true },
      });

      let deadStock = 0, slowMover = 0, fastMover = 0, healthy = 0;
      const deadStockItems: { productId: number; productName: string; daysWithoutSale: number; capitalTied: number }[] = [];

      for (const p of products) {
        const stock = p.inventory?.current_stock ?? 0;
        if (stock <= 0) continue;
        
        if (!productIdsWithSales.has(p.product_id)) {
          deadStock++;
          deadStockItems.push({
            productId: p.product_id,
            productName: p.product_name,
            daysWithoutSale: 30,
            capitalTied: stock * Number(p.cost_price || 0),
          });
        } else {
          // Get 30d sales for this product
          const sales = await prisma.dailySalesAggregate.aggregate({
            where: { product_id: p.product_id, date: { gte: thirtyDaysAgo } },
            _sum: { quantity_sold: true },
          });
          const velocity = (sales._sum.quantity_sold || 0) / 30;
          
          if (velocity < 0.1) slowMover++;
          else if (velocity > 2) fastMover++;
          else healthy++;
        }
      }

      // Sort dead stock by capital tied and take top 3
      const topDeadStock = deadStockItems
        .sort((a, b) => b.capitalTied - a.capitalTied)
        .slice(0, 3);

      return {
        deadStock,
        slowMover,
        fastMover,
        healthy,
        total: products.filter(p => (p.inventory?.current_stock ?? 0) > 0).length,
        topDeadStock,
      };
    })(),

    // Spoilage this month
    prisma.stockMovement.findMany({
      where: {
        movement_type: { in: ["DAMAGE", "SUPPLIER_RETURN"] },
        quantity_change: { lt: 0 },
        created_at: { gte: startOfMonth },
      },
      include: { inventory: { include: { product: true } } },
    }),

    // Critical expiring items
    prisma.inventoryBatch.count({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        quantity: { gt: 0 },
        expiry_date: { lte: sevenDaysFromNow },
      },
    }),

    // Last transaction date
    prisma.transaction.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    }),
  ]);

  // Calculate today's snapshot
  let todaySnapshot: TodaySnapshot | null = null;
  if (todayTransactions.length > 0) {
    const grossSales = todayTransactions.reduce((sum, t) => sum + Number(t.total_amount), 0);
    const cashSales = todayTransactions
      .filter(t => t.payment?.payment_method === "CASH")
      .reduce((sum, t) => sum + Number(t.total_amount), 0);
    const gcashSales = todayTransactions
      .filter(t => t.payment?.payment_method === "GCASH")
      .reduce((sum, t) => sum + Number(t.total_amount), 0);
    
    const lastWeekSales = lastWeekSameDayTransactions.reduce((sum, t) => sum + Number(t.total_amount), 0);
    const salesChangePercent = lastWeekSales > 0 
      ? Math.round(((grossSales - lastWeekSales) / lastWeekSales) * 100)
      : 0;

    // Estimate profit (typically ~10-15% margin)
    const grossProfit = grossSales * 0.12; // Rough estimate

    todaySnapshot = {
      date: today,
      transactionCount: todayTransactions.length,
      grossSales: Math.round(grossSales * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      cashSales: Math.round(cashSales * 100) / 100,
      gcashSales: Math.round(gcashSales * 100) / 100,
      voidCount: 0, // Would need void transaction tracking
      voidAmount: 0,
      avgTicket: Math.round((grossSales / todayTransactions.length) * 100) / 100,
      salesChangePercent,
      profitChangePercent: salesChangePercent, // Same for now
    };
  }

  // Build sparkline data
  const salesSparkline: SalesSparklineData[] = last7DaysSales.map(day => ({
    date: format(day.date, 'yyyy-MM-dd'),
    revenue: Number(day._sum.revenue) || 0,
    profit: Number(day._sum.profit) || 0,
  }));

  // Calculate total revenue for percentage
  const totalCategoryRevenue = top3Categories.reduce((sum, c) => sum + c.revenue, 0);
  
  // Build top categories
  const topCategories: TopCategoryData[] = top3Categories.map(c => ({
    category: c.category || 'Unknown',
    revenue: c.revenue,
    percent: totalCategoryRevenue > 0 
      ? Math.round(c.revenue / totalCategoryRevenue * 100)
      : 0,
  }));

  // Calculate spoilage loss
  const spoilageLoss = spoilageData.reduce((sum, m) => {
    const cost = Number(m.cost_price) || Number(m.inventory.product.cost_price) || 0;
    return sum + Math.abs(m.quantity_change) * cost;
  }, 0);

  // Inventory health
  const inventoryHealth: InventoryHealthData = {
    healthyPercent: inventoryHealthData.total > 0
      ? Math.round(((inventoryHealthData.healthy + inventoryHealthData.fastMover) / inventoryHealthData.total) * 100)
      : 100,
    deadStockCount: inventoryHealthData.deadStock,
    slowMoverCount: inventoryHealthData.slowMover,
    fastMoverCount: inventoryHealthData.fastMover,
    totalProducts: inventoryHealthData.total,
  };

  return {
    todaySnapshot,
    salesSparkline,
    topCategories,
    topDeadStock: inventoryHealthData.topDeadStock,
    inventoryHealth,
    spoilageLossThisMonth: Math.round(spoilageLoss * 100) / 100,
    expiringCriticalCount: expiringData,
    lastZReadDate: lastZRead?.created_at ?? null,
  };
}

export interface ExcelColumnDef<T> {
  header: string;
  key: keyof T;
  width?: number;
  format?: "currency" | "percent" | "date" | "number";
}

/**
 * Prepare report data for Excel export (returns serializable data)
 * Actual Excel generation happens client-side with exceljs
 */
export async function prepareExcelData<T extends Record<string, unknown>>(
  reportName: string,
  items: T[],
  columns: ExcelColumnDef<T>[]
): Promise<{
  reportName: string;
  generatedAt: string;
  columns: ExcelColumnDef<T>[];
  rows: T[];
}> {
  return {
    reportName,
    generatedAt: new Date().toISOString(),
    columns,
    rows: items,
  };
}
