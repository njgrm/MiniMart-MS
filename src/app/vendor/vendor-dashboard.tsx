"use client";

import { useRouter } from "next/navigation";
import {
  IconShoppingCart,
  IconArrowRight,
  IconReceipt,
  IconCash,
  IconPackage,
  IconClock,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { LiveOrderStatus } from "@/components/vendor/live-order-status";
import { QuickReorderRow } from "@/components/vendor/quick-reorder-row";
import { RecentOrdersList } from "@/components/vendor/recent-orders-list";
import type {
  ActiveOrderStatus,
  QuickReorderItem,
  RecentOrderSummary,
  VendorStats,
} from "@/actions/vendor";

interface VendorDashboardProps {
  userName: string;
  customerId: number;
  activeOrders: ActiveOrderStatus[];
  quickReorderItems: QuickReorderItem[];
  recentOrders: RecentOrderSummary[];
  stats: VendorStats;
}

/**
 * VendorDashboard - Mobile-first dashboard with live order tracking, quick reorder, and recent orders
 * Design follows the mobile food ordering app aesthetic with white backgrounds and clean UI
 */
export function VendorDashboard({
  userName,
  customerId,
  activeOrders,
  quickReorderItems,
  recentOrders,
  stats,
}: VendorDashboardProps) {
  const router = useRouter();

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2d1b1a] dark:text-white">
            {getGreeting()}, {userName}!
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Your wholesale ordering dashboard
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => router.push("/vendor/order")}
          className="gap-2 bg-[#AC0F16] hover:bg-[#8a0c12] text-white shadow-lg w-full sm:w-auto"
        >
          <IconShoppingCart className="size-5" />
          Start New Order
          <IconArrowRight className="size-5" />
        </Button>
      </div>

 

      {/* Live Order Status - Hero Section with Horizontal Scroll */}
      <LiveOrderStatus 
        initialOrders={activeOrders} 
        customerId={customerId} 
      />

      {/* Quick Re-order Section */}
      <QuickReorderRow items={quickReorderItems} />

      {/* Recent Orders */}
      <RecentOrdersList orders={recentOrders} />

           {/* Quick Stats - Compact Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Spent */}
        <div className="bg-[#F8F6F1] shadow-sm dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-700 p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-7 rounded-lg bg-[#2EAFC5]/20 flex items-center justify-center">
              <IconCash className="size-4 text-[#2EAFC5]" />
            </div>
          </div>
          <p className="text-lg font-bold tabular-nums text-[#2d1b1a] dark:text-white">
            {formatCurrency(stats.totalSpent)}
          </p>
          <p className="text-[10px] text-stone-500 dark:text-zinc-400">Total Spent</p>
        </div>

        {/* Orders */}
        <div className="bg-[#F8F6F1] shadow-sm dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-700 p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-7 rounded-lg bg-[#AC0F16]/20 flex items-center justify-center">
              <IconReceipt className="size-4 text-[#AC0F16]" />
            </div>
          </div>
          <p className="text-lg font-bold tabular-nums text-[#2d1b1a] dark:text-white">
            {stats.totalOrders}
          </p>
          <p className="text-[10px] text-stone-500 dark:text-zinc-400">Total Orders</p>
        </div>

        {/* Items */}
        <div className="bg-[#F8F6F1] shadow-sm dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-700 p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-7 rounded-lg bg-[#F1782F]/20 flex items-center justify-center">
              <IconPackage className="size-4 text-[#F1782F]" />
            </div>
          </div>
          <p className="text-lg font-bold tabular-nums text-[#2d1b1a] dark:text-white">
            {stats.totalItems}
          </p>
          <p className="text-[10px] text-stone-500 dark:text-zinc-400">Items Ordered</p>
        </div>

        {/* Active/Pending */}
        <div 
          className="bg-[#F8F6F1] shadow-sm dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-700 p-3 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/vendor/history")}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="size-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <IconClock className="size-4 text-amber-500" />
            </div>
            {stats.pendingOrders > 0 && (
              <span className="relative flex size-2">
                <span className="animate-ping absolute h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                <span className="relative rounded-full size-2 bg-amber-500"></span>
              </span>
            )}
          </div>
          <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {stats.pendingOrders}
          </p>
          <p className="text-[10px] text-stone-500 dark:text-zinc-400">Active Orders</p>
        </div>
      </div>

      {/* Quick Actions Footer */}
      <div className="bg-[#F8F6F1] shadow-sm dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-700 p-4">
        <h3 className="font-medium text-sm text-[#2d1b1a] dark:text-white mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2 hover:bg-stone-100 dark:hover:bg-zinc-800 border-stone-200 dark:border-zinc-700"
            onClick={() => router.push("/vendor/order")}
          >
            <IconShoppingCart className="size-6 text-[#AC0F16]" />
            <span className="text-sm font-medium text-[#2d1b1a] dark:text-white">
              Browse Products
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2 hover:bg-stone-100 dark:hover:bg-zinc-800 border-stone-200 dark:border-zinc-700"
            onClick={() => router.push("/vendor/history")}
          >
            <IconReceipt className="size-6 text-[#2EAFC5]" />
            <span className="text-sm font-medium text-[#2d1b1a] dark:text-white">
              Order History
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}



