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
