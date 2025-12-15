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

  return products.map((product) => {
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
    };
  });
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
    // Validate items
    if (!items || items.length === 0) {
      return { success: false, error: "No items in order" };
    }

    // Calculate total
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Create order with items
    const order = await prisma.order.create({
      data: {
        customer_id: customerId,
        total_amount: new Decimal(totalAmount),
        status: "PENDING",
        items: {
          create: items.map((item) => ({
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
  } catch (error) {
    console.error("Create vendor order error:", error);
    return { success: false, error: "Failed to create order" };
  }
}

/**
 * Cancel an order (only if PENDING)
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

    revalidatePath("/vendor/history");
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

