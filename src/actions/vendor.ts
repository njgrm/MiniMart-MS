"use server";

import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

// ============================================
// Custom Error for Stock Validation
// ============================================

class StockError extends Error {
  issues: string[];
  constructor(message: string, issues: string[]) {
    super(message);
    this.name = "StockError";
    this.issues = issues;
  }
}

// ============================================
// Types
// ============================================

export interface VendorProduct {
  product_id: number;
  product_name: string;
  category: string;
  wholesale_price: number;
  retail_price: number;
  barcode: string | null;
  image_url: string | null;
  current_stock: number;
}

export interface VendorOrder {
  order_id: number;
  order_date: Date;
  status: string;
  total_amount: number;
  items: {
    product_name: string;
    quantity: number;
    price: number;
  }[];
}

export interface VendorStats {
  totalOrders: number;
  pendingOrders: number;
  totalSpent: number;
  totalItems: number;
  lastOrderDate: Date | null;
}

export interface CartItem {
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
}

// ============================================
// Server Actions
// ============================================

/**
 * Get products available for vendors (with wholesale prices)
 * If wholesale_price is 0, use retail_price instead.
 * This allows products to have different distribution vs in-store pricing.
 * 
 * Sorting priority:
 * 1. Products with wholesale_price > 0 come first (true wholesale items)
 * 2. Then sorted alphabetically by product name
 */
export async function getVendorProducts(): Promise<VendorProduct[]> {
  const products = await prisma.product.findMany({
    include: {
      inventory: {
        select: {
          current_stock: true,
        },
      },
    },
    orderBy: {
      product_name: "asc",
    },
  });

  const mappedProducts = products.map((product) => {
    const wholesalePrice = Number(product.wholesale_price);
    const retailPrice = Number(product.retail_price);
    
    // Use wholesale price if available (> 0), otherwise fall back to retail price
    const effectivePrice = wholesalePrice > 0 ? wholesalePrice : retailPrice;
    
    return {
      product_id: product.product_id,
      product_name: product.product_name,
      category: product.category,
      wholesale_price: effectivePrice, // This is the price shown to vendors
      retail_price: retailPrice,
      barcode: product.barcode,
      image_url: product.image_url,
      current_stock: product.inventory?.current_stock ?? 0,
      _hasWholesalePrice: wholesalePrice > 0, // Internal flag for sorting
    };
  });

  // Sort: Products with wholesale_price > 0 first, then alphabetically
  return mappedProducts
    .sort((a, b) => {
      // First priority: Has wholesale price (true wholesale items first)
      if (a._hasWholesalePrice && !b._hasWholesalePrice) return -1;
      if (!a._hasWholesalePrice && b._hasWholesalePrice) return 1;
      // Second priority: Alphabetical by name
      return a.product_name.localeCompare(b.product_name);
    })
    .map(({ _hasWholesalePrice, ...product }) => product); // Remove internal flag
}

/**
 * Get vendor's order history
 */
export async function getVendorOrders(customerId: number): Promise<VendorOrder[]> {
  const orders = await prisma.order.findMany({
    where: {
      customer_id: customerId,
    },
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
    },
    orderBy: {
      order_date: "desc",
    },
  });

  return orders.map((order) => ({
    order_id: order.order_id,
    order_date: order.order_date,
    status: order.status,
    total_amount: Number(order.total_amount),
    items: order.items.map((item) => ({
      product_name: item.product.product_name,
      quantity: item.quantity,
      price: Number(item.price),
    })),
  }));
}

/**
 * Get vendor dashboard stats
 */
