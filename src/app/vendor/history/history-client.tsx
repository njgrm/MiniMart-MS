"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const AUTO_REFRESH_INTERVAL = 2000; // 2 seconds
import {
  IconHistory,
  IconPackage,
  IconClock,
  IconCheck,
  IconX,
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { VendorOrder } from "@/actions/vendor";
import { cancelVendorOrder } from "@/actions/vendor";
import { cn } from "@/lib/utils";

interface VendorHistoryClientProps {
  orders: VendorOrder[];
  customerId: number;
}

/**
 * VendorHistoryClient - Order history with expandable details
 */
export function VendorHistoryClient({
  orders,
  customerId,
}: VendorHistoryClientProps) {
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-refresh every 2 seconds (silent)
  const silentRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    autoRefreshRef.current = setInterval(silentRefresh, AUTO_REFRESH_INTERVAL);
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [silentRefresh]);

  // Manual refresh with toast feedback
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    router.refresh();
    // Small delay to show the spinner
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsRefreshing(false);
    toast.success("Orders refreshed");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <IconClock className="size-4" />;
      case "PREPARING":
        return <IconPackage className="size-4" />;
      case "READY":
        return <IconCheck className="size-4" />;
      case "COMPLETED":
        return <IconCheck className="size-4" />;
      case "CANCELLED":
        return <IconX className="size-4" />;
      default:
        return <IconClock className="size-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "PREPARING":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "READY":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "CANCELLED":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const toggleExpanded = (orderId: number) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleCancelOrder = (orderId: number) => {
    startTransition(async () => {
      const result = await cancelVendorOrder(orderId, customerId);
      if (result.success) {
        toast.success("Order cancelled successfully");
      } else {
        toast.error(result.error || "Failed to cancel order");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <IconHistory className="size-6" />
            Order History
          </h1>
          <p className="text-muted-foreground">
            View and manage your past orders
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <IconRefresh className={cn("size-4", isRefreshing && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Orders</CardTitle>
          <CardDescription>
            {orders.length} total order{orders.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-280px)]">
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <IconPackage className="size-12 mb-4 opacity-50" />
                <p>No orders yet</p>
                <p className="text-sm">Your orders will appear here</p>
              </div>
            ) : (
              <div className="divide-y">
                {orders.map((order) => {
                  const isExpanded = expandedOrders.has(order.order_id);
                  const canCancel = order.status === "PENDING";

                  return (
                    <Collapsible
                      key={order.order_id}
                      open={isExpanded}
                      onOpenChange={() => toggleExpanded(order.order_id)}
                    >
                      <div className="p-4">
                        {/* Order Summary */}
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -m-2 p-2 rounded-lg transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <IconPackage className="size-6 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold">Order #{order.order_id}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatDate(order.order_date)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-mono font-bold text-lg">
                                  {formatCurrency(order.total_amount)}
                                </p>
                                <Badge className={`gap-1 ${getStatusColor(order.status)}`}>
                                  {getStatusIcon(order.status)}
                                  {order.status}
                                </Badge>
                              </div>
                              {isExpanded ? (
                                <IconChevronUp className="size-5 text-muted-foreground" />
                              ) : (
                                <IconChevronDown className="size-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        {/* Order Details */}
                        <CollapsibleContent>
                          <div className="mt-4 pt-4 border-t">
                            {/* Items */}
                            <div className="space-y-2 mb-4">
                              <p className="text-sm font-medium text-muted-foreground">Items</p>
                              <div className="bg-muted/50 rounded-lg divide-y">
                                {order.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-3"
                                  >
                                    <div>
                                      <p className="font-medium">{item.product_name}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {item.quantity} × {formatCurrency(item.price)}
                                      </p>
                                    </div>
                                    <p className="font-mono font-medium">
                                      {formatCurrency(item.price * item.quantity)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Actions */}
                            {canCancel && (
                              <div className="flex justify-end">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      disabled={isPending}
                                    >
                                      <IconX className="size-4 mr-2" />
                                      Cancel Order
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to cancel Order #{order.order_id}? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Keep Order</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleCancelOrder(order.order_id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Cancel Order
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}



