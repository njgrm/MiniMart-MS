"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { differenceInMinutes, formatDistanceToNow } from "date-fns";
import {
  IconPackage,
  IconEye,
  IconPrinter,
  IconClock,
  IconAlertTriangle,
  IconUser,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { GroupedOrders, IncomingOrder } from "@/actions/orders";

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

const LATE_THRESHOLD_MINUTES = 20;

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
};

function OrderRow({ order, onView, onPrint }: { 
  order: IncomingOrder; 
  onView: () => void; 
  onPrint: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const config = statusConfig[order.status as keyof typeof statusConfig];
  
  const orderDate = new Date(order.order_date);
  const minutesElapsed = differenceInMinutes(new Date(), orderDate);
  const isLate = minutesElapsed >= LATE_THRESHOLD_MINUTES;
  
  // Use formatDistanceToNow for human-readable time
  const timeDisplay = formatDistanceToNow(orderDate, { addSuffix: true });
  
  // Calculate total
  const totalAmount = order.items.reduce(
    (sum, item) => sum + (item.price * item.quantity),
    0
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 px-3 py-2 hover:bg-muted/50 transition-colors group border-b border-border/50 last:border-b-0 cursor-pointer",
        isLate && "bg-red-50/50 dark:bg-red-950/10"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onView}
    >
      {/* Top Row: ID, Customer, Status, Time */}
      <div className="flex items-center gap-2">
        {/* Order ID */}
        <div className="font-mono text-xs font-bold text-[#AC0F16] w-10 shrink-0">
          #{order.order_id}
        </div>
        
        {/* Customer Name + Avatar */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="size-5 rounded-full bg-muted flex items-center justify-center shrink-0">
            <IconUser className="size-3 text-muted-foreground" />
          </div>
          <span className="text-xs font-medium truncate">{order.customer.name}</span>
        </div>
        
        {/* Status Badge */}
        <Badge 
          variant="outline" 
          className={cn("text-[9px] px-1.5 py-0 h-5 shrink-0", config?.className)}
        >
          {config?.label}
        </Badge>
        
        {/* Time Elapsed */}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex items-center gap-0.5 text-[10px] font-medium shrink-0",
                isLate ? "text-destructive" : "text-muted-foreground"
              )}>
                {isLate && <IconAlertTriangle className="size-3" />}
                <IconClock className="size-3" />
                <span className="max-w-[60px] truncate">{timeDisplay}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {orderDate.toLocaleString()}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Actions - Show on Hover */}
        <div className={cn(
          "flex items-center gap-0.5 transition-opacity shrink-0",
          isHovered ? "opacity-100" : "opacity-0"
        )}>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={(e) => { e.stopPropagation(); onView(); }}
          >
            <IconEye className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={(e) => { e.stopPropagation(); onPrint(); }}
          >
            <IconPrinter className="size-3" />
          </Button>
        </div>
      </div>
      
      {/* Bottom Row: Item Pills (Horizontal Scroll) + Total */}
      <div className="flex items-center gap-2">
        {/* Horizontal Scrollable Item Pills */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-x-auto scrollbar-hide flex items-center gap-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {order.items.map((item) => (
            <Badge
              key={item.order_item_id}
              variant="secondary"
              className="text-[9px] px-1.5 py-0.5 h-auto whitespace-nowrap bg-muted/80 text-muted-foreground shrink-0"
            >
              {item.product.product_name.slice(0, 12)}{item.product.product_name.length > 12 ? '…' : ''} x{item.quantity}
            </Badge>
          ))}
        </div>
        
        {/* Total Amount */}
        <div className="font-mono text-xs font-bold text-foreground shrink-0">
          {formatCurrency(totalAmount)}
        </div>
      </div>
    </div>
  );
}

export function ActiveOrdersCard({ incomingOrders, className }: ActiveOrdersCardProps) {
  const router = useRouter();
  
  // Combine all active orders and sort by date (oldest first - FIFO)
  const allOrders = [
    ...incomingOrders.pending,
    ...incomingOrders.preparing,
    ...incomingOrders.ready,
  ].sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime());

  const totalCount = allOrders.length;
  const lateCount = allOrders.filter(
    (o) => differenceInMinutes(new Date(), new Date(o.order_date)) >= LATE_THRESHOLD_MINUTES
  ).length;

  const handleView = (orderId: number) => {
    router.push(`/admin/orders?orderId=${orderId}`);
  };

  const handlePrint = (orderId: number) => {
    router.push(`/admin/orders?orderId=${orderId}&print=true`);
  };

  return (
    <div className={cn("bg-card rounded-xl border flex flex-col overflow-hidden", className)}>
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
        <div className="flex items-center gap-2">
          {totalCount > 0 && (
            <span className="relative flex size-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-[#AC0F16] opacity-75"></span>
              <span className="relative rounded-full size-2 bg-[#AC0F16]"></span>
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => router.push("/admin/orders")}
          >
            View All
          </Button>
        </div>
      </div>
      
      {/* Table Header - Rich Layout */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-b text-[10px] font-medium text-muted-foreground uppercase tracking-wide shrink-0">
        <div className="w-10">ID</div>
        <div className="flex-1">ORDER DETAILS</div>
        <div className="w-14 text-right">TOTAL</div>
      </div>
      
      {/* Orders List */}
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
                onPrint={() => handlePrint(order.order_id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
      
      {/* Footer Summary */}
      <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-amber-500" />
            {incomingOrders.pending.length} pending
          </span>
          <span className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-blue-500" />
            {incomingOrders.preparing.length} preparing
          </span>
          <span className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-emerald-500" />
            {incomingOrders.ready.length} ready
          </span>
        </div>
        <span className="font-medium">FIFO Queue</span>
      </div>
    </div>
  );
}
