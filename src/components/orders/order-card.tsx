"use client";

import { formatDistanceToNow } from "date-fns";
import {
  IconClock,
  IconUser,
  IconPackage,
  IconReceipt,
} from "@tabler/icons-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { IncomingOrder, OrderStatus } from "@/actions/orders";
import { cn } from "@/lib/utils";

interface OrderCardProps {
  order: IncomingOrder;
  onClick: () => void;
}

const statusConfig: Record<
  OrderStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className: string }
> = {
  PENDING: {
    label: "Pending",
    variant: "secondary",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  },
  PREPARING: {
    label: "Preparing",
    variant: "default",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  READY: {
    label: "Ready",
    variant: "default",
    className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  },
  COMPLETED: {
    label: "Completed",
    variant: "outline",
    className: "bg-muted text-muted-foreground",
  },
  CANCELLED: {
    label: "Cancelled",
    variant: "destructive",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

export function OrderCard({ order, onClick }: OrderCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const timeElapsed = formatDistanceToNow(new Date(order.order_date), { addSuffix: true });
  const status = statusConfig[order.status];

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01] bg-card",
        "active:scale-[0.99] border-border py-5 pb-1",
        order.status === "PENDING" && "hover:border-orange-300 dark:hover:border-orange-700",
        order.status === "PREPARING" && "hover:border-blue-300 dark:hover:border-blue-700",
        order.status === "READY" && "border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20 hover:ring-emerald-500/40"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={cn(
              "size-10 rounded-xl flex items-center justify-center",
              order.status === "PENDING" && "bg-orange-100 dark:bg-orange-900/30",
              order.status === "PREPARING" && "bg-blue-100 dark:bg-blue-900/30",
              order.status === "READY" && "bg-emerald-100 dark:bg-emerald-900/30"
            )}>
              <IconReceipt className={cn(
                "size-5",
                order.status === "PENDING" && "text-orange-600 dark:text-orange-400",
                order.status === "PREPARING" && "text-blue-600 dark:text-blue-400",
                order.status === "READY" && "text-emerald-600 dark:text-emerald-400"
              )} />
            </div>
            <div>
              <p className="font-bold text-foreground">Order #{order.order_id}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <IconClock className="size-3" />
                {timeElapsed}
              </p>
            </div>
          </div>
          <Badge className={cn("text-xs px-2 py-0.5", status.className)}>
            {status.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 top-1/2 -translate-y-1/9">
        {/* Customer Info */}
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-muted flex items-center justify-center">
            <IconUser className="size-4 text-muted-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground">{order.customer.name}</span>
        </div>

        {/* Items Summary */}
        <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2">
          <IconPackage className="size-4 text-muted-foreground" />
          <span className="font-medium text-foreground">
            {totalItems} item{totalItems !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground truncate flex-1">
            {order.items.slice(0, 2).map((item) => item.product.product_name.substring(0, 12)).join(", ")}
            {order.items.length > 2 && ` +${order.items.length - 2}`}
          </span>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-bold text-[#AC0F16]">
            {formatCurrency(order.total_amount)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

















