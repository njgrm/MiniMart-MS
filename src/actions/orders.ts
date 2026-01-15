"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { logOrderCancel } from "@/lib/logger";

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
 * Also auto-cancels orders older than 48 hours
 */
export async function getIncomingOrders(): Promise<GroupedOrders> {
  // Auto-cancel expired orders first (fire and forget, don't block main query)
  autoCancelExpiredOrders(48).catch(console.error);

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
 * Get recently completed orders for dashboard display
 */
export async function getRecentCompletedOrders(limit: number = 10): Promise<IncomingOrder[]> {
  const orders = await prisma.order.findMany({
    where: {
      status: "COMPLETED",
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
      order_date: "desc", // Most recent first
    },
    take: limit,
  });

  // Transform Decimal values to numbers
  return orders.map((order) => ({
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
 * Cancel an order (called from Admin side)
 * STOCK RESERVATION: Releases allocated_stock back to available pool
 * Revalidates both admin and vendor paths so both see the update
 */
export async function cancelOrder(
  orderId: number,
  reason?: string
): Promise<{ success: boolean; error?: string; customerId?: number }> {
  try {
    // First get the order with items and customer to release allocated stock
    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            product_id: true,
            quantity: true,
          },
        },
      },
    });

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // Only release stock if order was in a state where stock was allocated
    const shouldReleaseStock = order.status === "PENDING" || order.status === "PREPARING" || order.status === "READY";

    await prisma.$transaction(async (tx) => {
      // Update order status
      await tx.order.update({
        where: { order_id: orderId },
        data: { status: "CANCELLED" },
      });

      // Release allocated stock if applicable
      if (shouldReleaseStock) {
        for (const item of order.items) {
          await tx.inventory.update({
            where: { product_id: item.product_id },
            data: {
              allocated_stock: { decrement: item.quantity },
            },
          });
        }
      }
    });

    // Revalidate all relevant paths for both admin and vendor
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    revalidatePath("/vendor/history");
    revalidatePath("/vendor");
    
    // Audit log: Order cancelled
    await logOrderCancel(
      "Admin", // TODO: Get from session
      orderId,
      Number(order.total_amount),
      order.customer?.name,
      reason
    );
    
    return { success: true, customerId: order.customer_id };
  } catch (error) {
    console.error("Failed to cancel order:", error);
    return { success: false, error: "Failed to cancel order" };
  }
}

// Receipt data interface for auto-printing
export interface OrderReceiptData {
  receiptNo: string;
  transactionId: number;
  date: Date;
  customerName: string;
  cashierName: string;
  items: {
    name: string;
    barcode: string | null;
    quantity: number;
    price: number;
    subtotal: number;
  }[];
  subtotal: number;
  totalDue: number;
  paymentMethod: "CASH" | "GCASH";
}

/**
 * Complete order and convert to sales transaction
 * This is the critical function that:
 * 1. Creates a Transaction record
 * 2. Creates TransactionItem records (with cost_at_sale captured)
 * 3. Deducts inventory (both allocated_stock AND current_stock)
 * 4. Creates Payment record
 * 5. Updates Order status to COMPLETED
 * 
 * STOCK RESERVATION LOGIC:
 * - Decrement allocated_stock (release reservation)
 * - Decrement current_stock (physically remove from inventory)
 * 
 * Returns full receipt data for auto-printing
 * All operations are atomic via Prisma transaction
 */
