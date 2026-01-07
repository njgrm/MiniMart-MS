"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconRefresh,
  IconClipboardList,
  IconPackage,
  IconCircleCheck,
  IconMoodEmpty,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderCard } from "./order-card";
import { OrderDetailsSheet } from "./order-details-sheet";
import type { IncomingOrder, GroupedOrders } from "@/actions/orders";
import { getIncomingOrders } from "@/actions/orders";
import { cn } from "@/lib/utils";

const AUTO_REFRESH_INTERVAL = 2000; // 2 seconds

interface OrderBoardProps {
  initialOrders: GroupedOrders;
}

interface ColumnProps {
  title: string;
  icon: React.ReactNode;
  orders: IncomingOrder[];
  badgeColor: string;
  onOrderClick: (order: IncomingOrder) => void;
}

function OrderColumn({ title, icon, orders, badgeColor, onOrderClick }: ColumnProps) {
  return (
    <div className="flex flex-col h-full min-w-[300px] sm:min-w-[340px] flex-1 bg-muted/30">
      {/* Column Header - Fixed at top */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-muted/50 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{orders.length} order{orders.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <Badge className={cn("font-mono text-sm px-2.5 py-1", badgeColor)}>
          {orders.length}
        </Badge>
      </div>

      {/* Column Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <IconMoodEmpty className="size-12 mb-3 opacity-50" />
              <p className="font-medium">No orders</p>
              <p className="text-sm">Waiting for new orders...</p>
            </div>
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.order_id}
                order={order}
                onClick={() => onOrderClick(order)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function OrderBoard({ initialOrders }: OrderBoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<GroupedOrders>(initialOrders);
  const [selectedOrder, setSelectedOrder] = useState<IncomingOrder | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);
  const selectedOrderRef = useRef<IncomingOrder | null>(null);
  const hasHandledUrlOrderRef = useRef(false);

  // Handle orderId from URL to auto-open the drawer
  useEffect(() => {
    const orderId = searchParams.get("orderId");
    if (orderId && !hasHandledUrlOrderRef.current) {
      const orderIdNum = parseInt(orderId, 10);
      const allOrders = [...orders.pending, ...orders.preparing, ...orders.ready];
      const order = allOrders.find((o) => o.order_id === orderIdNum);
      if (order) {
        setSelectedOrder(order);
        setIsSheetOpen(true);
        hasHandledUrlOrderRef.current = true;
        // Clear the URL param after opening
        router.replace("/admin/orders", { scroll: false });
      }
    }
  }, [searchParams, orders, router]);

  // Keep selectedOrderRef in sync
  useEffect(() => {
    selectedOrderRef.current = selectedOrder;
  }, [selectedOrder]);

  // Auto-refresh function (silent - no toast)
  const silentRefresh = useCallback(async () => {
    try {
      const freshOrders = await getIncomingOrders();
      setOrders(freshOrders);
      // Update selected order if still exists
      if (selectedOrderRef.current) {
        const updated = [
          ...freshOrders.pending,
          ...freshOrders.preparing,
          ...freshOrders.ready,
        ].find((o) => o.order_id === selectedOrderRef.current!.order_id);
        if (updated) {
          setSelectedOrder(updated);
        }
      }
    } catch (error) {
      console.error("[OrderBoard] Auto-refresh failed:", error);
    }
  }, []);

  // Auto-refresh every 2 seconds
  useEffect(() => {
    autoRefreshRef.current = setInterval(silentRefresh, AUTO_REFRESH_INTERVAL);
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [silentRefresh]);

  // Manual refresh - fetches fresh data and updates local state (with toast)
  const handleRefresh = async () => {
    setIsRefreshing(true);
    startTransition(async () => {
      try {
        const freshOrders = await getIncomingOrders();
        setOrders(freshOrders);
        // Update selected order if still exists
        if (selectedOrder) {
          const updated = [
            ...freshOrders.pending,
            ...freshOrders.preparing,
            ...freshOrders.ready,
          ].find((o) => o.order_id === selectedOrder.order_id);
          if (updated) {
            setSelectedOrder(updated);
          }
        }
        toast.success("Orders refreshed");
      } catch (error) {
        console.error("[OrderBoard] Failed to refresh orders:", error);
        toast.error("Failed to refresh orders");
      } finally {
        setIsRefreshing(false);
      }
    });
  };

  const handleOrderClick = (order: IncomingOrder) => {
    setSelectedOrder(order);
    setIsSheetOpen(true);
  };

  const handleOrderUpdated = () => {
    startTransition(async () => {
      const freshOrders = await getIncomingOrders();
      setOrders(freshOrders);
      // Update selected order if it's still in the list
      if (selectedOrder) {
        const updated = [
          ...freshOrders.pending,
          ...freshOrders.preparing,
          ...freshOrders.ready,
        ].find((o) => o.order_id === selectedOrder.order_id);
        setSelectedOrder(updated || null);
        if (!updated) {
          setIsSheetOpen(false);
        }
      }
    });
  };

  const totalOrders = orders.pending.length + orders.preparing.length + orders.ready.length;

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header - Fixed at top */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground">Incoming Orders</h1>
          <Badge className="font-mono bg-[#AC0F16] text-white">
            {totalOrders} active
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isPending || isRefreshing}
          className="gap-2"
        >
          <IconRefresh className={cn("size-4", (isPending || isRefreshing) && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Board - Takes remaining height, contains equal-height columns */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full flex">
          {/* Pending Column */}
          <div className="flex-1 border-r border-border flex flex-col min-w-[300px]">
            <OrderColumn
              title="Pending"
              icon={<IconClipboardList className="size-5 text-orange-600 dark:text-orange-400" />}
              orders={orders.pending}
              badgeColor="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
              onOrderClick={handleOrderClick}
            />
          </div>

          {/* Preparing Column */}
          <div className="flex-1 border-r border-border flex flex-col min-w-[300px]">
            <OrderColumn
              title="Preparing"
              icon={<IconPackage className="size-5 text-blue-600 dark:text-blue-400" />}
              orders={orders.preparing}
              badgeColor="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
              onOrderClick={handleOrderClick}
            />
          </div>

          {/* Ready Column */}
          <div className="flex-1 flex flex-col min-w-[300px]">
            <OrderColumn
              title="Ready for Pickup"
              icon={<IconCircleCheck className="size-5 text-emerald-600 dark:text-emerald-400" />}
              orders={orders.ready}
              badgeColor="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
              onOrderClick={handleOrderClick}
            />
          </div>
        </div>
      </div>

      {/* Order Details Sheet */}
      <OrderDetailsSheet
        order={selectedOrder}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onOrderUpdated={handleOrderUpdated}
      />
    </div>
  );
}

