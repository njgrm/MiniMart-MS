"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconPackage,
  IconChefHat,
  IconCheck,
  IconShoppingCart,
  IconArrowRight,
  IconRefresh,
  IconMapPin,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getActiveOrderStatus, type ActiveOrderStatus, cancelVendorOrder } from "@/actions/vendor";
import { toast } from "sonner";
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

interface LiveOrderStatusProps {
  initialOrders: ActiveOrderStatus[];
  customerId: number;
}

const ORDER_STEPS = [
  { key: "PENDING", label: "Order Received", icon: IconPackage },
  { key: "PREPARING", label: "Being Prepared", icon: IconChefHat },
  { key: "READY", label: "Ready for Pickup", icon: IconCheck },
];

const CANCEL_WINDOW_MINUTES = 10; // 10 minutes cancellation window

export function LiveOrderStatus({ initialOrders, customerId }: LiveOrderStatusProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<ActiveOrderStatus[]>(initialOrders);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Poll for updates every 5 seconds
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const updated = await getActiveOrderStatus(customerId);
        setOrders(updated);
      } catch (err) {
        console.error("Failed to poll order status:", err);
      }
    };

    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [customerId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const updated = await getActiveOrderStatus(customerId);
      setOrders(updated);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  // Empty state - No active orders
  if (orders.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 sm:p-10">
        <div className="text-center max-w-md mx-auto">
          <div className="size-20 mx-auto mb-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <IconShoppingCart className="size-10 text-zinc-400" />
          </div>
          <h2 className="text-2xl font-bold text-[#2d1b1a] dark:text-white mb-3">
            No Active Orders
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-base">
            Start a new wholesale order and track it here in real-time
          </p>
          <Button
            onClick={() => router.push("/vendor/order")}
            className="bg-[#AC0F16] hover:bg-[#8a0c12] text-white gap-2 px-6 py-3 text-base h-auto"
          >
            <IconShoppingCart className="size-5" />
            Start New Order
            <IconArrowRight className="size-5" />
          </Button>
        </div>
      </div>
    );
  }

  // Single order - Premium centered view
  if (orders.length === 1) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-[#2d1b1a] dark:text-white">
              Live Order Status
            </h2>
            <p className="text-sm text-zinc-500">
              Tracking Order #{orders[0].order_id}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-zinc-500"
          >
            <IconRefresh className={cn("size-5", isRefreshing && "animate-spin")} />
          </Button>
        </div>

        {/* Single Order - Full Width */}
        <div className="p-5 sm:p-6">
          <OrderCard
            order={orders[0]}
            formatCurrency={formatCurrency}
            formatTime={formatTime}
            isFullWidth
            customerId={customerId}
            onOrderCancelled={handleRefresh}
          />
        </div>
      </div>
    );
  }

  // Multiple orders - Horizontal Carousel
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-[#2d1b1a] dark:text-white">
            Live Order Status
          </h2>
          <p className="text-sm text-zinc-500">
            {orders.length} active orders • Swipe to view all
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-zinc-500"
        >
          <IconRefresh className={cn("size-5", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Horizontal Scrollable Order Cards */}
      <ScrollArea className="w-full">
        <div className="flex gap-4 p-4 sm:p-5">
          {orders.map((order, index) => (
            <OrderCard
              key={order.order_id}
              order={order}
              formatCurrency={formatCurrency}
              formatTime={formatTime}
              customerId={customerId}
              onOrderCancelled={handleRefresh}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="mx-4" />
      </ScrollArea>
    </div>
  );
}

// Individual Order Card Component with clickable navigation and cancel timer
function OrderCard({
  order,
  formatCurrency,
  formatTime,
  isFullWidth = false,
  customerId,
  onOrderCancelled,
}: {
  order: ActiveOrderStatus;
  formatCurrency: (amount: number) => string;
  formatTime: (date: Date) => string;
  isFullWidth?: boolean;
  customerId: number;
  onOrderCancelled?: () => void;
}) {
  const router = useRouter();
  const currentStepIndex = ORDER_STEPS.findIndex((s) => s.key === order.status);
  const isReady = order.status === "READY";
  const isPending = order.status === "PENDING";
  
  // Cancellation timer state
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Calculate and update cancellation timer
  useEffect(() => {
    if (!isPending) {
      setTimeRemaining(null);
      return;
    }

    const calculateRemaining = () => {
      const orderTime = new Date(order.order_date).getTime();
      const deadline = orderTime + CANCEL_WINDOW_MINUTES * 60 * 1000;
      const remaining = Math.max(0, deadline - Date.now());
      return Math.floor(remaining / 1000);
    };

    setTimeRemaining(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order.order_date, isPending]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const canCancel = isPending && timeRemaining !== null && timeRemaining > 0;

  const handleCancelOrder = async () => {
    setIsCancelling(true);
    try {
      const result = await cancelVendorOrder(order.order_id, customerId);
      if (result.success) {
        toast.success("Order cancelled successfully");
        onOrderCancelled?.();
      } else {
        toast.error(result.error || "Failed to cancel order");
      }
    } catch (error) {
      toast.error("Failed to cancel order");
    } finally {
      setIsCancelling(false);
    }
  };

  // Navigate to history with orderId for deep-linking
  const handleCardClick = () => {
    router.push(`/vendor/history?orderId=${order.order_id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={handleCardClick}
      className={cn(
        "rounded-xl border p-5 sm:p-6 transition-all cursor-pointer hover:shadow-lg",
        isFullWidth ? "w-full" : "shrink-0 w-[320px] sm:w-[380px]",
        isReady
          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:border-emerald-300"
          : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
      )}
    >
      {/* Order Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xl font-bold text-[#2d1b1a] dark:text-white">
              Order #{order.order_id}
            </h3>
            <Badge
              className={cn(
                "text-xs px-3 py-1",
                isReady
                  ? "bg-emerald-500 text-white"
                  : order.status === "PREPARING"
                    ? "bg-amber-500 text-white"
                    : "bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200"
              )}
            >
              {order.status}
            </Badge>
          </div>
          <p className="text-sm text-zinc-500">
            {formatTime(order.order_date)} • {order.items_count} item{order.items_count !== 1 ? "s" : ""}
          </p>
        </div>
        <span className="text-lg font-bold text-[#AC0F16]">
          {formatCurrency(order.total_amount)}
        </span>
      </div>

      {/* Status Stepper - Enhanced with larger icons and better z-index */}
      <div className="relative py-4">
        {/* Connector Lines - Layer 0 (behind everything) */}
        <div className="absolute top-1/3 left-[16.67%] right-[16.67%] -translate-y-1/2 h-1 z-0">
          <div className="h-full w-full bg-zinc-200 dark:bg-zinc-700 rounded-full" />
          {/* Progress overlay */}
          <div
            className={cn(
              "absolute top-0 left-0 h-full rounded-full transition-all duration-500",
              isReady ? "bg-emerald-500" : "bg-[#AC0F16]"
            )}
            style={{
              width: currentStepIndex === 0 ? "0%" : currentStepIndex === 1 ? "50%" : "100%",
            }}
          />
        </div>

        {/* Step Icons - Layer 10 (above lines) */}
        <div className="relative z-10 flex items-center justify-between">
          {ORDER_STEPS.map((step, index) => {
            const isCompleted = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const StepIcon = step.icon;

            return (
              <div key={step.key} className="flex flex-col items-center">
                {/* Step Circle - Solid background to completely hide line */}
                <div
                  className={cn(
                    "size-14 rounded-full flex items-center justify-center transition-all",
                    isCompleted
                      ? isReady && isCurrent
                        ? "bg-emerald-500 text-white ring-4 ring-emerald-200 dark:ring-emerald-800 shadow-lg"
                        : isCurrent
                          ? "bg-[#AC0F16] text-white ring-4 ring-red-200 dark:ring-red-800 shadow-lg"
                          : "bg-[#AC0F16] text-white shadow-md"
                      : "bg-white dark:bg-zinc-800 text-zinc-400 border-2 border-zinc-200 dark:border-zinc-600 shadow-sm"
                  )}
                >
                  <StepIcon className={cn("transition-transform", isFullWidth ? "size-7" : "size-6")} />
                </div>
                {/* Step Label - Larger text */}
                <span
                  className={cn(
                    "mt-3 text-sm font-semibold text-center max-w-[80px]",
                    isCompleted
                      ? "text-[#2d1b1a] dark:text-white"
                      : "text-zinc-400"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cancellation Timer - Only for PENDING orders within window */}
      {isPending && (
        <div 
          className="mt-4 flex items-center justify-between"
          onClick={(e) => e.stopPropagation()} // Prevent card click
        >
          {canCancel ? (
            <>
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <IconClock className="size-4" />
                <span className="text-sm font-medium">
                  Cancel within {formatCountdown(timeRemaining!)}
                </span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-800 dark:hover:bg-red-900/20"
                    disabled={isCancelling}
                  >
                    <IconX className="size-4 mr-1" />
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Order #{order.order_id}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel your order and restock the items. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Order</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelOrder}
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      {isCancelling ? "Cancelling..." : "Cancel Order"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <p className="text-xs text-zinc-400">
              Cancellation window expired
            </p>
          )}
        </div>
      )}

      {/* Ready Banner */}
      {isReady && (
        <div className="mt-5 bg-emerald-500 text-white rounded-xl p-4 flex items-center gap-3">
          <div className="size-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <IconMapPin className="size-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg">Ready for Pickup!</p>
            <p className="text-sm text-emerald-100 truncate">
              Present Order #{order.order_id} at counter
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