export async function completeOrderTransaction(
  orderId: number,
  paymentMethod: "CASH" | "GCASH",
  userId: number = 1, // Default to admin user if not provided
  amountTendered?: number,
  change?: number,
  gcashRefNo?: string
): Promise<{ success: boolean; error?: string; transactionId?: number; receiptNo?: string; receiptData?: OrderReceiptData }> {
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

      // 2. Verify stock availability (check current_stock, as allocated should already be reserved)
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
          amount_tendered: amountTendered !== undefined 
            ? new Decimal(amountTendered) 
            : order.total_amount,
          change: change !== undefined 
            ? new Decimal(change) 
            : new Decimal(0),
          gcash_reference_no: gcashRefNo || null,
        },
      });

      // 5. Deduct inventory for each item (both allocated_stock AND current_stock)
      for (const item of order.items) {
        if (item.product.inventory) {
          await tx.inventory.update({
            where: { inventory_id: item.product.inventory.inventory_id },
            data: {
              current_stock: { decrement: item.quantity },
              allocated_stock: { decrement: item.quantity },
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

    // Fetch the order again to get customer and item details for receipt
    const completedOrder = await prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        customer: true,
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
      },
    });

    // Build receipt data
    const receiptData: OrderReceiptData = {
      receiptNo: result.receipt_no,
      transactionId: result.transaction_id,
      date: result.created_at,
      customerName: completedOrder?.customer.name || "Customer",
      cashierName: "Admin", // TODO: Get from session
      items: completedOrder?.items.map((item) => ({
        name: item.product.product_name,
        barcode: item.product.barcode,
        quantity: item.quantity,
        price: Number(item.price),
        subtotal: Number(item.price) * item.quantity,
      })) || [],
      subtotal: Number(completedOrder?.total_amount || 0),
      totalDue: Number(completedOrder?.total_amount || 0),
      paymentMethod,
    };

    revalidatePath("/admin/orders");
    revalidatePath("/admin/sales");
    revalidatePath("/admin/inventory");
    revalidatePath("/admin");

    return {
      success: true,
      transactionId: result.transaction_id,
      receiptNo: result.receipt_no,
      receiptData,
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
/**
 * Check if there are new order updates since a given timestamp
 * Used for "pulse checking" - lightweight polling without full data fetch
 * Returns true if there are updates, false otherwise
 */
export async function checkOrdersForUpdates(
  lastCheckTimestamp: Date
): Promise<{ hasUpdates: boolean; latestTimestamp: Date }> {
  // Find the most recent order update (order_date or modified status)
  const latestOrder = await prisma.order.findFirst({
    where: {
      OR: [
        { order_date: { gt: lastCheckTimestamp } },
        // Check if any order was modified after lastCheckTimestamp
        // We use order_date as a proxy since we don't have updated_at
      ],
    },
    orderBy: {
      order_date: "desc",
    },
    select: {
      order_date: true,
    },
  });

  // Also check for any status changes by looking at recent active orders count
  const currentCounts = await prisma.order.groupBy({
    by: ["status"],
    where: {
      status: {
        in: ["PENDING", "PREPARING", "READY"],
      },
    },
    _count: true,
  });

  const latestTimestamp = latestOrder?.order_date || lastCheckTimestamp;
  
  // Return hasUpdates: true if there's a newer order
  return {
    hasUpdates: latestOrder !== null && latestOrder.order_date > lastCheckTimestamp,
    latestTimestamp,
  };
}

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

/**
 * Shortage Reason Types for marking items unavailable
 */
export type ShortageReason = "DAMAGE" | "MISSING" | "INTERNAL_USE";

/**
 * Mark an order item as unavailable (shortage handling)
 * 
 * This is used when admin is packing an order but finds an item is damaged/missing.
 * 
 * Logic:
 * 1. Remove or reduce the item from the order
 * 2. Recalculate order total
 * 3. Create inventory adjustment (stock movement record)
 * 4. Decrement both current_stock and allocated_stock
 * 
 * @param orderId - The order to modify
 * @param orderItemId - The specific order item to mark unavailable
 * @param quantityUnavailable - How many units are unavailable (can be partial)
 * @param reason - Why the item is unavailable (DAMAGE, MISSING, INTERNAL_USE)
 * @param notes - Optional additional notes
 * @param userId - The admin user making this change
 */
export async function markOrderItemUnavailable(
  orderId: number,
  orderItemId: number,
  quantityUnavailable: number,
  reason: ShortageReason,
  notes?: string,
  userId: number = 1
): Promise<{ 
  success: boolean; 
  error?: string; 
  newTotal?: number;
  itemRemoved?: boolean;
  productName?: string;
}> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get the order and verify it's modifiable
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

      // Only allow modifications on PENDING or PREPARING orders
      if (order.status !== "PENDING" && order.status !== "PREPARING") {
        throw new Error("Can only modify items on Pending or Preparing orders");
      }

      // 2. Find the specific order item
      const orderItem = order.items.find((item) => item.order_item_id === orderItemId);
      if (!orderItem) {
        throw new Error("Order item not found");
      }

      const productName = orderItem.product.product_name;
      const inventory = orderItem.product.inventory;

      if (!inventory) {
        throw new Error("Product inventory not found");
      }

      // Validate quantity
      if (quantityUnavailable <= 0) {
        throw new Error("Quantity must be greater than 0");
      }

      if (quantityUnavailable > orderItem.quantity) {
        throw new Error(`Cannot mark ${quantityUnavailable} unavailable. Order only has ${orderItem.quantity}`);
      }

      const willRemoveItem = quantityUnavailable === orderItem.quantity;
      const itemTotal = Number(orderItem.price) * quantityUnavailable;

      // 3. Create stock movement record for the shortage
      const movementType = reason === "DAMAGE" 
        ? "DAMAGE" 
        : reason === "INTERNAL_USE" 
          ? "INTERNAL_USE" 
          : "ORDER_SHORTAGE";

      await tx.stockMovement.create({
        data: {
          inventory_id: inventory.inventory_id,
          user_id: userId,
          movement_type: movementType,
          quantity_change: -quantityUnavailable, // Negative for removal
          previous_stock: inventory.current_stock,
          new_stock: inventory.current_stock - quantityUnavailable,
          reason: notes || `Order #${orderId} - Item marked ${reason.toLowerCase()}`,
          reference: `ORDER-${orderId}`,
        },
      });

      // 4. Update inventory (decrement BOTH current_stock and allocated_stock)
      await tx.inventory.update({
        where: { inventory_id: inventory.inventory_id },
        data: {
          current_stock: { decrement: quantityUnavailable },
          allocated_stock: { decrement: quantityUnavailable },
        },
      });

      // 5. Update or remove the order item
      if (willRemoveItem) {
        // Remove the item entirely
        await tx.orderItem.delete({
          where: { order_item_id: orderItemId },
        });
      } else {
        // Reduce the quantity
        await tx.orderItem.update({
          where: { order_item_id: orderItemId },
          data: {
            quantity: { decrement: quantityUnavailable },
          },
        });
      }

      // 6. Recalculate and update order total
      const newTotal = Number(order.total_amount) - itemTotal;
      
      // Check if order still has items
      const remainingItems = willRemoveItem 
        ? order.items.length - 1 
        : order.items.length;

      if (remainingItems === 0) {
        // If no items left, cancel the order
        await tx.order.update({
          where: { order_id: orderId },
          data: { 
            status: "CANCELLED",
            total_amount: new Decimal(0),
          },
        });
      } else {
        await tx.order.update({
          where: { order_id: orderId },
          data: { total_amount: new Decimal(Math.max(0, newTotal)) },
        });
      }

      return {
        newTotal: Math.max(0, newTotal),
        itemRemoved: willRemoveItem,
        productName,
        orderCancelled: remainingItems === 0,
      };
    });

    revalidatePath("/admin/orders");
    revalidatePath("/admin/inventory");
    revalidatePath("/admin");
    revalidatePath("/vendor/history");

    return {
      success: true,
      newTotal: result.newTotal,
      itemRemoved: result.itemRemoved,
      productName: result.productName,
    };
  } catch (error) {
    console.error("Failed to mark item unavailable:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update order",
    };
  }
}