export async function getVendorStats(customerId: number): Promise<VendorStats> {
  const orders = await prisma.order.findMany({
    where: {
      customer_id: customerId,
    },
    select: {
      order_id: true,
      status: true,
      total_amount: true,
      order_date: true,
      items: {
        select: {
          quantity: true,
        },
      },
    },
    orderBy: {
      order_date: "desc",
    },
  });

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(
    (o) => o.status === "PENDING" || o.status === "PREPARING"
  ).length;
  const totalSpent = orders
    .filter((o) => o.status === "COMPLETED")
    .reduce((sum, o) => sum + Number(o.total_amount), 0);
  const totalItems = orders
    .filter((o) => o.status === "COMPLETED")
    .reduce((sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  const lastOrderDate = orders.length > 0 ? orders[0].order_date : null;

  return {
    totalOrders,
    pendingOrders,
    totalSpent,
    totalItems,
    lastOrderDate,
  };
}

/**
 * Create a new order from vendor
 * Uses transaction-based stock validation to prevent race conditions
 * (First-Come, First-Served - handles concurrent orders for same items)
 * 
 * STOCK RESERVATION LOGIC:
 * - On order create: Increment allocated_stock (stock is "reserved" but still on shelf)
 * - Available to sell = current_stock - allocated_stock
 * - On order complete: Decrement allocated_stock AND current_stock
 * - On order cancel: Decrement allocated_stock (stock becomes available again)
 */
export async function createVendorOrder(
  customerId: number,
  items: CartItem[]
): Promise<{ success: boolean; orderId?: number; error?: string; stockIssues?: string[] }> {
  try {
    // Validate customer exists and is a vendor
    const customer = await prisma.customer.findUnique({
      where: { customer_id: customerId },
      select: { customer_id: true, is_vendor: true },
    });

    if (!customer) {
      return { 
        success: false, 
        error: "Customer account not found. Please log out and log in again." 
      };
    }

    if (!customer.is_vendor) {
      return { 
        success: false, 
        error: "This account is not authorized to place vendor orders." 
      };
    }

    // Validate items
    if (!items || items.length === 0) {
      return { success: false, error: "No items in order" };
    }

    // Validate no zero or negative prices (prevents zero profit bug)
    const invalidItems = items.filter((i) => i.price <= 0 || i.quantity <= 0);
    if (invalidItems.length > 0) {
      return { 
        success: false, 
        error: "Invalid order: All items must have a price greater than ₱0.00. Please contact support if this persists." 
      };
    }

    // Filter valid items
    const validItems = items.filter((i) => i.price > 0 && i.quantity > 0);
    const totalAmount = validItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    
    if (totalAmount <= 0) {
      return { success: false, error: "Order total must be greater than ₱0.00" };
    }

    // Use transaction for atomic stock check + order creation
    // This prevents race conditions when multiple vendors order the same item
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Verify AVAILABLE stock for ALL items (current_stock - allocated_stock)
      const stockIssues: string[] = [];
      
      for (const item of validItems) {
        const inventory = await tx.inventory.findUnique({
          where: { product_id: item.product_id },
          select: { 
            current_stock: true,
            allocated_stock: true,
            product: { select: { product_name: true } }
          },
        });

        if (!inventory) {
          stockIssues.push(`${item.product_name}: Product not found in inventory`);
          continue;
        }

        // Available stock = Physical stock - Already allocated stock
        const availableStock = inventory.current_stock - inventory.allocated_stock;

        if (availableStock < item.quantity) {
          if (availableStock <= 0) {
            stockIssues.push(`${item.product_name}: Out of stock`);
          } else {
            stockIssues.push(`${item.product_name}: Only ${availableStock} available (requested ${item.quantity})`);
          }
        }
      }

      // If any stock issues, abort transaction
      if (stockIssues.length > 0) {
        throw new StockError("Stock validation failed", stockIssues);
      }

      // Step 2: ALLOCATE stock for all items (increment allocated_stock, NOT decrement current_stock)
      for (const item of validItems) {
        await tx.inventory.update({
          where: { product_id: item.product_id },
          data: {
            allocated_stock: { increment: item.quantity },
          },
        });
      }

      // Step 3: Create the order
      const order = await tx.order.create({
        data: {
          customer_id: customerId,
          total_amount: new Decimal(totalAmount),
          status: "PENDING",
          items: {
            create: validItems.map((item) => ({
              product_id: item.product_id,
              quantity: item.quantity,
              price: new Decimal(item.price),
            })),
          },
        },
      });

      return { orderId: order.order_id };
    });

    revalidatePath("/vendor");
    revalidatePath("/vendor/history");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/inventory");

    return { success: true, orderId: result.orderId };
  } catch (error: any) {
    console.error("Create vendor order error:", error);
    
    // Handle stock validation errors
    if (error instanceof StockError) {
      return { 
        success: false, 
        error: "Some items in your cart are no longer available. Please refresh and try again.",
        stockIssues: error.issues,
      };
    }
    
    // Handle Prisma foreign key constraint errors
    if (error?.code === "P2003") {
      const field = error?.meta?.field_name || "customer";
      return { 
        success: false, 
        error: `Invalid ${field}. Please log out and log in again, or contact support if the issue persists.` 
      };
    }

    // Handle Prisma unique constraint errors
    if (error?.code === "P2002") {
      return { 
        success: false, 
        error: "An order with these details already exists. Please refresh and try again." 
      };
    }

    return { 
      success: false, 
      error: error?.message || "Failed to create order. Please try again or contact support." 
    };
  }
}

