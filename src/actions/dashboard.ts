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
 */
export async function getInventoryHealthData(): Promise<InventoryHealthData> {
  try {
    // Get all products with inventory
    const products = await prisma.product.findMany({
      where: { is_archived: false },
      include: { 
        inventory: true,
      },
      orderBy: { product_name: "asc" },
    });

    const lowStockItems: LowStockItem[] = [];
    let outOfStockCount = 0;
    let lowStockCount = 0;

    for (const product of products) {
      const currentStock = product.inventory?.current_stock ?? 0;
      const reorderLevel = product.inventory?.reorder_level ?? 10;

      if (currentStock === 0) {
        outOfStockCount++;
        // Add to low stock list (out of stock is also "low stock")
        lowStockItems.push({
          product_id: product.product_id,
          product_name: product.product_name,
          current_stock: currentStock,
          reorder_level: reorderLevel,
          category: product.category,
          image_url: product.image_url,
        });
      } else if (currentStock <= reorderLevel) {
        lowStockCount++;
        lowStockItems.push({
          product_id: product.product_id,
          product_name: product.product_name,
          current_stock: currentStock,
          reorder_level: reorderLevel,
          category: product.category,
          image_url: product.image_url,
        });
      }
    }

    // Sort low stock items by stock level (lowest first)
    lowStockItems.sort((a, b) => a.current_stock - b.current_stock);

    // For expiring items - we don't have expiry dates in the schema
    // This would need a schema update. For now, return empty array
    // In a real implementation, you'd add an expiry_date field to Product
    const expiringItems: ExpiringItem[] = [];
    const expiringCount = 0;

    return {
      lowStockItems: lowStockItems.slice(0, 10), // Top 10 most urgent
      expiringItems,
      outOfStockCount,
      lowStockCount,
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
