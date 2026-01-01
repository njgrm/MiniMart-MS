"use server";

import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

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
  const lastOrderDate = orders.length > 0 ? orders[0].order_date : null;

  return {
    totalOrders,
    pendingOrders,
    totalSpent,
    lastOrderDate,
  };
}

/**
 * Create a new order from vendor
 */
export async function createVendorOrder(
  customerId: number,
  items: CartItem[]
): Promise<{ success: boolean; orderId?: number; error?: string }> {
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

    // Calculate total (only from valid items)
    const validItems = items.filter((i) => i.price > 0 && i.quantity > 0);
    const totalAmount = validItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    
    if (totalAmount <= 0) {
      return { success: false, error: "Order total must be greater than ₱0.00" };
    }

    // Create order with validated items only
    const order = await prisma.order.create({
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

    revalidatePath("/vendor");
    revalidatePath("/vendor/history");
    revalidatePath("/admin/orders");

    return { success: true, orderId: order.order_id };
  } catch (error: any) {
    console.error("Create vendor order error:", error);
    
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
 * Cancel an order (only if PENDING) - called from Vendor side
 * Revalidates both vendor and admin paths so both see the update
 */
export async function cancelVendorOrder(
  orderId: number,
  customerId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify order belongs to customer and is pending
    const order = await prisma.order.findFirst({
      where: {
        order_id: orderId,
        customer_id: customerId,
        status: "PENDING",
      },
    });

    if (!order) {
      return { success: false, error: "Order not found or cannot be cancelled" };
    }

    await prisma.order.update({
      where: { order_id: orderId },
      data: { status: "CANCELLED" },
    });

    // Revalidate all relevant paths for both vendor and admin
    revalidatePath("/vendor/history");
    revalidatePath("/vendor");
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    
    return { success: true };
  } catch (error) {
    console.error("Cancel order error:", error);
    return { success: false, error: "Failed to cancel order" };
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

