"use client";

import { useState, useTransition } from "react";
import {
  IconRefresh,
  IconClipboardList,
  IconPackage,
  IconCircleCheck,
  IconMoodEmpty,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { OrderCard } from "./order-card";
import { OrderDetailsSheet } from "./order-details-sheet";
import type { IncomingOrder, GroupedOrders } from "@/actions/orders";
import { getIncomingOrders } from "@/actions/orders";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-col h-full min-w-[280px] sm:min-w-[320px]">
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <Badge variant="secondary" className={cn("font-mono", badgeColor)}>
          {orders.length}
        </Badge>
      </div>

      {/* Column Content */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <IconMoodEmpty className="size-10 mb-2 opacity-50" />
              <p className="text-sm">No orders</p>
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
      </ScrollArea>
    </div>
  );
}

export function OrderBoard({ initialOrders }: OrderBoardProps) {
  const [orders, setOrders] = useState<GroupedOrders>(initialOrders);
  const [selectedOrder, setSelectedOrder] = useState<IncomingOrder | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      const freshOrders = await getIncomingOrders();
      setOrders(freshOrders);
      toast.success("Orders refreshed");
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Incoming Orders</h1>
          <Badge variant="outline" className="font-mono">
            {totalOrders} active
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isPending}
          className="gap-2"
        >
          <IconRefresh className={cn("size-4", isPending && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex overflow-x-auto">
          {/* Pending Column - Most Prominent */}
          <div className="border-r border-border bg-orange-50/30 dark:bg-orange-950/10">
            <OrderColumn
              title="Pending"
              icon={<IconClipboardList className="size-5 text-orange-600 dark:text-orange-400" />}
              orders={orders.pending}
              badgeColor="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
              onOrderClick={handleOrderClick}
            />
          </div>

          {/* Preparing Column */}
          <div className="border-r border-border bg-blue-50/30 dark:bg-blue-950/10">
            <OrderColumn
              title="Preparing"
              icon={<IconPackage className="size-5 text-blue-600 dark:text-blue-400" />}
              orders={orders.preparing}
              badgeColor="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
              onOrderClick={handleOrderClick}
            />
          </div>

          {/* Ready Column */}
          <div className="bg-green-50/30 dark:bg-green-950/10 flex-1">
            <OrderColumn
              title="Ready for Pickup"
              icon={<IconCircleCheck className="size-5 text-green-600 dark:text-green-400" />}
              orders={orders.ready}
              badgeColor="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
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

