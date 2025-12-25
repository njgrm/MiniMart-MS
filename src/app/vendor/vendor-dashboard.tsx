"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  IconShoppingCart,
  IconHistory,
  IconCash,
  IconClock,
  IconPackage,
  IconArrowRight,
  IconPlus,
  IconTrendingUp,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VendorStats, VendorOrder, TopPurchasedItem } from "@/actions/vendor";

interface VendorDashboardProps {
  userName: string;
  stats: VendorStats;
  recentOrders: VendorOrder[];
  topPurchasedItems: TopPurchasedItem[];
}

/**
 * VendorDashboard - Welcome page with quick stats and actions
 */
export function VendorDashboard({
  userName,
  stats,
  recentOrders,
  topPurchasedItems,
}: VendorDashboardProps) {
  const router = useRouter();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "No orders yet";
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
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

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Quick add - navigates to order page with pre-selected item
  const handleQuickAdd = (item: TopPurchasedItem) => {
    if (item.current_stock === 0) {
      toast.error(`${item.product_name} is out of stock`);
      return;
    }

    // Show toast and navigate to order page with the item as a URL parameter
    toast.success(`${item.product_name} will be added to cart`, {
      description: "Navigating to order page...",
      duration: 2000,
    });

    // Navigate to order page with pre-select parameter
    // The order page will read this and add the item to cart
    router.push(`/vendor/order?addProduct=${item.product_id}`);
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {getGreeting()}, {userName}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome to your vendor portal. Place wholesale orders here.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => router.push("/vendor/order")}
          className="gap-2 sm:self-start"
        >
          <IconShoppingCart className="size-5" />
          Start New Order
          <IconArrowRight className="size-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 gap-3 sm:gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-sm lg:grid-cols-4">
        {/* Total Orders */}
        <Card className="@container/card">
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Total Orders</CardDescription>
            <CardTitle className="text-xl sm:text-2xl font-semibold tabular-nums">
              {stats.totalOrders}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 text-xs">
                <IconHistory className="size-3" />
                <span className="hidden sm:inline">All time</span>
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-xs sm:text-sm p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="line-clamp-1 flex gap-2 font-medium">
              <span className="hidden sm:inline">Order history</span>
              <span className="sm:hidden">History</span>
              <IconPackage className="size-4 text-primary" />
            </div>
          </CardFooter>
        </Card>

        {/* Pending Orders */}
        <Card className="@container/card">
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Active Orders</CardDescription>
            <CardTitle className="text-xl sm:text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {stats.pendingOrders}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800">
                <IconClock className="size-3" />
                <span className="hidden sm:inline">In progress</span>
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-xs sm:text-sm p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="line-clamp-1 flex gap-2 font-medium">
              <span className="hidden sm:inline">Being prepared</span>
              <span className="sm:hidden">Pending</span>
              <IconClock className="size-4 text-amber-500" />
            </div>
          </CardFooter>
        </Card>

        {/* Total Spent */}
        <Card className="@container/card">
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Total Spent</CardDescription>
            <CardTitle className="text-xl sm:text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(stats.totalSpent)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                <IconCash className="size-3" />
                <span className="hidden sm:inline">Completed</span>
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-xs sm:text-sm p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="line-clamp-1 flex gap-2 font-medium">
              <span className="hidden sm:inline">Wholesale value</span>
              <span className="sm:hidden">Value</span>
              <IconCash className="size-4 text-emerald-500" />
            </div>
          </CardFooter>
        </Card>

        {/* Last Order */}
        <Card className="@container/card">
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Last Order</CardDescription>
            <CardTitle className="text-base sm:text-lg font-semibold">
              {stats.lastOrderDate
                ? new Intl.DateTimeFormat("en-PH", {
                    month: "short",
                    day: "numeric",
                  }).format(new Date(stats.lastOrderDate))
                : "N/A"}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 text-xs">
                <IconHistory className="size-3" />
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-xs sm:text-sm p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="line-clamp-1 flex gap-2 font-medium text-xs">
              {stats.lastOrderDate
                ? new Intl.DateTimeFormat("en-PH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(stats.lastOrderDate))
                : "No orders yet"}
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Quick Actions & Top Purchased Items */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => router.push("/vendor/order")}
            >
              <IconShoppingCart className="size-6 text-secondary" />
              <span className="text-sm font-medium">New Order</span>
              <span className="text-xs text-muted-foreground">Browse catalog</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => router.push("/vendor/history")}
            >
              <IconHistory className="size-6 text-primary" />
              <span className="text-sm font-medium">Order History</span>
              <span className="text-xs text-muted-foreground">View past orders</span>
            </Button>
          </CardContent>
        </Card>

        {/* Top Purchased Items - Quick Re-order */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <IconTrendingUp className="size-5 text-primary" />
                  Top Purchased Items
                </CardTitle>
                <CardDescription>Quick re-order your favorites</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {topPurchasedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[180px] py-8 text-muted-foreground">
                <IconPackage className="size-8 mb-2 opacity-50" />
                <p className="text-sm">No purchase history yet</p>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => router.push("/vendor/order")}
                >
                  Place your first order
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {topPurchasedItems.map((item) => {
                  const isOutOfStock = item.current_stock === 0;
                  return (
                    <div
                      key={item.product_id}
                      className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                    >
                      {/* Product Image */}
                      <div className="size-12 rounded-lg bg-muted overflow-hidden shrink-0">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.product_name}
                            width={48}
                            height={48}
                            className="object-cover size-full"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <IconPackage className="size-5 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-clamp-1">
                          {item.product_name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono text-primary font-medium">
                            {formatCurrency(item.wholesale_price)}
                          </span>
                          <span>•</span>
                          <span>{item.total_quantity} ordered total</span>
                        </div>
                      </div>

                      {/* Quick Add Button */}
                      <Button
                        size="sm"
                        variant={isOutOfStock ? "outline" : "default"}
                        onClick={() => handleQuickAdd(item)}
                        disabled={isOutOfStock}
                        className="shrink-0 gap-1"
                      >
                        <IconPlus className="size-4" />
                        {isOutOfStock ? "Out" : "Add"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <div className="grid grid-cols-1 gap-4">

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <IconHistory className="size-5 text-primary" />
                  Recent Orders
                </CardTitle>
                <CardDescription>Your latest orders</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/vendor/history")}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[240px]">
              {recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                  <IconPackage className="size-8 mb-2 opacity-50" />
                  <p>No orders yet</p>
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={() => router.push("/vendor/order")}
                  >
                    Place your first order
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentOrders.map((order) => (
                    <div
                      key={order.order_id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <IconPackage className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            Order #{order.order_id}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.items.length} item{order.items.length !== 1 ? "s" : ""} • {formatDate(order.order_date)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium font-mono text-sm">
                          {formatCurrency(order.total_amount)}
                        </p>
                        <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



