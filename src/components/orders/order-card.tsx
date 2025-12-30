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
    className: "bg-secondary text-secondary hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  },
  PREPARING: {
    label: "Preparing",
    variant: "default",
    className: "bg-accent text-accent hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  READY: {
    label: "Ready",
    variant: "default",
    className: "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  },
  COMPLETED: {
    label: "Completed",
    variant: "outline",
    className: "bg-muted text-muted-foreground",
  },
  CANCELLED: {
    label: "Cancelled",
    variant: "destructive",
    className: "",
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
        "cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02]",
        "active:scale-[0.98]",
        order.status === "PENDING" && "border-orange-200 dark:border-orange-800/50",
        order.status === "PREPARING" && "border-blue-200 dark:border-blue-800/50",
        order.status === "READY" && "border-green-200 dark:border-green-800/50 ring-2 ring-green-500/20"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
              <IconReceipt className="size-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Order #{order.order_id}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <IconClock className="size-3" />
                {timeElapsed}
              </p>
            </div>
          </div>
          <Badge variant={status.variant} className={status.className}>
            {status.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Customer Info */}
        <div className="flex items-center gap-2 text-sm">
          <IconUser className="size-4 text-muted-foreground" />
          <span className="font-medium">{order.customer.name}</span>
        </div>

        {/* Items Summary */}
        <div className="flex items-center gap-2 text-sm">
          <IconPackage className="size-4 text-muted-foreground" />
          <span>
            {totalItems} item{totalItems !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {order.items.slice(0, 2).map((item) => item.product.product_name.substring(0, 15)).join(", ")}
            {order.items.length > 2 && `, +${order.items.length - 2} more`}
          </span>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-bold font-mono text-primary">
            {formatCurrency(order.total_amount)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}