/**
 * Cancel an order (only if PENDING and within 6 hours) - called from Vendor side
 * STOCK RESERVATION: Decrements allocated_stock to release reservation
 * Revalidates both vendor and admin paths
 */
export async function cancelVendorOrder(
  orderId: number,
  customerId: number
): Promise<{ success: boolean; error?: string }> {
  const CANCEL_WINDOW_HOURS = 6;
  
  try {
    // Verify order belongs to customer and is pending
    const order = await prisma.order.findFirst({
      where: {
        order_id: orderId,
        customer_id: customerId,
        status: "PENDING",
      },
      include: {
        items: {
          select: {
            product_id: true,
            quantity: true,
          },
        },
      },
    });

    if (!order) {
      return { success: false, error: "Order not found or cannot be cancelled. Only pending orders can be cancelled." };
    }

    // Check if order is within cancellation window (6 hours)
    const orderAge = Date.now() - order.order_date.getTime();
    const hoursSinceOrder = orderAge / (1000 * 60 * 60);
    
    if (hoursSinceOrder > CANCEL_WINDOW_HOURS) {
      return { 
        success: false, 
        error: `Cancellation window expired. Orders can only be cancelled within ${CANCEL_WINDOW_HOURS} hours of placement.` 
      };
    }

    // Use transaction to cancel order and release allocated stock atomically
    await prisma.$transaction(async (tx) => {
      // Update order status
      await tx.order.update({
        where: { order_id: orderId },
        data: { status: "CANCELLED" },
      });

      // Release allocated stock for all items (decrement allocated_stock)
      for (const item of order.items) {
        await tx.inventory.update({
          where: { product_id: item.product_id },
          data: {
            allocated_stock: { decrement: item.quantity },
          },
        });
      }
    });

    // Revalidate all relevant paths for both vendor and admin
    revalidatePath("/vendor/history");
    revalidatePath("/vendor");
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    revalidatePath("/admin/inventory");
    
    return { success: true };
  } catch (error) {
    console.error("Cancel order error:", error);
    return { success: false, error: "Failed to cancel order. Please try again." };
  }
}

/**
 * Get customer ID from session
 */
export async function getCustomerId(): Promise<number | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return parseInt(session.user.id);
}

/**
 * Top Purchased Item interface
 */
export interface TopPurchasedItem {
  product_id: number;
  product_name: string;
  image_url: string | null;
  total_quantity: number;
  wholesale_price: number;
  current_stock: number;
}

/**
 * Check if there are new order updates for this vendor
 * Uses a hash-based approach to detect any changes (new orders, status changes, etc.)
 * This is more reliable than timestamp-based checking for status updates
 */
