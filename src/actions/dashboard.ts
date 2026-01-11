"use server";

import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, addDays } from "date-fns";
import type { CashRegisterData } from "@/components/dashboard/cash-register-card";
import type { InventoryHealthData, LowStockItem, ExpiringItem } from "@/components/dashboard/inventory-health-card";

/**
 * Get cash register data for today's shift
 * Calculates: opening fund, cash sales, gcash sales, expenses, expected drawer
 */
export async function getCashRegisterData(): Promise<CashRegisterData> {
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  try {
    // Get today's transactions with payments
    const transactions = await prisma.transaction.findMany({
      where: {
        created_at: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: "COMPLETED",
      },
      include: {
        payment: true,
      },
    });

    // Calculate cash and gcash sales
    let cashSales = 0;
    let gcashSales = 0;
    let cashTransactionCount = 0;

    for (const tx of transactions) {
      const amount = Number(tx.total_amount);
      if (tx.payment?.payment_method === "CASH") {
        cashSales += amount;
        cashTransactionCount++;
      } else if (tx.payment?.payment_method === "GCASH") {
        gcashSales += amount;
      }
    }

    // Default opening fund (this could come from a shift management system later)
    const openingFund = 2000;

    // Expenses (placeholder - would come from an expenses table)
    const expenses = 0;

    // Expected drawer calculation
    const expectedDrawer = openingFund + cashSales - expenses;

    return {
      openingFund,
      cashSales,
      gcashSales,
      expenses,
      expectedDrawer,
      transactionCount: cashTransactionCount,
      shiftStartTime: dayStart,
      isShiftActive: true, // Assume shift is active during business hours
    };
  } catch (error) {
    console.error("Error fetching cash register data:", error);
    return {
      openingFund: 2000,
      cashSales: 0,
      gcashSales: 0,
      expenses: 0,
      expectedDrawer: 2000,
      transactionCount: 0,
      isShiftActive: false,
    };
  }
}

/**
 * Get inventory health data: low stock items, out of stock, expiring soon
 * Uses velocity-based logic matching analytics dashboard:
 * - CRITICAL: ≤2 days of supply
 * - LOW: 2-7 days of supply
 * - HEALTHY: >7 days of supply
 */
