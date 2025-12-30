"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  href: string | null;
  created_at: Date;
}

/**
 * Check for new notifications for a user
 * Also auto-generates notifications for new orders (admin) or ready orders (vendor)
 */
export async function checkNotifications(
  userId: number,
  userType: "staff" | "vendor"
): Promise<{ notifications: NotificationData[]; newCount: number }> {
  try {
    // Auto-generate notifications based on user type
    if (userType === "staff") {
      await generateAdminNotifications(userId);
    } else if (userType === "vendor") {
      await generateVendorNotifications(userId);
    }

    // Fetch all unread notifications for this user
    const notifications = await prisma.notification.findMany({
      where: {
        user_id: userId,
        user_type: userType,
      },
      orderBy: {
        created_at: "desc",
      },
      take: 50, // Limit to last 50
    });

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        is_read: n.is_read,
        href: n.href,
        created_at: n.created_at,
      })),
      newCount: unreadCount,
    };
  } catch (error) {
    console.error("Check notifications error:", error);
    return { notifications: [], newCount: 0 };
  }
}

/**
 * Generate notifications for admin users (new pending orders)
 */
async function generateAdminNotifications(userId: number) {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

  // Find new pending orders created in the last minute
  const newOrders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      order_date: { gte: oneMinuteAgo },
    },
    include: {
      customer: {
        select: { name: true },
      },
    },
  });

  for (const order of newOrders) {
    // Check if notification already exists for this order
    const existingNotification = await prisma.notification.findFirst({
      where: {
        user_id: userId,
        user_type: "staff",
        message: { contains: `Order #${order.order_id}` },
        created_at: { gte: oneMinuteAgo },
      },
    });

    if (!existingNotification) {
      await prisma.notification.create({
        data: {
          user_id: userId,
          user_type: "staff",
          title: "New Order Received!",
          message: `Order #${order.order_id} from ${order.customer.name} is waiting to be processed.`,
          type: "info",
          href: "/admin/orders",
        },
      });
    }
  }
}

/**
 * Generate notifications for vendor users (orders ready for pickup)
 */
async function generateVendorNotifications(customerId: number) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  // Find orders that were recently marked as READY for this customer
  const readyOrders = await prisma.order.findMany({
    where: {
      customer_id: customerId,
      status: "READY",
    },
  });

  for (const order of readyOrders) {
    // Check if notification already exists for this order being ready
    const existingNotification = await prisma.notification.findFirst({
      where: {
        user_id: customerId,
        user_type: "vendor",
        title: "Order Ready for Pickup!",
        message: { contains: `Order #${order.order_id}` },
      },
    });

    if (!existingNotification) {
      await prisma.notification.create({
        data: {
          user_id: customerId,
          user_type: "vendor",
          title: "Order Ready for Pickup!",
          message: `Your order #${order.order_id} is ready for pickup. Please visit the store to collect it.`,
          type: "success",
          href: "/vendor/history",
        },
      });
    }
  }

  // Also notify for completed orders
  const completedOrders = await prisma.order.findMany({
    where: {
      customer_id: customerId,
      status: "COMPLETED",
    },
  });

  for (const order of completedOrders) {
    // Check if completion notification exists
    const existingNotification = await prisma.notification.findFirst({
      where: {
        user_id: customerId,
        user_type: "vendor",
        title: "Order Completed!",
        message: { contains: `Order #${order.order_id}` },
      },
    });

    if (!existingNotification) {
      await prisma.notification.create({
        data: {
          user_id: customerId,
          user_type: "vendor",
          title: "Order Completed!",
          message: `Your order #${order.order_id} has been completed. Thank you for your business!`,
          type: "success",
          href: "/vendor/history",
        },
      });
    }
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<{ success: boolean }> {
  try {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { is_read: true },
    });
    return { success: true };
  } catch (error) {
    console.error("Mark notification read error:", error);
    return { success: false };
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(
  userId: number,
  userType: "staff" | "vendor"
): Promise<{ success: boolean }> {
  try {
    await prisma.notification.updateMany({
      where: {
        user_id: userId,
        user_type: userType,
        is_read: false,
      },
      data: { is_read: true },
    });
    return { success: true };
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    return { success: false };
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<{ success: boolean }> {
  try {
    await prisma.notification.delete({
      where: { id: notificationId },
    });
    return { success: true };
  } catch (error) {
    console.error("Delete notification error:", error);
    return { success: false };
  }
}

/**
 * Clear all notifications for a user
 */
export async function clearAllNotifications(
  userId: number,
  userType: "staff" | "vendor"
): Promise<{ success: boolean }> {
  try {
    await prisma.notification.deleteMany({
      where: {
        user_id: userId,
        user_type: userType,
      },
    });
    return { success: true };
  } catch (error) {
    console.error("Clear all notifications error:", error);
    return { success: false };
  }
}

/**
 * Create a custom notification (for direct calls from other actions)
 */
export async function createNotification(data: {
  userId: number;
  userType: "staff" | "vendor";
  title: string;
  message: string;
  type?: string;
  href?: string;
}): Promise<{ success: boolean; id?: string }> {
  try {
    const notification = await prisma.notification.create({
      data: {
        user_id: data.userId,
        user_type: data.userType,
        title: data.title,
        message: data.message,
        type: data.type || "info",
        href: data.href || null,
      },
    });
    return { success: true, id: notification.id };
  } catch (error) {
    console.error("Create notification error:", error);
    return { success: false };
  }
}













