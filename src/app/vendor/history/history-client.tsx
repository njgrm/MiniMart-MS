"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const AUTO_REFRESH_INTERVAL = 2000; // 2 seconds
const CANCEL_WINDOW_MINUTES = 10; // Minutes after order placement when cancellation is allowed

import {
  IconHistory,
  IconPackage,
  IconClock,
  IconCheck,
  IconX,
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
  IconInfoCircle,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { VendorOrder } from "@/actions/vendor";
import { cancelVendorOrder } from "@/actions/vendor";
import { cn } from "@/lib/utils";

interface VendorHistoryClientProps {
  orders: VendorOrder[];
  customerId: number;
  highlightOrderId?: number;
}

/**
 * VendorHistoryClient - Order history with expandable details
 * Supports deep-linking via highlightOrderId prop
 */
export function VendorHistoryClient({
  orders,
  customerId,
  highlightOrderId,
}: VendorHistoryClientProps) {
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(() => {
    // Auto-expand the highlighted order on initial render
    if (highlightOrderId) {
      return new Set([highlightOrderId]);
    }
    return new Set();
  });
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);
  const highlightedRef = useRef<HTMLDivElement>(null);

  // Scroll to highlighted order on mount
  useEffect(() => {
    if (highlightOrderId && highlightedRef.current) {
      setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [highlightOrderId]);

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
          <h1 className="text-2xl font-bold text-[#2d1b1a] dark:text-white flex items-center gap-2">
            <IconHistory className="size-6" />
            Order History
          </h1>
          <p className="text-stone-500 dark:text-zinc-400">
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
      <Card className="bg-[#F8F6F1] dark:bg-zinc-900 border-stone-200 dark:border-zinc-700">
        <CardHeader>
          <CardTitle className="text-[#2d1b1a] dark:text-white">Your Orders</CardTitle>
          <CardDescription className="text-stone-500 dark:text-zinc-400">
            {orders.length} total order{orders.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-280px)]">
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-stone-500 dark:text-zinc-400">
                <IconPackage className="size-12 mb-4 opacity-50" />
                <p>No orders yet</p>
                <p className="text-sm">Your orders will appear here</p>
              </div>
            ) : (
              <AnimatePresence>
                {orders.map((order, index) => {
                  const isExpanded = expandedOrders.has(order.order_id);
                  const isHighlighted = order.order_id === highlightOrderId;
                  
                  // Cancellation policy: Only PENDING + within 10 minutes of order
                  const orderAge = Date.now() - new Date(order.order_date).getTime();
                  const minutesSinceOrder = orderAge / (1000 * 60);
                  const msRemaining = Math.max(0, (CANCEL_WINDOW_MINUTES * 60 * 1000) - orderAge);
                  const isWithinCancelWindow = minutesSinceOrder <= CANCEL_WINDOW_MINUTES;
                  const canCancel = order.status === "PENDING" && isWithinCancelWindow;
                  
                  // Format remaining time
                  const formatTimeRemaining = () => {
                    const totalSecs = Math.ceil(msRemaining / 1000);
                    const mins = Math.floor(totalSecs / 60);
                    const secs = totalSecs % 60;
                    return `${mins}:${secs.toString().padStart(2, "0")}`;
                  };
                  
                  // Determine why cancellation is not allowed
                  let cancelDisabledReason = "";
                  if (order.status !== "PENDING" && order.status !== "COMPLETED" && order.status !== "CANCELLED") {
                    cancelDisabledReason = "Orders cannot be cancelled once preparation begins.";
                  } else if (order.status === "PENDING" && !isWithinCancelWindow) {
                    cancelDisabledReason = `Cancellation window expired. Orders can only be cancelled within ${CANCEL_WINDOW_MINUTES} minutes.`;
                  }

                  return (
                    <motion.div
                      key={order.order_id}
                      ref={isHighlighted ? highlightedRef : undefined}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className={cn(
                        "border-b last:border-b-0",
                        isHighlighted && "bg-primary/5 ring-2 ring-primary/20 ring-inset"
                      )}
                    >
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() => toggleExpanded(order.order_id)}
                    >
                      <div className="p-4">
                        {/* Order Summary */}
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between cursor-pointer hover:bg-stone-100 dark:hover:bg-zinc-800 -m-2 p-2 rounded-lg transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="size-12 rounded-lg bg-[#AC0F16]/10 flex items-center justify-center">
                                <IconPackage className="size-6 text-[#AC0F16]" />
                              </div>
                              <div>
                                <p className="font-semibold text-[#2d1b1a] dark:text-white">Order #{order.order_id}</p>
                                <p className="text-sm text-stone-500 dark:text-zinc-400">
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
                                <IconChevronUp className="size-5 text-stone-500 dark:text-zinc-400" />
                              ) : (
                                <IconChevronDown className="size-5 text-stone-500 dark:text-zinc-400" />
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        {/* Order Details */}
                        <CollapsibleContent>
                          <div className="mt-4 pt-4 border-t">
                            {/* Items */}
                            <div className="space-y-2 mb-4">
                              <p className="text-sm font-medium text-stone-500 dark:text-zinc-400">Items</p>
                              <div className="bg-stone-100/50 dark:bg-zinc-800/50 rounded-lg divide-y divide-stone-200 dark:divide-zinc-700">
                                {order.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-3"
                                  >
                                    <div>
                                      <p className="font-medium text-[#2d1b1a] dark:text-white">{item.product_name}</p>
                                      <p className="text-sm text-stone-500 dark:text-zinc-400">
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
                            <div className="flex items-center justify-between">
                              {/* Status info for PREPARING+ orders */}
                              {cancelDisabledReason && order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-zinc-400">
                                        <IconInfoCircle className="size-4" />
                                        <span>Why can&apos;t I cancel?</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="max-w-[200px]">{cancelDisabledReason}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              
                              {canCancel && (
                                <div className="flex justify-end flex-1">
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={isPending}
                                        className="gap-2"
                                      >
                                        <IconX className="size-4" />
                                        Cancel
                                        <span className="font-mono text-xs opacity-80">
                                          ({formatTimeRemaining()})
                                        </span>
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to cancel Order #{order.order_id}? This action cannot be undone and items will be restocked.
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
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}