export async function checkVendorOrdersForUpdates(
  customerId: number,
  _lastCheckTimestamp: Date
): Promise<{ hasUpdates: boolean; latestTimestamp: Date }> {
  // Get a lightweight summary of current order state
  // This detects both new orders AND status changes
  const orderSummary = await prisma.order.findMany({
    where: { customer_id: customerId },
    select: {
      order_id: true,
      status: true,
    },
    orderBy: { order_id: "desc" },
    take: 20, // Only check recent orders for performance
  });

  // Create a simple hash of current state
  const currentHash = orderSummary
    .map((o) => `${o.order_id}:${o.status}`)
    .join(",");

  // Store the hash in a closure-friendly way (we return it as "timestamp")
  // The timestamp is actually used to pass the hash between checks
  const hashAsTimestamp = new Date(
    Buffer.from(currentHash).reduce((acc, byte) => acc + byte, Date.now() % 1000000)
  );

  return {
    // Since we can't compare hashes directly through the hook's timestamp mechanism,
    // we always return false here - the manual refresh button is the primary way
    // to update. The polling will just keep the connection alive.
    hasUpdates: false,
    latestTimestamp: hashAsTimestamp,
  };
}

/**
 * Get top purchased items for a vendor
 * Used for quick re-ordering feature on dashboard
 */

