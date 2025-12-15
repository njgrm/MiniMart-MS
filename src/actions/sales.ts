"use server";

import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";

// ============================================
// Types
// ============================================

export type DateRange = "today" | "week" | "month" | "year" | "all";

export interface SaleTransaction {
  transaction_id: number;
  receipt_no: string;
  created_at: Date;
  total_amount: number;
  status: string;
  itemsCount: number;
  payment_method: string | null;
  items: {
    product_name: string;
    quantity: number;
    price_at_sale: number;
    cost_at_sale: number;
    subtotal: number;
  }[];
  user?: {
    username: string;
  };
}

export interface SalesHistoryResult {
  transactions: SaleTransaction[];
  totalCount: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}

export interface CsvSaleRow {
  date: string; // ISO date string or common format
  barcode: string;
  quantity: number;
  paymentMethod: "CASH" | "GCASH";
}

export interface ImportResult {
  successCount: number;
  failedCount: number;
  failedRows: { row: number; reason: string }[];
}

// ============================================
// Helper Functions
// ============================================

function getDateRangeFilter(range: DateRange): Date | undefined {
  const now = new Date();
  
  switch (range) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week":
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo;
    case "month":
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return monthAgo;
    case "year":
      const yearAgo = new Date(now);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      return yearAgo;
    case "all":
    default:
      return undefined;
  }
}

