"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  IconPackage,
  IconClock,
  IconPlayerPlay,
  IconCheck,
  IconArrowRight,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GroupedOrders, IncomingOrder } from "@/actions/orders";

interface ActiveOrdersFeedProps {
  incomingOrders: GroupedOrders;
  className?: string;
}

const statusConfig = {
  PENDING: {
    label: "Pending",
    icon: IconClock,
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    bgClass: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/50",
  },
  PREPARING: {
    label: "Packing",
    icon: IconPlayerPlay,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50",
  },
  READY: {
    label: "Ready",
    icon: IconCheck,
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    bgClass: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/50",
  },
};

function MiniOrderCard({ order }: { order: IncomingOrder }) {
  const router = useRouter();
  const config = statusConfig[order.status as keyof typeof statusConfig];
  const StatusIcon = config?.icon || IconPackage;
  const timeAgo = formatDistanceToNow(new Date(order.order_date), { addSuffix: true });
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  
  // Get first 2-3 item names for preview
  const itemPreview = order.items
    .slice(0, 2)
    .map((item) => `${item.quantity}x ${item.product.product_name}`)
    .join(", ");
  const moreItems = order.items.length > 2 ? ` +${order.items.length - 2} more` : "";

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <button
      onClick={() => router.push(`/admin/orders?orderId=${order.order_id}`)}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm",
        config?.bgClass || "bg-card border-border"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Status Icon */}
        <div className={cn(
          "size-8 rounded-full flex items-center justify-center shrink-0",
          order.status === "PENDING" && "bg-orange-200 dark:bg-orange-800",
          order.status === "PREPARING" && "bg-blue-200 dark:bg-blue-800",
          order.status === "READY" && "bg-green-200 dark:bg-green-800"
        )}>
          <StatusIcon className={cn(
            "size-4",
            order.status === "PENDING" && "text-orange-700 dark:text-orange-300",
            order.status === "PREPARING" && "text-blue-700 dark:text-blue-300",
            order.status === "READY" && "text-green-700 dark:text-green-300"
          )} />
        </div>
        
        {/* Order Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              Order #{order.order_id}
            </span>
            <Badge className={cn("text-[9px] px-1.5 py-0", config?.className)}>
              {config?.label}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {order.customer.name} • {timeAgo}
          </p>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            {itemPreview}{moreItems}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">
              {itemCount} items
            </span>
            <span className="text-xs font-bold text-foreground tabular-nums">
              {formatCurrency(order.total_amount)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function ActiveOrdersFeed({ incomingOrders, className }: ActiveOrdersFeedProps) {
  const router = useRouter();
  
  // Combine all active orders and sort by date (oldest first - FIFO)
  const allOrders = [
    ...incomingOrders.pending,
    ...incomingOrders.preparing,
    ...incomingOrders.ready,
  ].sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime());

  const totalCount = allOrders.length;

  return (
    <div className={cn("bg-card rounded-xl border flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <div className="relative">
            <IconPackage className="size-4 text-[#AC0F16]" />
            {totalCount > 0 && (
              <span className="absolute -top-1 -right-1 size-3 flex items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white">
                {totalCount > 9 ? "9+" : totalCount}
              </span>
            )}
          </div>
          <h3 className="font-medium text-sm">Active Orders</h3>
        </div>
        {totalCount > 0 && (
          <span className="relative flex size-2">
            <span className="animate-ping absolute h-full w-full rounded-full bg-[#AC0F16] opacity-75"></span>
            <span className="relative rounded-full size-2 bg-[#AC0F16]"></span>
          </span>
        )}
      </div>

      {/* Status Summary Bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-orange-500"></span>
          <span className="text-[10px] text-muted-foreground">
            {incomingOrders.pending.length} pending
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-blue-500"></span>
          <span className="text-[10px] text-muted-foreground">
            {incomingOrders.preparing.length} packing
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-green-500"></span>
          <span className="text-[10px] text-muted-foreground">
            {incomingOrders.ready.length} ready
          </span>
        </div>
      </div>

      {/* Orders List */}
      <ScrollArea className="flex-1 min-h-0">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
            <IconPackage className="size-8 mb-2 opacity-30" />
            <p className="text-xs">No active orders</p>
            <p className="text-[10px]">All orders completed!</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {allOrders.map((order) => (
              <MiniOrderCard key={order.order_id} order={order} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer - View All */}
      <div className="p-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/admin/orders")}
        >
          View All Orders
          <IconArrowRight className="size-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