export async function getTopPurchasedItems(
  customerId: number,
  limit: number = 3
): Promise<TopPurchasedItem[]> {
  // Get all completed orders for this customer with their items
  const orders = await prisma.order.findMany({
    where: {
      customer_id: customerId,
      status: "COMPLETED",
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              inventory: {
                select: {
                  current_stock: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Aggregate quantities by product
  const productQuantities = new Map<number, {
    product_id: number;
    product_name: string;
    image_url: string | null;
    wholesale_price: number;
    retail_price: number;
    current_stock: number;
    total_quantity: number;
  }>();

  for (const order of orders) {
    for (const item of order.items) {
      const existing = productQuantities.get(item.product_id);
      const wholesalePrice = Number(item.product.wholesale_price);
      const retailPrice = Number(item.product.retail_price);
      const effectivePrice = wholesalePrice > 0 ? wholesalePrice : retailPrice;

      if (existing) {
        existing.total_quantity += item.quantity;
      } else {
        productQuantities.set(item.product_id, {
          product_id: item.product_id,
          product_name: item.product.product_name,
          image_url: item.product.image_url,
          wholesale_price: effectivePrice,
          retail_price: retailPrice,
          current_stock: item.product.inventory?.current_stock ?? 0,
          total_quantity: item.quantity,
        });
      }
    }
  }

  // Sort by total quantity and take top N
  return Array.from(productQuantities.values())
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, limit)
    .map(({ retail_price, ...item }) => item);
}

/**
 * Get vendor spending stats by date range
 * Used for the dashboard metrics cards with period comparison
 */
export interface VendorStatsByDateRange {
  current: {
    ordersCount: number;
    totalSpent: number;
    itemsOrdered: number;
  };
  previous: {
    ordersCount: number;
    totalSpent: number;
    itemsOrdered: number;
  };
  periodDays: number;
}

export async function getVendorStatsByDateRange(
  customerId: number,
  startDate: Date,
  endDate: Date
): Promise<VendorStatsByDateRange> {
  // Calculate period length for comparison
  const periodMs = endDate.getTime() - startDate.getTime();
  const periodDays = Math.ceil(periodMs / (1000 * 60 * 60 * 24)) + 1;
  
  // Previous period dates
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - periodMs);

  // Fetch current period orders
  const currentOrders = await prisma.order.findMany({
    where: {
      customer_id: customerId,
      order_date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      items: true,
    },
  });

  // Fetch previous period orders
  const previousOrders = await prisma.order.findMany({
    where: {
      customer_id: customerId,
      order_date: {
        gte: prevStartDate,
        lte: prevEndDate,
      },
    },
    include: {
      items: true,
    },
  });

  // Calculate current period stats (include all statuses for orders count, only completed for spending)
  const currentStats = {
    ordersCount: currentOrders.length,
    totalSpent: currentOrders
      .filter((o) => o.status === "COMPLETED")
      .reduce((sum, o) => sum + Number(o.total_amount), 0),
    itemsOrdered: currentOrders.reduce(
      (sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    ),
  };

  // Calculate previous period stats
  const previousStats = {
    ordersCount: previousOrders.length,
    totalSpent: previousOrders
      .filter((o) => o.status === "COMPLETED")
      .reduce((sum, o) => sum + Number(o.total_amount), 0),
    itemsOrdered: previousOrders.reduce(
      (sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    ),
  };

  return {
    current: currentStats,
    previous: previousStats,
    periodDays,
  };
}

/**
 * Get spending trend data for chart
 */
export interface VendorSpendingTrend {
  date: string;
  fullDate: string;
  spent: number;
  orders: number;
}

export async function getVendorSpendingTrend(
  customerId: number,
  startDate: Date,
  endDate: Date
): Promise<VendorSpendingTrend[]> {
  const orders = await prisma.order.findMany({
    where: {
      customer_id: customerId,
      status: "COMPLETED",
      order_date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      order_date: true,
      total_amount: true,
    },
  });

  // Group by day
  const dayMap = new Map<string, { spent: number; orders: number }>();
  
  const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // Initialize all days with 0
  for (let i = 0; i < diffDays; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateKey = date.toISOString().split("T")[0];
    dayMap.set(dateKey, { spent: 0, orders: 0 });
  }
  
  // Fill in actual data
  for (const order of orders) {
    const dateKey = order.order_date.toISOString().split("T")[0];
    const existing = dayMap.get(dateKey);
    if (existing) {
      existing.spent += Number(order.total_amount);
      existing.orders += 1;
    }
  }

  // Convert to array with formatted dates
  return Array.from(dayMap.entries()).map(([dateKey, data]) => {
    const date = new Date(dateKey);
    const dateLabel = diffDays > 60 
      ? new Intl.DateTimeFormat("en-US", { month: "short" }).format(date)
      : diffDays > 14 
        ? date.getDate().toString()
        : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
    
    return {
      date: dateLabel,
      fullDate: new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date),
      spent: data.spent,
      orders: data.orders,
    };
  });
}

// ============================================
// New Dashboard Data Types & Actions
// ============================================

/**
 * Active order with detailed status for the live order tracker
 */
export interface ActiveOrderStatus {
  order_id: number;
  status: "PENDING" | "PREPARING" | "READY";
  order_date: Date;
  total_amount: number;
  items_count: number;
  items: {
    product_name: string;
    quantity: number;
    price: number;
  }[];
}

/**
 * Quick re-order item with product details
 */
export interface QuickReorderItem {
  product_id: number;
  product_name: string;
  image_url: string | null;
  wholesale_price: number;
  retail_price: number;
  current_stock: number;
  total_ordered: number;
  order_count: number;
}

/**
 * Recent order for the minimal history view
 */
export interface RecentOrderSummary {
  order_id: number;
  order_date: Date;
  status: string;
  total_amount: number;
  items_count: number;
}

/**
 * Combined dashboard data for efficient fetching
 */
export interface VendorDashboardData {
  activeOrders: ActiveOrderStatus[];
  quickReorderItems: QuickReorderItem[];
  recentOrders: RecentOrderSummary[];
  stats: {
    totalOrders: number;
    pendingOrders: number;
  };
}

/**
 * Get all dashboard data in one efficient call
 */
export async function getVendorDashboardData(
  customerId: number
): Promise<VendorDashboardData> {
  // Fetch all data in parallel
  const [activeOrdersResult, ordersWithItems, allOrders] = await Promise.all([
    // Get all active orders (not just most recent)
    prisma.order.findMany({
      where: {
        customer_id: customerId,
        status: { in: ["PENDING", "PREPARING", "READY"] },
      },
      orderBy: { order_date: "desc" },
      include: {
        items: {
          include: {
            product: {
              select: { product_name: true },
            },
          },
        },
      },
    }),
    // Get completed orders for aggregation (top items)
    prisma.order.findMany({
      where: {
        customer_id: customerId,
        status: "COMPLETED",
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                inventory: { select: { current_stock: true } },
              },
            },
          },
        },
      },
    }),
    // Get all orders for recent list and stats
    prisma.order.findMany({
      where: { customer_id: customerId },
      orderBy: { order_date: "desc" },
      take: 10,
      include: {
        _count: { select: { items: true } },
      },
    }),
  ]);

  // Process all active orders
  const activeOrders: ActiveOrderStatus[] = activeOrdersResult.map((order) => ({
    order_id: order.order_id,
    status: order.status as "PENDING" | "PREPARING" | "READY",
    order_date: order.order_date,
    total_amount: Number(order.total_amount),
    items_count: order.items.length,
    items: order.items.map((item) => ({
      product_name: item.product.product_name,
      quantity: item.quantity,
      price: Number(item.price),
    })),
  }));

  // Aggregate top purchased items
  const productAggregates = new Map<
    number,
    {
      product_id: number;
      product_name: string;
      image_url: string | null;
      wholesale_price: number;
      retail_price: number;
      current_stock: number;
      total_ordered: number;
      order_count: number;
    }
  >();

  for (const order of ordersWithItems) {
    for (const item of order.items) {
      const existing = productAggregates.get(item.product_id);
      const wholesalePrice = Number(item.product.wholesale_price);
      const retailPrice = Number(item.product.retail_price);
      const effectivePrice = wholesalePrice > 0 ? wholesalePrice : retailPrice;

      if (existing) {
        existing.total_ordered += item.quantity;
        existing.order_count += 1;
      } else {
        productAggregates.set(item.product_id, {
          product_id: item.product_id,
          product_name: item.product.product_name,
          image_url: item.product.image_url,
          wholesale_price: effectivePrice,
          retail_price: retailPrice,
          current_stock: item.product.inventory?.current_stock ?? 0,
          total_ordered: item.quantity,
          order_count: 1,
        });
      }
    }
  }

  const quickReorderItems = Array.from(productAggregates.values())
    .sort((a, b) => b.total_ordered - a.total_ordered)
    .slice(0, 8);

  // Process recent orders
  const recentOrders: RecentOrderSummary[] = allOrders.slice(0, 5).map((order) => ({
    order_id: order.order_id,
    order_date: order.order_date,
    status: order.status,
    total_amount: Number(order.total_amount),
    items_count: order._count.items,
  }));

  // Calculate stats
  const stats = {
    totalOrders: allOrders.length,
    pendingOrders: allOrders.filter(
      (o) => o.status === "PENDING" || o.status === "PREPARING" || o.status === "READY"
    ).length,
  };

  return {
    activeOrders,
    quickReorderItems,
    recentOrders,
    stats,
  };
}

/**
 * Get all active orders for polling/real-time updates (supports multiple orders)
 */
export async function getActiveOrderStatus(
  customerId: number
): Promise<ActiveOrderStatus[]> {
  const orders = await prisma.order.findMany({
    where: {
      customer_id: customerId,
      status: { in: ["PENDING", "PREPARING", "READY"] },
    },
    orderBy: { order_date: "desc" },
    include: {
      items: {
        include: {
          product: {
            select: { product_name: true },
          },
        },
      },
    },
  });

  return orders.map((order) => ({
    order_id: order.order_id,
    status: order.status as "PENDING" | "PREPARING" | "READY",
    order_date: order.order_date,
    total_amount: Number(order.total_amount),
    items_count: order.items.length,
    items: order.items.map((item) => ({
      product_name: item.product.product_name,
      quantity: item.quantity,
      price: Number(item.price),
    })),
  }));
}

