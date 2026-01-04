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
  amount_tendered: number | null;
  change: number | null;
  order_id: number | null; // For PRE-ORDER badge
  items: {
    product_name: string;
    barcode: string | null;
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

/**
 * CSV Sale Row - Supports multiple formats:
 * 
 * Simple Format: date, barcode, quantity, paymentMethod
 * Python Script v2 Format: date, barcode, quantity, retail_price, cost_price, is_event, event_source
 * Python Script v3 Format (generate_history_v3.py):
 *   Headers: transaction_id, date, time, customer_type, barcode, product_name, brand, category,
 *            quantity, unit_price, cost_price, subtotal, cost_total, profit, payment_method,
 *            is_event, event_source, event_name, inflation_factor
 *   Examp0le: TX-20240101-0001,2024-01-01,15:30:46,SNACKER,999000000002,Lucky Me Pancit Canton...,Lucky Me,
 *            INSTANT_NOODLES,1,12.5,11.0,12.5,11.0,1.5,CASH,True,HOLIDAY,New Year's Day,1.0
 * 
 * v3 Grouping: When transaction_id is present (TX-YYYYMMDD-NNNN), rows are grouped by transaction_id.
 *              Otherwise, rows are grouped by date + payment_method (legacy behavior).
 */
export interface CsvSaleRow {
  // Core required fields
  date: string; // ISO date string or common format (YYYY-MM-DD)
  barcode: string;
  quantity: number;
  
  // Payment - various column name formats supported
  paymentMethod?: "CASH" | "GCASH"; // Optional - defaults to CASH (simple format)
  payment_method?: "CASH" | "GCASH"; // v3 format uses snake_case
  
  // Price fields (v2 uses retail_price, v3 uses unit_price)
  retail_price?: number; // v2 format
  unit_price?: number; // v3 format - inflation-adjusted retail price
  cost_price?: number; // v2/v3 - inflation-adjusted cost price
  subtotal?: number; // v3 - unit_price * quantity
  cost_total?: number; // v3 - cost_price * quantity
  profit?: number; // v3 - subtotal - cost_total
  
  // Event tracking
  is_event?: boolean | string; // 0/1, true/false, True/False, "True"/"False" (Python outputs "True"/"False")
  event_source?: string; // HOLIDAY, BRAND_CAMPAIGN, MANUFACTURER_CAMPAIGN, etc.
  event_name?: string; // v3 - e.g., "New Year's Day", "Coca-Cola Summer Promo"
  
  // v3 additional fields (used for proper transaction grouping)
  transaction_id?: string; // TX-YYYYMMDD-NNNN format - CRITICAL for v3 grouping
  time?: string; // HH:MM:SS format - combined with date for accurate timestamp
  customer_type?: string; // SNACKER, HOUSEHOLD, VENDOR (customer profile)
  product_name?: string; // For validation/reference only
  brand?: string; // For reference only
  category?: string; // For reference only
  inflation_factor?: number; // v3 - price multiplier applied (e.g., 1.0, 1.045, 1.092)
}

export interface ImportResult {
  successCount: number;
  failedCount: number;
  eventDaysCount: number;
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
 * Financial stats exclude VOID and CANCELLED transactions
 */
export async function getSalesHistory(
  range: DateRange = "all",
  page: number = 1,
  pageSize: number = 20
): Promise<SalesHistoryResult> {
  const startDate = getDateRangeFilter(range);
  
  // Base where clause for date filtering (shows all statuses in history list)
  const whereClause = startDate
    ? { created_at: { gte: startDate } }
    : {};

  // Where clause for financial calculations (excludes VOID and CANCELLED)
  const validStatusWhereClause = {
    ...whereClause,
    status: { notIn: ["VOID", "CANCELLED"] },
  };

  // Get total count (all transactions for display)
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
              barcode: true,
            },
          },
        },
      },
      payment: {
        select: {
          payment_method: true,
          amount_tendered: true,
          change: true,
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

  // Calculate aggregates for VALID transactions only (exclude VOID/CANCELLED)
  const validTransactions = await prisma.transaction.findMany({
    where: validStatusWhereClause,
    include: {
      items: true,
    },
  });

  let totalRevenue = 0;
  let totalCost = 0;

  for (const tx of validTransactions) {
    // Revenue is the sum of item prices * quantities (not total_amount which may include tax/discount)
    for (const item of tx.items) {
      const itemRevenue = Number(item.price_at_sale) * item.quantity;
      const itemCost = Number(item.cost_at_sale) * item.quantity;
      
      // Skip items with 0 price (data quality issue)
      if (itemRevenue > 0) {
        totalRevenue += itemRevenue;
        totalCost += itemCost;
      }
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
    amount_tendered: tx.payment?.amount_tendered ? Number(tx.payment.amount_tendered) : null,
    change: tx.payment?.change ? Number(tx.payment.change) : null,
    order_id: tx.order_id, // Include order_id for PRE-ORDER badge
    items: tx.items.map((item) => ({
      product_name: item.product.product_name,
      barcode: item.product.barcode ?? null,
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

// ============================================
// Progress Tracking (In-Memory Store)
// ============================================
const importProgressStore = new Map<string, {
  total: number;
  processed: number;
  successCount: number;
  failedCount: number;
  currentBatch: number;
  totalBatches: number;
  status: "idle" | "processing" | "completed" | "error";
  message: string;
  startTime: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
}>();

export async function getImportProgress(importId: string) {
  return importProgressStore.get(importId) || null;
}

function updateImportProgress(
  importId: string, 
  updates: Partial<typeof importProgressStore extends Map<string, infer V> ? V : never>
) {
  const current = importProgressStore.get(importId);
  if (current) {
    const elapsedMs = Date.now() - current.startTime;
    const rate = current.processed > 0 ? elapsedMs / current.processed : 0;
    const remaining = current.total - current.processed;
    const estimatedRemainingMs = rate * remaining;
    
    importProgressStore.set(importId, { 
      ...current, 
      ...updates, 
      elapsedMs,
      estimatedRemainingMs,
    });
    
    // Terminal progress logging
    const progress = importProgressStore.get(importId)!;
    const pct = ((progress.processed / progress.total) * 100).toFixed(1);
    const elapsed = (elapsedMs / 1000).toFixed(1);
    const eta = (estimatedRemainingMs / 1000).toFixed(0);
    console.log(
      `[IMPORT ${importId.slice(0, 8)}] ` +
      `Batch ${progress.currentBatch}/${progress.totalBatches} | ` +
      `${progress.processed.toLocaleString()}/${progress.total.toLocaleString()} (${pct}%) | ` +
      `✓ ${progress.successCount.toLocaleString()} ✗ ${progress.failedCount} | ` +
      `${elapsed}s elapsed, ~${eta}s remaining`
    );
  }
}

/**
 * OPTIMIZED: Import sales from CSV data with batching and progress tracking
 * 
 * Performance optimizations:
 * 1. Batch processing (5000 rows per batch)
 * 2. Pre-fetch all products once instead of per-transaction
 * 3. Use createMany for bulk inserts where possible
 * 4. Progress tracking for UI feedback
 * 
 * Supports three formats:
 * 1. Simple: date, barcode, quantity, paymentMethod
 * 2. Python Script v2: date, barcode, quantity, retail_price, cost_price, is_event, event_source
 * 3. Python Script v3: transaction_id, date, time, customer_type, barcode, product_name, brand, 
 *                      category, quantity, unit_price, cost_price, subtotal, cost_total, profit,
 *                      payment_method, is_event, event_source, event_name, inflation_factor
 * 
 * v3 Behavior: Groups by transaction_id (TX-YYYYMMDD-NNNN) to preserve exact transactions.
 *              Combines date + time for accurate timestamps.
 */
export async function importSalesCsvOptimized(
  data: CsvSaleRow[], 
  importId: string
): Promise<ImportResult> {
  const BATCH_SIZE = 5000; // Process 5000 rows per batch
  const totalRows = data.length;
  const totalBatches = Math.ceil(totalRows / BATCH_SIZE);
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[IMPORT START] ${totalRows.toLocaleString()} rows in ${totalBatches} batches`);
  console.log(`${"=".repeat(60)}\n`);
  
  // Initialize progress
  importProgressStore.set(importId, {
    total: totalRows,
    processed: 0,
    successCount: 0,
    failedCount: 0,
    currentBatch: 0,
    totalBatches,
    status: "processing",
    message: "Initializing...",
    startTime: Date.now(),
    elapsedMs: 0,
    estimatedRemainingMs: 0,
  });

  let successCount = 0;
  let eventDaysCount = 0;
  const failedRows: { row: number; reason: string }[] = [];

  try {
    // Step 1: Pre-fetch ALL products with barcodes (one query)
    updateImportProgress(importId, { message: "Loading product catalog..." });
    
    const allProducts = await prisma.product.findMany({
      where: { barcode: { not: null } },
      select: {
        product_id: true,
        barcode: true,
        retail_price: true,
        cost_price: true,
      },
    });
    
    const productMap = new Map(
      allProducts.map((p) => [p.barcode!, { 
        product_id: p.product_id,
        retail_price: Number(p.retail_price),
        cost_price: Number(p.cost_price),
      }])
    );
    
    console.log(`[IMPORT] Loaded ${allProducts.length} products with barcodes`);
    updateImportProgress(importId, { message: `Loaded ${allProducts.length} products` });

    // Step 2: Validate and group ALL data first (fast in-memory operation)
    updateImportProgress(importId, { message: "Validating and grouping data..." });
    
    type GroupedTransaction = {
      groupKey: string;
      transactionDate: Date;
      paymentMethod: "CASH" | "GCASH";
      customerType?: string;
      items: {
        rowIndex: number;
        product_id: number;
        quantity: number;
        price_at_sale: number;
        cost_at_sale: number;
      }[];
    };
    
    const groupedTransactions = new Map<string, GroupedTransaction>();
    
    // Detect if v3 format by checking first row for transaction_id
    const isV3Format = data.length > 0 && data[0].transaction_id?.startsWith("TX-");
    console.log(`[IMPORT] Detected format: ${isV3Format ? "v3 (transaction_id grouping)" : "v2/simple (date grouping)"}`);
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // +2 for header + 0-index
      
      // Parse date (and optionally time for v3)
      let parsedDate = parseDate(row.date);
      if (!parsedDate) {
        failedRows.push({ row: rowNum, reason: `Invalid date: ${row.date}` });
        continue;
      }
      
      // For v3 format, combine date + time for accurate timestamp
      if (isV3Format && row.time) {
        const timeParts = row.time.split(":");
        if (timeParts.length >= 2) {
          const hours = parseInt(timeParts[0]) || 0;
          const minutes = parseInt(timeParts[1]) || 0;
          const seconds = parseInt(timeParts[2]) || 0;
          parsedDate = new Date(parsedDate);
          parsedDate.setHours(hours, minutes, seconds, 0);
        }
      }
      
      // Find product
      const product = productMap.get(row.barcode);
      if (!product) {
        failedRows.push({ row: rowNum, reason: `Unknown barcode: ${row.barcode}` });
        continue;
      }
      
      // Track events - Python v3 outputs "True"/"False" as strings
      const isEvent = row.is_event === true || row.is_event === "1" || row.is_event === "true" || row.is_event === "True";
      if (isEvent) eventDaysCount++;
      
      // Determine payment method (v3 uses payment_method snake_case)
      const paymentMethod = (row.payment_method || row.paymentMethod || "CASH") as "CASH" | "GCASH";
      
      // Create group key: v3 uses transaction_id, v2/simple uses date + payment_method
      let groupKey: string;
      if (isV3Format && row.transaction_id) {
        // v3: Group by exact transaction_id (e.g., TX-20240101-0001)
        groupKey = row.transaction_id;
      } else {
        // v2/simple: Group by date + payment_method (legacy behavior)
        const dateKey = parsedDate.toISOString().split("T")[0];
        groupKey = `${dateKey}_${paymentMethod}`;
      }
      
      if (!groupedTransactions.has(groupKey)) {
        groupedTransactions.set(groupKey, {
          groupKey,
          transactionDate: parsedDate,
          paymentMethod,
          customerType: row.customer_type,
          items: [],
        });
      }
      
      // Use v3's unit_price if available, otherwise fall back to retail_price or product price
      const priceAtSale = row.unit_price ?? row.retail_price ?? product.retail_price;
      const costAtSale = row.cost_price ?? product.cost_price;
      
      groupedTransactions.get(groupKey)!.items.push({
        rowIndex: rowNum,
        product_id: product.product_id,
        quantity: row.quantity,
        price_at_sale: priceAtSale,
        cost_at_sale: costAtSale,
      });
    }

    console.log(`[IMPORT] Grouped into ${groupedTransactions.size} transactions`);

    // Step 3: Process transactions in batches
    const transactions = Array.from(groupedTransactions.values());
    const txBatches = Math.ceil(transactions.length / 500); // 500 transactions per batch
    
    for (let batchIdx = 0; batchIdx < txBatches; batchIdx++) {
      const batchStart = batchIdx * 500;
      const batchEnd = Math.min(batchStart + 500, transactions.length);
      const batch = transactions.slice(batchStart, batchEnd);
      
      updateImportProgress(importId, {
        currentBatch: batchIdx + 1,
        message: `Processing batch ${batchIdx + 1}/${txBatches}...`,
      });
      
      // Process each transaction in the batch
      for (const txGroup of batch) {
        try {
          const totalAmount = txGroup.items.reduce(
            (sum, item) => sum + item.price_at_sale * item.quantity,
            0
          );
          
          // Create transaction with items and payment in one go
          await prisma.transaction.create({
            data: {
              user_id: 1,
              customer_id: null,
              total_amount: new Decimal(totalAmount),
              status: "COMPLETED",
              created_at: txGroup.transactionDate,
              items: {
                create: txGroup.items.map((item) => ({
                  product_id: item.product_id,
                  quantity: item.quantity,
                  price_at_sale: new Decimal(item.price_at_sale),
                  cost_at_sale: new Decimal(item.cost_at_sale),
                  subtotal: new Decimal(item.price_at_sale * item.quantity),
                })),
              },
              payment: {
                create: {
                  payment_method: txGroup.paymentMethod,
                  amount_tendered: new Decimal(totalAmount),
                  change: new Decimal(0),
                },
              },
            },
          });
          
          successCount += txGroup.items.length;
        } catch (error) {
          // Mark all items in this transaction as failed
          for (const item of txGroup.items) {
            failedRows.push({
              row: item.rowIndex,
              reason: error instanceof Error ? error.message : "Database error",
            });
          }
        }
      }
      
      // Update progress after each batch
      const processedRows = transactions
        .slice(0, batchEnd)
        .reduce((sum, tx) => sum + tx.items.length, 0);
      
      updateImportProgress(importId, {
        processed: processedRows + failedRows.length,
        successCount,
        failedCount: failedRows.length,
      });
    }

    // Final progress update
    updateImportProgress(importId, {
      processed: totalRows,
      successCount,
      failedCount: failedRows.length,
      status: "completed",
      message: `Completed! ${successCount.toLocaleString()} imported, ${failedRows.length} failed`,
    });

    console.log(`\n${"=".repeat(60)}`);
    console.log(`[IMPORT COMPLETE] ✓ ${successCount.toLocaleString()} | ✗ ${failedRows.length}`);
    console.log(`${"=".repeat(60)}\n`);

  } catch (error) {
    console.error("[IMPORT ERROR]", error);
    updateImportProgress(importId, {
      status: "error",
      message: error instanceof Error ? error.message : "Import failed",
    });
  }

  // Cleanup progress after 60 seconds
  setTimeout(() => importProgressStore.delete(importId), 60000);

  // Revalidate paths
  revalidatePath("/admin/sales");
  revalidatePath("/admin");
  revalidatePath("/admin/analytics");

  return {
    successCount,
    failedCount: failedRows.length,
    eventDaysCount,
    failedRows: failedRows.slice(0, 100), // Limit failed rows to first 100 for response size
  };
}

/**
 * Legacy import function (kept for backward compatibility)
 * For large imports (>10,000 rows), use importSalesCsvOptimized instead
 * 
 * Import sales from CSV data for analytics backfilling
 * 
 * Supports two formats:
 * 1. Simple: date, barcode, quantity, paymentMethod
 * 2. Python Script (generate_history_v2.py): date, barcode, quantity, retail_price, cost_price, is_event, event_source
 */
export async function importSalesCsv(data: CsvSaleRow[]): Promise<ImportResult> {
  const successCount = { value: 0 };
  const eventDaysCount = { value: 0 };
  const failedRows: { row: number; reason: string }[] = [];

  // Group by date and payment method to create transactions
  const groupedSales = new Map<string, CsvSaleRow[]>();

  data.forEach((row, index) => {
    const parsedDate = parseDate(row.date);
    if (!parsedDate) {
      failedRows.push({ row: index + 2, reason: `Invalid date format: ${row.date}` });
      return;
    }

    // Group key: date (YYYY-MM-DD) + payment method (default to CASH if not provided)
    const dateKey = parsedDate.toISOString().split("T")[0];
    const paymentMethod = row.paymentMethod || "CASH";
    const key = `${dateKey}_${paymentMethod}`;
    
    if (!groupedSales.has(key)) {
      groupedSales.set(key, []);
    }
    
    // Track event days
    const isEvent = row.is_event === true || row.is_event === "1" || row.is_event === "true";
    if (isEvent) eventDaysCount.value++;
    
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

          // Use provided prices from CSV if available, otherwise fall back to product prices
          const priceAtSale = item.retail_price ?? Number(product.retail_price);
          const costAtSale = item.cost_price ?? Number(product.cost_price);

          validItems.push({
            product_id: product.product_id,
            quantity: item.quantity,
            price_at_sale: priceAtSale,
            cost_at_sale: costAtSale,
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
  revalidatePath("/admin/analytics");

  return {
    successCount: successCount.value,
    failedCount: failedRows.length,
    eventDaysCount: eventDaysCount.value,
    failedRows,
  };
}

/**
 * Get quick sales stats for dashboard
 * Only includes COMPLETED transactions, excludes VOID/CANCELLED
 * Calculates revenue from item prices (not total_amount) to handle discounts correctly
 * Includes previous period data for percentage change calculation
 * 
 * NOTE: Uses Philippine Standard Time (UTC+8) for business day calculations
 */
export async function getSalesStats() {
  // Philippine timezone offset is UTC+8 (8 hours = 8 * 60 * 60 * 1000 ms)
  const PHT_OFFSET = 8 * 60 * 60 * 1000;
  
  // Get current time in PHT
  const now = new Date();
  const nowPHT = new Date(now.getTime() + PHT_OFFSET);
  
  // Calculate start of today in PHT, then convert back to UTC for database query
  const todayPHT = new Date(Date.UTC(nowPHT.getUTCFullYear(), nowPHT.getUTCMonth(), nowPHT.getUTCDate()));
  const todayStart = new Date(todayPHT.getTime() - PHT_OFFSET); // Convert PHT midnight to UTC
  
  // Yesterday in UTC
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  
  // Start of current month in PHT, converted to UTC
  const monthPHT = new Date(Date.UTC(nowPHT.getUTCFullYear(), nowPHT.getUTCMonth(), 1));
  const monthStart = new Date(monthPHT.getTime() - PHT_OFFSET);
  
  // Last month's range
  const lastMonthPHT = new Date(Date.UTC(nowPHT.getUTCFullYear(), nowPHT.getUTCMonth() - 1, 1));
  const lastMonthStart = new Date(lastMonthPHT.getTime() - PHT_OFFSET);
  const lastMonthEndPHT = new Date(Date.UTC(nowPHT.getUTCFullYear(), nowPHT.getUTCMonth(), 0, 23, 59, 59, 999));
  const lastMonthEnd = new Date(lastMonthEndPHT.getTime() - PHT_OFFSET);

  // Today's stats - only COMPLETED transactions
  const todayTransactions = await prisma.transaction.findMany({
    where: {
      created_at: { gte: todayStart },
      status: "COMPLETED",
    },
    include: { items: true },
  });

  // Yesterday's stats for comparison
  const yesterdayTransactions = await prisma.transaction.findMany({
    where: {
      created_at: { gte: yesterdayStart, lt: todayStart },
      status: "COMPLETED",
    },
    include: { items: true },
  });

  // Month's stats - only COMPLETED transactions
  const monthTransactions = await prisma.transaction.findMany({
    where: {
      created_at: { gte: monthStart },
      status: "COMPLETED",
    },
    include: { items: true },
  });

  // Last month's stats for comparison
  const lastMonthTransactions = await prisma.transaction.findMany({
    where: {
      created_at: { gte: lastMonthStart, lte: lastMonthEnd },
      status: "COMPLETED",
    },
    include: { items: true },
  });

  const calculateStats = (transactions: typeof todayTransactions) => {
    let revenue = 0;
    let cost = 0;

    for (const tx of transactions) {
      // Calculate revenue from items (price * qty) to properly track gross revenue
      for (const item of tx.items) {
        const itemPrice = Number(item.price_at_sale);
        const itemCost = Number(item.cost_at_sale);
        
        // Skip items with 0 price (data quality issue)
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
    today: calculateStats(todayTransactions),
    yesterday: calculateStats(yesterdayTransactions),
    month: calculateStats(monthTransactions),
    lastMonth: calculateStats(lastMonthTransactions),
  };
}

/**
 * Get sales stats for a custom date range
 * Accepts start and end dates, calculates comparison with previous period of same length
 */
export async function getSalesStatsByDateRange(startDate: Date, endDate: Date) {
  // Philippine timezone offset is UTC+8
  const PHT_OFFSET = 8 * 60 * 60 * 1000;
  
  // Ensure end date includes the full day (23:59:59)
  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);
  
  // Calculate the length of the period in milliseconds
  const periodLength = rangeEnd.getTime() - rangeStart.getTime();
  
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
    periodDays: Math.ceil(periodLength / (24 * 60 * 60 * 1000)),
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

export interface TopProduct {
  product_id: number;
  product_name: string;
  quantity_sold: number;
  revenue: number;
}

/**
 * Get top selling products for the dashboard
 */
export async function getTopProducts(limit: number = 5): Promise<TopProduct[]> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get all transaction items from this month with product info
  const transactionItems = await prisma.transactionItem.findMany({
    where: {
      transaction: {
        created_at: { gte: monthStart },
        status: "COMPLETED",
      },
    },
    include: {
      product: {
        select: {
          product_id: true,
          product_name: true,
        },
      },
    },
  });

  // Aggregate by product
  const productMap = new Map<number, {
    product_id: number;
    product_name: string;
    quantity_sold: number;
    revenue: number;
  }>();

  for (const item of transactionItems) {
    const existing = productMap.get(item.product_id);
    const revenue = Number(item.subtotal);
    
    if (existing) {
      existing.quantity_sold += item.quantity;
      existing.revenue += revenue;
    } else {
      productMap.set(item.product_id, {
        product_id: item.product_id,
        product_name: item.product.product_name,
        quantity_sold: item.quantity,
        revenue,
      });
    }
  }

  // Sort by quantity sold and take top N
  const sorted = Array.from(productMap.values())
    .sort((a, b) => b.quantity_sold - a.quantity_sold)
    .slice(0, limit);

  return sorted;
}

export interface TopProductWithCategory {
  product_id: number;
  product_name: string;
  category: string;
  quantity_sold: number;
  revenue: number;
  profit: number;
  image_url: string | null;
  current_stock: number;
}

/**
 * Get top selling products with category filtering and custom date range
 */
export async function getTopProductsByDateRange(
  startDate: Date,
  endDate: Date,
  category?: string,
  limit: number = 10
): Promise<{ products: TopProductWithCategory[]; categories: string[] }> {
  // Ensure end date includes the full day
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  // Get all transaction items within date range
  const whereClause: {
    transaction: { created_at: { gte: Date; lte: Date }; status: string };
    product?: { category: string };
  } = {
    transaction: {
      created_at: { gte: startDate, lte: rangeEnd },
      status: "COMPLETED",
    },
  };

  if (category && category !== "all") {
    whereClause.product = { category };
  }

  const transactionItems = await prisma.transactionItem.findMany({
    where: whereClause,
    include: {
      product: {
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
      },
    },
  });

  // Get all unique categories
  const allCategories = await prisma.product.findMany({
    select: { category: true },
    distinct: ["category"],
    where: { is_archived: false },
  });
  const categories = allCategories.map(c => c.category).sort();

  // Aggregate by product
  const productMap = new Map<number, TopProductWithCategory>();

  for (const item of transactionItems) {
    const existing = productMap.get(item.product_id);
    const revenue = Number(item.subtotal);
    const cost = Number(item.cost_at_sale) * item.quantity;
    const profit = revenue - cost;
    
    if (existing) {
      existing.quantity_sold += item.quantity;
      existing.revenue += revenue;
      existing.profit += profit;
    } else {
      productMap.set(item.product_id, {
        product_id: item.product_id,
        product_name: item.product.product_name,
        category: item.product.category,
        quantity_sold: item.quantity,
        revenue,
        profit,
        image_url: item.product.image_url,
        current_stock: item.product.inventory?.current_stock ?? 0,
      });
    }
  }

  // Sort by quantity sold and take top N
  const products = Array.from(productMap.values())
    .sort((a, b) => b.quantity_sold - a.quantity_sold)
    .slice(0, limit);

  return { products, categories };
}
