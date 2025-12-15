"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Order Status Types
 * PENDING - Order placed, awaiting preparation
 * PREPARING - Being packed/prepared
 * READY - Ready for pickup/delivery
 * COMPLETED - Order fulfilled, converted to transaction
 * CANCELLED - Order was cancelled
 */
export type OrderStatus = "PENDING" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";

export interface OrderItem {
  order_item_id: number;
  product_id: number;
  quantity: number;
  price: number;
  product: {
    product_id: number;
    product_name: string;
    barcode: string | null;
    image_url: string | null;
    cost_price: number;
    retail_price: number;
  };
}

export interface IncomingOrder {
  order_id: number;
  customer_id: number;
  order_date: Date;
  status: OrderStatus;
  total_amount: number;
  customer: {
    customer_id: number;
    name: string;
    contact_details: string | null;
    email: string | null;
  };
  items: OrderItem[];
}

export interface GroupedOrders {
  pending: IncomingOrder[];
  preparing: IncomingOrder[];
  ready: IncomingOrder[];
}

/**
 * Get all incoming orders (non-completed, non-cancelled)
 * Sorted by oldest first (FIFO)
 */
export async function getIncomingOrders(): Promise<GroupedOrders> {
  const orders = await prisma.order.findMany({
    where: {
      status: {
        in: ["PENDING", "PREPARING", "READY"],
      },
    },
    include: {
      customer: {
        select: {
          customer_id: true,
          name: true,
          contact_details: true,
          email: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              product_id: true,
              product_name: true,
              barcode: true,
              image_url: true,
              cost_price: true,
              retail_price: true,
            },
          },
        },
      },
    },
    orderBy: {
      order_date: "asc", // Oldest first (FIFO)
    },
  });

  // Transform Decimal values to numbers
  const transformedOrders: IncomingOrder[] = orders.map((order) => ({
    order_id: order.order_id,
    customer_id: order.customer_id,
    order_date: order.order_date,
    status: order.status as OrderStatus,
    total_amount: Number(order.total_amount),
    customer: order.customer,
    items: order.items.map((item) => ({
      order_item_id: item.order_item_id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: Number(item.price),
      product: {
        product_id: item.product.product_id,
        product_name: item.product.product_name,
        barcode: item.product.barcode,
        image_url: item.product.image_url,
        cost_price: Number(item.product.cost_price),
        retail_price: Number(item.product.retail_price),
      },
    })),
  }));

  // Group orders by status
  const grouped: GroupedOrders = {
    pending: transformedOrders.filter((o) => o.status === "PENDING"),
    preparing: transformedOrders.filter((o) => o.status === "PREPARING"),
    ready: transformedOrders.filter((o) => o.status === "READY"),
  };

  return grouped;
}

/**
 * Get count of pending orders (for sidebar badge)
 */
export async function getPendingOrdersCount(): Promise<number> {
  const count = await prisma.order.count({
    where: {
      status: "PENDING",
    },
  });
  return count;
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: number,
  newStatus: OrderStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.order.update({
      where: { order_id: orderId },
      data: { status: newStatus },
    });

    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    
    return { success: true };
  } catch (error) {
    console.error("Failed to update order status:", error);
    return { success: false, error: "Failed to update order status" };
  }
}

/**
 * Cancel an order
 */
export async function cancelOrder(
  orderId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.order.update({
      where: { order_id: orderId },
      data: { status: "CANCELLED" },
    });

    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    
    return { success: true };
  } catch (error) {
    console.error("Failed to cancel order:", error);
    return { success: false, error: "Failed to cancel order" };
  }
}

/**
 * Complete order and convert to sales transaction
 * This is the critical function that:
 * 1. Creates a Transaction record
 * 2. Creates TransactionItem records (with cost_at_sale captured)
 * 3. Deducts inventory
 * 4. Creates Payment record
 * 5. Updates Order status to COMPLETED
 * 
 * All operations are atomic via Prisma transaction
 */
export async function completeOrderTransaction(
  orderId: number,
  paymentMethod: "CASH" | "GCASH",
  userId: number = 1 // Default to admin user if not provided
): Promise<{ success: boolean; error?: string; transactionId?: number; receiptNo?: string }> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get the order with items
      const order = await tx.order.findUnique({
        where: { order_id: orderId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  inventory: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      if (order.status === "COMPLETED") {
        throw new Error("Order is already completed");
      }

      if (order.status === "CANCELLED") {
        throw new Error("Cannot complete a cancelled order");
      }

      // 2. Verify stock availability
      for (const item of order.items) {
        const currentStock = item.product.inventory?.current_stock || 0;
        if (currentStock < item.quantity) {
          throw new Error(
            `Insufficient stock for ${item.product.product_name}. Available: ${currentStock}, Requested: ${item.quantity}`
          );
        }
      }

      // 3. Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          user_id: userId,
          customer_id: order.customer_id,
          order_id: order.order_id,
          total_amount: order.total_amount,
          status: "COMPLETED",
          items: {
            create: order.items.map((item) => ({
              product_id: item.product_id,
              quantity: item.quantity,
              price_at_sale: item.price,
              cost_at_sale: item.product.cost_price, // Capture current cost
              subtotal: new Decimal(Number(item.price) * item.quantity),
            })),
          },
        },
      });

      // 4. Create payment record
      await tx.payment.create({
        data: {
          transaction_id: transaction.transaction_id,
          payment_method: paymentMethod,
          amount_tendered: order.total_amount,
          change: new Decimal(0), // No change for order payments
        },
      });

      // 5. Deduct inventory for each item
      for (const item of order.items) {
        if (item.product.inventory) {
          await tx.inventory.update({
            where: { inventory_id: item.product.inventory.inventory_id },
            data: {
              current_stock: {
                decrement: item.quantity,
              },
            },
          });
        }
      }

      // 6. Update order status to COMPLETED
      await tx.order.update({
        where: { order_id: orderId },
        data: { status: "COMPLETED" },
      });

      return transaction;
    });

    revalidatePath("/admin/orders");
    revalidatePath("/admin/sales");
    revalidatePath("/admin/inventory");
    revalidatePath("/admin");

    return {
      success: true,
      transactionId: result.transaction_id,
      receiptNo: result.receipt_no,
    };
  } catch (error) {
    console.error("Failed to complete order transaction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to complete order",
    };
  }
}

/**
 * Get a single order by ID with full details
 */
export async function getOrderById(orderId: number): Promise<IncomingOrder | null> {
  const order = await prisma.order.findUnique({
    where: { order_id: orderId },
    include: {
      customer: {
        select: {
          customer_id: true,
          name: true,
          contact_details: true,
          email: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              product_id: true,
              product_name: true,
              barcode: true,
              image_url: true,
              cost_price: true,
              retail_price: true,
            },
          },
        },
      },
    },
  });

  if (!order) return null;

  return {
    order_id: order.order_id,
    customer_id: order.customer_id,
    order_date: order.order_date,
    status: order.status as OrderStatus,
    total_amount: Number(order.total_amount),
    customer: order.customer,
    items: order.items.map((item) => ({
      order_item_id: item.order_item_id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: Number(item.price),
      product: {
        product_id: item.product.product_id,
        product_name: item.product.product_name,
        barcode: item.product.barcode,
        image_url: item.product.image_url,
        cost_price: Number(item.product.cost_price),
        retail_price: Number(item.product.retail_price),
      },
    })),
  };
}

