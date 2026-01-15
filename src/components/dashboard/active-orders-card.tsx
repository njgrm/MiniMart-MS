"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { differenceInMinutes, formatDistanceToNow, format } from "date-fns";
import {
  IconPackage,
  IconEye,
  IconAlertTriangle,
  IconRefresh,
  IconArrowRight,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getIncomingOrders } from "@/actions/orders";
import type { GroupedOrders, IncomingOrder } from "@/actions/orders";

// Auto-refresh interval (5 seconds)
const AUTO_REFRESH_INTERVAL = 5000;

/**
 * Format minutes into human-readable duration
 * Examples: 45m, 1h 30m, 2d 4h
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

interface ActiveOrdersCardProps {
  incomingOrders: GroupedOrders;
  className?: string;
}

const statusConfig = {
  PENDING: {
    label: "Pending",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700",
  },
  PREPARING: {
    label: "Preparing",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-700",
  },
  READY: {
    label: "Ready",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700",
  },
};

const LATE_THRESHOLD_MINUTES = 15;

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
};

function OrderRow({ order, onView }: { 
  order: IncomingOrder; 
  onView: () => void; 
}) {
  const orderDate = new Date(order.order_date);
  const minutesElapsed = differenceInMinutes(new Date(), orderDate);
  const isLate = minutesElapsed >= LATE_THRESHOLD_MINUTES;
  
  // Get status config for explicit badge
  const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.PENDING;

  return (
    <div
      className={cn(
        "px-3 py-2 hover:bg-muted/30 transition-colors border-b border-border/50 last:border-b-0 cursor-pointer",
        isLate && "bg-red-50/80 dark:bg-red-950/20"
      )}
      onClick={onView}
    >
      {/* Ticket Layout: Order ID | Items | Status Badge | Timer | Action */}
      <div className="flex items-center gap-2">
        {/* Left: Order ID - Large & Bold */}
        <div className="font-mono text-base font-bold text-[#AC0F16] shrink-0 w-12">
          #{String(order.order_id).padStart(3, '0')}
        </div>
        
        {/* Middle: Item List - Clean with Bold Quantities */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {order.items.slice(0, 3).map((item, idx) => (
              <span key={idx} className="text-xs">
                <span className="font-bold text-[#AC0F16]">{item.quantity}×</span>
                <span className="text-foreground ml-0.5">{item.product.product_name}</span>
              </span>
            ))}
            {order.items.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{order.items.length - 3} more</span>
            )}
          </div>
        </div>
        
        {/* Status Badge - Explicit accessibility */}
        <Badge 
          variant="outline" 
          className={cn("text-[9px] px-1.5 py-0 h-4 shrink-0 border", statusInfo.className)}
        >
          {statusInfo.label}
        </Badge>
        
        {/* Timer with detailed Tooltip - Now uses formatted duration */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex items-center gap-1 text-xs shrink-0 min-w-[50px] justify-end",
                isLate ? "text-destructive font-bold" : "text-muted-foreground"
              )}>
                {isLate && <IconAlertTriangle className="size-3" />}
                <span>{formatDuration(minutesElapsed)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              <p className="font-medium">Order placed at {format(orderDate, "h:mm a")}</p>
              <p className="text-muted-foreground">({formatDistanceToNow(orderDate, { addSuffix: true })})</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Far Right: View Button */}
        <Button
          variant="secondary"
          size="sm"
          className="h-7 w-7 p-0 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
        >
          <IconEye className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function ActiveOrdersCard({ incomingOrders: initialOrders, className }: ActiveOrdersCardProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<GroupedOrders>(initialOrders);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Auto-refresh to catch incoming orders
  const refreshOrders = useCallback(async () => {
    try {
      const freshOrders = await getIncomingOrders();
      setOrders(freshOrders);
    } catch (error) {
      console.error("[ActiveOrdersCard] Refresh failed:", error);
    }
  }, []);
  
  // Set up auto-refresh interval
  useEffect(() => {
    const interval = setInterval(refreshOrders, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshOrders]);
  
  // Also update when props change (from parent refresh)
  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);
  
  // Combine all active orders and sort by date (oldest first - FIFO)
  const allOrders = [
    ...orders.pending,
    ...orders.preparing,
    ...orders.ready,
  ].sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime());

  const totalCount = allOrders.length;
  const lateCount = allOrders.filter(
    (o) => differenceInMinutes(new Date(), new Date(o.order_date)) >= LATE_THRESHOLD_MINUTES
  ).length;

  // Navigate to orders page with orderId to auto-open the drawer
  const handleView = (orderId: number) => {
    router.push(`/admin/orders?orderId=${orderId}`);
  };
  
  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshOrders();
    setIsRefreshing(false);
  };

  return (
    <div className={cn("bg-card rounded-xl border flex flex-col overflow-hidden max-h-[400px]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <IconPackage className="size-4 text-[#AC0F16]" />
            {totalCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 size-4 flex items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                {totalCount > 9 ? "9+" : totalCount}
              </span>
            )}
          </div>
          <h3 className="font-medium text-sm">Active Orders</h3>
          {lateCount > 0 && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
              {lateCount} late
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
          >
            <IconRefresh className={cn("size-3.5", isRefreshing && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2 gap-1"
            onClick={() => router.push("/admin/orders")}
          >
            View All
            <IconArrowRight className="size-3" />
          </Button>
        </div>
      </div>
      
      {/* Orders List - Ticket style layout */}
      <ScrollArea className="flex-1 min-h-0">
        {allOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <IconPackage className="size-8 mb-2 opacity-30" />
            <p className="text-xs">No active orders</p>
            <p className="text-[10px] text-muted-foreground/70">Orders will appear here</p>
          </div>
        ) : (
          <div>
            {allOrders.map((order) => (
              <OrderRow
                key={order.order_id}
                order={order}
                onView={() => handleView(order.order_id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
      
      {/* Footer Summary */}
      <div className="flex flex-col gap-1.5 px-3 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground shrink-0">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-amber-500" />
            {orders.pending.length} pending
          </span>
          <span className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-blue-500" />
            {orders.preparing.length} preparing
          </span>
          <span className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-emerald-500" />
            {orders.ready.length} ready
          </span>
        </div>
      </div>
    </div>
  );
}