export async function getInventoryHealthData(): Promise<InventoryHealthData> {
  try {
    // Calculate the date 45 days from now for expiry window
    const expiryWindowDate = new Date();
    expiryWindowDate.setDate(expiryWindowDate.getDate() + 45);

    const today = new Date();
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);

    // Get all products with inventory
    const products = await prisma.product.findMany({
      where: { is_archived: false },
      include: { 
        inventory: true,
      },
      orderBy: { product_name: "asc" },
    });

    // Get recent sales to calculate velocity (last 7 days)
    const recentSales = await prisma.transactionItem.findMany({
      where: {
        transaction: {
          created_at: { gte: last7Days },
          status: "COMPLETED",
        },
      },
      select: {
        product_id: true,
        quantity: true,
      },
    });

    // Build velocity map: product_id -> total units sold in last 7 days
    const velocityMap = new Map<number, number>();
    for (const sale of recentSales) {
      const current = velocityMap.get(sale.product_id) ?? 0;
      velocityMap.set(sale.product_id, current + sale.quantity);
    }

    const lowStockItems: LowStockItem[] = [];
    const expiringItems: ExpiringItem[] = [];
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let criticalStockCount = 0;
    let expiringCount = 0;

    for (const product of products) {
      const currentStock = product.inventory?.current_stock ?? 0;
      const weekSales = velocityMap.get(product.product_id) ?? 0;
      const dailyVelocity = weekSales / 7;
      
      // Calculate days of stock (coverage)
      const daysOfStock = dailyVelocity > 0.1 
        ? Math.floor(currentStock / dailyVelocity) 
        : (currentStock > 0 ? 999 : 0); // 999 = dead stock (no velocity)

      // Velocity-based stock status (matches analytics logic)
      // OUT_OF_STOCK: currentStock === 0
      // CRITICAL: ≤2 days of supply
      // LOW: 2-7 days of supply
      // HEALTHY: >7 days of supply
      // DEAD_STOCK: velocity < 0.1 (not selling)

      if (currentStock === 0) {
        // Only count as out of stock if item has velocity (was selling)
        if (dailyVelocity >= 0.1) {
          outOfStockCount++;
          lowStockItems.push({
            product_id: product.product_id,
            product_name: product.product_name,
            current_stock: currentStock,
            reorder_level: product.inventory?.reorder_level ?? 10,
            category: product.category,
            image_url: product.image_url,
            daily_velocity: dailyVelocity,
            days_of_stock: 0,
            stock_status: "OUT_OF_STOCK",
          });
        }
      } else if (dailyVelocity >= 0.1) {
        // Only check velocity-based alerts for items that are actually selling
        if (daysOfStock <= 2) {
          criticalStockCount++;
          lowStockItems.push({
            product_id: product.product_id,
            product_name: product.product_name,
            current_stock: currentStock,
            reorder_level: product.inventory?.reorder_level ?? 10,
            category: product.category,
            image_url: product.image_url,
            daily_velocity: dailyVelocity,
            days_of_stock: daysOfStock,
            stock_status: "CRITICAL",
          });
        } else if (daysOfStock <= 7) {
          lowStockCount++;
          lowStockItems.push({
            product_id: product.product_id,
            product_name: product.product_name,
            current_stock: currentStock,
            reorder_level: product.inventory?.reorder_level ?? 10,
            category: product.category,
            image_url: product.image_url,
            daily_velocity: dailyVelocity,
            days_of_stock: daysOfStock,
            stock_status: "LOW",
          });
        }
      }

      // Expiring items logic - check nearest_expiry_date within 45 days
      if (product.nearest_expiry_date && currentStock > 0) {
        const expiryDate = new Date(product.nearest_expiry_date);
        if (expiryDate <= expiryWindowDate) {
          const daysUntilExpiry = Math.ceil(
            (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          expiringItems.push({
            product_id: product.product_id,
            product_name: product.product_name,
            current_stock: currentStock,
            expiry_date: expiryDate,
            days_until_expiry: daysUntilExpiry,
            category: product.category,
            image_url: product.image_url,
          });
          expiringCount++;
        }
      }
    }

    // Sort low stock items by days of stock (most urgent first - lowest days)
    lowStockItems.sort((a, b) => (a.days_of_stock ?? 0) - (b.days_of_stock ?? 0));

    // Sort expiring items by expiry date (soonest first)
    expiringItems.sort((a, b) => a.days_until_expiry - b.days_until_expiry);

    return {
      lowStockItems: lowStockItems.slice(0, 50), // Top 50 most urgent (matches analytics filter count)
      expiringItems: expiringItems.slice(0, 50), // Top 50 expiring soonest
      outOfStockCount,
      lowStockCount: lowStockCount + criticalStockCount, // Combined for badge
      expiringCount,
    };
  } catch (error) {
    console.error("Error fetching inventory health data:", error);
    return {
      lowStockItems: [],
      expiringItems: [],
      outOfStockCount: 0,
      lowStockCount: 0,
      expiringCount: 0,
    };
  }
}

/**
 * Get today's sales stats for operational dashboard
 * Defaults to "Today" for the operational view
 */
export async function getTodaySalesStats(): Promise<{
  revenue: number;
  cost: number;
  profit: number;
  count: number;
  cashSales: number;
  gcashSales: number;
}> {
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  try {
    // Get today's transactions with items and payments
    const transactions = await prisma.transaction.findMany({
      where: {
        created_at: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: "COMPLETED",
      },
      include: {
        items: true,
        payment: true,
      },
    });

    let revenue = 0;
    let cost = 0;
    let cashSales = 0;
    let gcashSales = 0;

    for (const tx of transactions) {
      const txAmount = Number(tx.total_amount);
      revenue += txAmount;

      // Calculate cost from items
      for (const item of tx.items) {
        cost += Number(item.cost_at_sale) * item.quantity;
      }

      // Track by payment method
      if (tx.payment?.payment_method === "CASH") {
        cashSales += txAmount;
      } else if (tx.payment?.payment_method === "GCASH") {
        gcashSales += txAmount;
      }
    }

    return {
      revenue,
      cost,
      profit: revenue - cost,
      count: transactions.length,
      cashSales,
      gcashSales,
    };
  } catch (error) {
    console.error("Error fetching today's sales stats:", error);
    return {
      revenue: 0,
      cost: 0,
      profit: 0,
      count: 0,
      cashSales: 0,
      gcashSales: 0,
    };
  }
}
