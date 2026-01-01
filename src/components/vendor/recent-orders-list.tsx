"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconReceipt,
  IconChevronRight,
  IconClock,
  IconCheck,
  IconLoader2,
  IconX,
  IconHistory,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RecentOrderSummary } from "@/actions/vendor";

interface RecentOrdersListProps {
  orders: RecentOrderSummary[];
  onViewOrder?: (orderId: number) => void;
}

const statusConfig: Record<string, {
  label: string;
  icon: typeof IconClock;
  color: string;
  dotColor: string;
  animate?: boolean;
}> = {
  PENDING: {
    label: "Pending",
    icon: IconClock,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    dotColor: "bg-amber-500",
  },
  PREPARING: {
    label: "Preparing",
    icon: IconLoader2,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    dotColor: "bg-blue-500",
    animate: true,
  },
  READY: {
    label: "Ready",
    icon: IconCheck,
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
  },
  COMPLETED: {
    label: "Completed",
    icon: IconCheck,
    color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    dotColor: "bg-zinc-500",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: IconX,
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    dotColor: "bg-red-500",
  },
};

export function RecentOrdersList({ orders, onViewOrder }: RecentOrdersListProps) {
  const router = useRouter();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const orderDate = new Date(date);
    const diffMs = now.getTime() - orderDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return orderDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return orderDate.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return orderDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const handleViewOrder = (orderId: number) => {
    if (onViewOrder) {
      onViewOrder(orderId);
    }
    router.push(`/vendor/history?order=${orderId}`);
  };

  // Empty state
  if (orders.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="text-center py-8">
          <div className="size-12 mx-auto mb-3 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <IconHistory className="size-6 text-zinc-400" />
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">
            No recent orders. Place your first order today!
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/vendor/order")}
            className="gap-2"
          >
            Start Shopping
            <IconChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h2 className="font-semibold text-[#2d1b1a] dark:text-white">
            Recent Orders
          </h2>
          <p className="text-xs text-zinc-500">Last 5 transactions</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/vendor/history")}
          className="text-[#AC0F16] hover:text-[#8a0c12] gap-1"
        >
          View All
          <IconChevronRight className="size-4" />
        </Button>
      </div>

      {/* Order List */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {orders.map((order) => {
          const config = statusConfig[order.status] || statusConfig.PENDING;
          const StatusIcon = config.icon;

          return (
            <button
              key={order.order_id}
              onClick={() => handleViewOrder(order.order_id)}
              className="w-full flex items-center gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left group"
            >
              {/* Order Icon */}
              <div className="size-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <IconReceipt className="size-5 text-[#2d1b1a] dark:text-white" />
              </div>

              {/* Order Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[#2d1b1a] dark:text-white">
                    Order #{order.order_id}
                  </span>
                  <Badge className={cn("text-[10px] px-1.5 py-0.5", config.color)}>
                    <StatusIcon className={cn("size-3 mr-1", config.animate && "animate-spin")} />
                    {config.label}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">
                  {order.items_count} item{order.items_count !== 1 ? "s" : ""} • {formatDate(order.order_date)}
                </p>
              </div>

              {/* Amount & Chevron */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold text-sm text-[#2d1b1a] dark:text-white">
                  {formatCurrency(order.total_amount)}
                </span>
                <IconChevronRight className="size-4 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Stats Footer */}
      <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">
            Total from recent orders
          </span>
          <span className="font-semibold text-[#2d1b1a] dark:text-white">
            {formatCurrency(orders.reduce((sum, o) => sum + o.total_amount, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}