// ============================================================================
// Auto-Cancel Expired Orders
// ============================================================================

/**
 * Auto-cancel orders that have been pending for more than the specified hours
 * Called during getIncomingOrders or via scheduled task
 * 
 * @param hoursThreshold - Hours after which orders should be auto-cancelled (default: 48)
 * @returns Number of orders cancelled
 */
export async function autoCancelExpiredOrders(hoursThreshold: number = 48): Promise<{
  success: boolean;
  cancelledCount: number;
  cancelledOrderIds: number[];
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursThreshold);

    // Find orders older than threshold that are still active
    const expiredOrders = await prisma.order.findMany({
      where: {
        order_date: { lt: cutoffDate },
        status: { in: ["PENDING", "PREPARING", "READY"] },
      },
      include: {
        items: {
          select: { product_id: true, quantity: true },
        },
        customer: {
          select: { name: true },
        },
      },
    });

    if (expiredOrders.length === 0) {
      return { success: true, cancelledCount: 0, cancelledOrderIds: [] };
    }

    const cancelledOrderIds: number[] = [];

    // Cancel each expired order and release allocated stock
    await prisma.$transaction(async (tx) => {
      for (const order of expiredOrders) {
        // Update order status
        await tx.order.update({
          where: { order_id: order.order_id },
          data: { status: "CANCELLED" },
        });

        // Release allocated stock
        for (const item of order.items) {
          await tx.inventory.update({
            where: { product_id: item.product_id },
            data: { allocated_stock: { decrement: item.quantity } },
          });
        }

        cancelledOrderIds.push(order.order_id);
      }
    });

    // Log auto-cancellations
    for (const order of expiredOrders) {
      await logOrderCancel(
        "System",
        order.order_id,
        Number(order.total_amount),
        order.customer?.name,
        `Auto-cancelled: Order exceeded ${hoursThreshold} hour threshold`
      );
    }

    // Revalidate paths
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    revalidatePath("/vendor/history");
    revalidatePath("/vendor");

    return {
      success: true,
      cancelledCount: cancelledOrderIds.length,
      cancelledOrderIds,
    };
  } catch (error) {
    console.error("Failed to auto-cancel expired orders:", error);
    return { success: false, cancelledCount: 0, cancelledOrderIds: [] };
  }
}