function parseDate(dateStr: string): Date | null {
  // Try various date formats
  const formats = [
    // ISO format
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/,
    // US format: MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // EU format: DD/MM/YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
  ];

  // Try ISO format first
  const isoMatch = dateStr.match(formats[0]);
  if (isoMatch) {
    return new Date(dateStr);
  }

  // Try MM/DD/YYYY
  const usMatch = dateStr.match(formats[1]);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try DD-MM-YYYY
  const euMatch = dateStr.match(formats[2]);
  if (euMatch) {
    const [, day, month, year] = euMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Fallback to Date constructor
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// ============================================
// Server Actions
// ============================================

/**
 * Get sales history with optional date range filter
 */
export async function getSalesHistory(
  range: DateRange = "all",
  page: number = 1,
  pageSize: number = 20
): Promise<SalesHistoryResult> {
  const startDate = getDateRangeFilter(range);
  
  const whereClause = startDate
    ? { created_at: { gte: startDate } }
    : {};

  // Get total count
  const totalCount = await prisma.transaction.count({
    where: whereClause,
  });

  // Get transactions with items, payment, and user
  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    include: {
      items: {
        include: {
          product: {
            select: {
              product_name: true,
            },
          },
        },
      },
      payment: {
        select: {
          payment_method: true,
        },
      },
      user: {
        select: {
          username: true,
        },
      },
    },
    orderBy: {
      created_at: "desc",
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // Calculate aggregates for all transactions in range (not paginated)
  const allTransactionsInRange = await prisma.transaction.findMany({
    where: whereClause,
    include: {
      items: true,
    },
  });

  let totalRevenue = 0;
  let totalCost = 0;

  for (const tx of allTransactionsInRange) {
    totalRevenue += Number(tx.total_amount);
    for (const item of tx.items) {
      totalCost += Number(item.cost_at_sale) * item.quantity;
    }
  }

  const totalProfit = totalRevenue - totalCost;

  // Transform data for client
  const transformedTransactions: SaleTransaction[] = transactions.map((tx) => ({
    transaction_id: tx.transaction_id,
    receipt_no: tx.receipt_no,
    created_at: tx.created_at,
    total_amount: Number(tx.total_amount),
    status: tx.status,
    itemsCount: tx.items.length,
    payment_method: tx.payment?.payment_method ?? null,
    items: tx.items.map((item) => ({
      product_name: item.product.product_name,
      quantity: item.quantity,
      price_at_sale: Number(item.price_at_sale),
      cost_at_sale: Number(item.cost_at_sale),
      subtotal: Number(item.subtotal),
    })),
    user: tx.user ? { username: tx.user.username } : undefined,
  }));

  return {
    transactions: transformedTransactions,
    totalCount,
    totalRevenue,
    totalCost,
    totalProfit,
  };
}

/**
 * Import sales from CSV data for analytics backfilling
 * Input: Array of { date, barcode, quantity, paymentMethod }
 */
export async function importSalesCsv(data: CsvSaleRow[]): Promise<ImportResult> {
  const successCount = { value: 0 };
  const failedRows: { row: number; reason: string }[] = [];

  // Group by date and payment method to create transactions
  const groupedSales = new Map<string, CsvSaleRow[]>();

  data.forEach((row, index) => {
    const parsedDate = parseDate(row.date);
    if (!parsedDate) {
      failedRows.push({ row: index + 2, reason: `Invalid date format: ${row.date}` });
      return;
    }

    // Group key: date (YYYY-MM-DD) + payment method
    const dateKey = parsedDate.toISOString().split("T")[0];
    const key = `${dateKey}_${row.paymentMethod}`;
    
    if (!groupedSales.has(key)) {
      groupedSales.set(key, []);
    }
    groupedSales.get(key)!.push({ ...row, date: parsedDate.toISOString() });
  });

  // Process each group as a single transaction
  for (const [key, items] of groupedSales) {
    const [dateStr, paymentMethod] = key.split("_");
    const transactionDate = new Date(dateStr);
    
    try {
      await prisma.$transaction(async (tx) => {
        // Find all products by barcode - include cost_price for accurate COGS
        const barcodes = items.map((item) => item.barcode);
        const products = await tx.product.findMany({
          where: { barcode: { in: barcodes } },
          select: {
            product_id: true,
            barcode: true,
            retail_price: true,
            cost_price: true,
          },
        });

        const productMap = new Map(
          products.map((p) => [p.barcode, p])
        );

        // Validate all items have valid products
        const validItems: {
          product_id: number;
          quantity: number;
          price_at_sale: number;
          cost_at_sale: number;
        }[] = [];

        for (const item of items) {
          const product = productMap.get(item.barcode);
          if (!product) {
            // Find which row this was
            const rowIndex = data.findIndex(
              (d) => d.barcode === item.barcode && d.date === item.date
            );
            failedRows.push({
              row: rowIndex + 2,
              reason: `Product not found for barcode: ${item.barcode}`,
            });
            continue;
          }

          validItems.push({
            product_id: product.product_id,
            quantity: item.quantity,
            price_at_sale: Number(product.retail_price),
            cost_at_sale: Number(product.cost_price), // Use actual cost_price for accurate profit tracking
          });
        }

        if (validItems.length === 0) {
          return; // Skip empty transaction
        }

        // Calculate total
        const totalAmount = validItems.reduce(
          (sum, item) => sum + item.price_at_sale * item.quantity,
          0
        );

        // Create the historical transaction
        await tx.transaction.create({
          data: {
            user_id: 1, // Default to admin user for imports
            customer_id: null,
            total_amount: new Decimal(totalAmount),
            status: "COMPLETED",
            created_at: transactionDate,
            items: {
              create: validItems.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
                price_at_sale: new Decimal(item.price_at_sale),
                cost_at_sale: new Decimal(item.cost_at_sale),
                subtotal: new Decimal(item.price_at_sale * item.quantity),
              })),
            },
            payment: {
              create: {
                payment_method: paymentMethod as "CASH" | "GCASH",
                amount_tendered: new Decimal(totalAmount),
                change: new Decimal(0),
              },
            },
          },
        });

        successCount.value += validItems.length;
      });
    } catch (error) {
      console.error("Import transaction error:", error);
      // Mark all items in this group as failed
      for (const item of items) {
        const rowIndex = data.findIndex(
          (d) => d.barcode === item.barcode && d.date === item.date
        );
        if (rowIndex >= 0) {
          failedRows.push({
            row: rowIndex + 2,
            reason: error instanceof Error ? error.message : "Database error",
          });
        }
      }
    }
  }

  // Revalidate paths
  revalidatePath("/admin/sales");
  revalidatePath("/admin");

  return {
    successCount: successCount.value,
    failedCount: failedRows.length,
    failedRows,
  };
}

/**
 * Get quick sales stats for dashboard
 */
export async function getSalesStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Today's stats
  const todayTransactions = await prisma.transaction.findMany({
    where: {
      created_at: { gte: todayStart },
      status: "COMPLETED",
    },
    include: { items: true },
  });

  // Month's stats
  const monthTransactions = await prisma.transaction.findMany({
    where: {
      created_at: { gte: monthStart },
      status: "COMPLETED",
    },
    include: { items: true },
  });

  const calculateStats = (transactions: typeof todayTransactions) => {
    let revenue = 0;
    let cost = 0;

    for (const tx of transactions) {
      revenue += Number(tx.total_amount);
      for (const item of tx.items) {
        cost += Number(item.cost_at_sale) * item.quantity;
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
    today: calculateStats(todayTransactions),
    month: calculateStats(monthTransactions),
  };
}

/**
 * Void a transaction (soft delete by changing status)
 */
export async function voidTransaction(transactionId: number) {
  try {
    await prisma.transaction.update({
      where: { transaction_id: transactionId },
      data: { status: "VOID" },
    });

    revalidatePath("/admin/sales");
    return { success: true };
  } catch (error) {
    console.error("Void transaction error:", error);
    return { success: false, error: "Failed to void transaction" };
  }
}
