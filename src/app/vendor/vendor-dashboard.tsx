"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { DateRange } from "react-day-picker";
import { subDays, subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconShoppingCart,
  IconHistory,
  IconCash,
  IconClock,
  IconPackage,
  IconArrowRight,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconChartBar,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  getVendorStatsByDateRange,
  getVendorSpendingTrend,
  type VendorStats,
  type VendorOrder,
  type TopPurchasedItem,
  type VendorStatsByDateRange as VendorDateRangeStats,
  type VendorSpendingTrend,
} from "@/actions/vendor";

interface VendorDashboardProps {
  userName: string;
  stats: VendorStats;
  recentOrders: VendorOrder[];
  topPurchasedItems: TopPurchasedItem[];
  customerId: number;
}

/**
 * VendorDashboard - Mobile-first dashboard matching admin dashboard styling
 */
export function VendorDashboard({
  userName,
  stats,
  recentOrders,
  topPurchasedItems,
  customerId,
}: VendorDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Date range picker state - default to last 30 days
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  
  // Custom stats from date range
  const [customStats, setCustomStats] = useState<VendorDateRangeStats | null>(null);
  const [spendingTrend, setSpendingTrend] = useState<VendorSpendingTrend[]>([]);
  
  // Selected preset for highlighting
  const [selectedPreset, setSelectedPreset] = useState<string>("Last 30 days");
  
  // Quick date range presets
  const datePresets = [
    { label: "Last 7 days", getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: "Last 30 days", getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: "Last month", getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
    { label: "Dec 2025", getRange: () => ({ from: new Date(2025, 11, 1), to: new Date(2025, 11, 31) }) },
  ];
  
  // Fetch custom stats when date range changes
  useEffect(() => {
    if (customDateRange?.from && customDateRange?.to) {
      startTransition(async () => {
        const [statsResult, trendResult] = await Promise.all([
          getVendorStatsByDateRange(customerId, customDateRange.from!, customDateRange.to!),
          getVendorSpendingTrend(customerId, customDateRange.from!, customDateRange.to!),
        ]);
        setCustomStats(statsResult);
        setSpendingTrend(trendResult);
      });
    }
  }, [customDateRange, customerId]);

  // Display stats calculation
  const displayStats = customStats ? {
    primary: customStats.current,
    comparison: customStats.previous,
    periodLabel: customDateRange?.from && customDateRange?.to
      ? `${format(customDateRange.from, "MMM d")} - ${format(customDateRange.to, "MMM d, yyyy")}`
      : "Selected Period",
    periodDays: customStats.periodDays,
  } : {
    primary: { ordersCount: 0, totalSpent: 0, itemsOrdered: 0 },
    comparison: { ordersCount: 0, totalSpent: 0, itemsOrdered: 0 },
    periodLabel: "Loading...",
    periodDays: 0,
  };

  // Formatting utilities
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
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const formatDateLong = (date: Date) => {
    return new Intl.DateTimeFormat("en-PH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  };

  // Calculate percentage changes
  const calcPercentChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  };

  const percentages = useMemo(() => ({
    orders: calcPercentChange(displayStats.primary.ordersCount, displayStats.comparison.ordersCount),
    spent: calcPercentChange(displayStats.primary.totalSpent, displayStats.comparison.totalSpent),
    items: calcPercentChange(displayStats.primary.itemsOrdered, displayStats.comparison.itemsOrdered),
  }), [displayStats]);

  // Percentage badge component (inverted for spending - lower is better)
  const PercentBadge = ({ value, inverted = false }: { value: number; inverted?: boolean }) => {
    const isPositive = inverted ? value <= 0 : value >= 0;
    return (
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${
        isPositive 
          ? "bg-[#2EAFC5]/20 text-[#2EAFC5]" 
          : "bg-destructive/20 text-destructive"
      }`}>
        {isPositive ? <IconTrendingUp className="size-3" /> : <IconTrendingDown className="size-3" />}
        {value >= 0 ? "+" : ""}{value}%
      </span>
    );
  };

  // Custom tooltip for chart
  const ChartTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string; payload: { fullDate: string; orders: number } }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border text-foreground px-3 py-2 rounded-lg shadow-xl">
          <p className="text-[10px] text-muted-foreground mb-1">{payload[0]?.payload?.fullDate}</p>
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-[#2EAFC5]" />
            <span className="text-xs">Spent:</span>
            <span className="text-xs font-medium">{formatCurrency(payload[0]?.value || 0)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{payload[0]?.payload?.orders} order(s)</p>
        </div>
      );
    }
    return null;
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
    toast.success(`${item.product_name} will be added to cart`, {
      description: "Navigating to order page...",
      duration: 2000,
    });
    router.push(`/vendor/order?addProduct=${item.product_id}`);
  };

  // Handle preset click
  const handlePresetClick = (preset: { label: string; getRange: () => DateRange }) => {
    setSelectedPreset(preset.label);
    setCustomDateRange(preset.getRange());
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Welcome Header - Mobile optimized */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {getGreeting()}, {userName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your wholesale orders
          </p>
        </div>
        <Button
          size="default"
          onClick={() => router.push("/vendor/order")}
          className="gap-2 w-full sm:w-auto bg-[#AC0F16] hover:bg-[#AC0F16]/90"
        >
          <IconShoppingCart className="size-4" />
          New Order
          <IconArrowRight className="size-4" />
        </Button>
      </div>

      {/* Date Range Picker + Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Date Range Picker */}
        <DateRangePicker 
          date={customDateRange} 
          onDateChange={(range) => {
            setCustomDateRange(range);
            setSelectedPreset("");
          }}
        />
        
        {/* Quick Presets */}
        <div className="flex items-center gap-1 flex-wrap">
          {datePresets.map((preset) => (
            <button
              key={preset.label}
              className={`text-[10px] px-2.5 py-1.5 rounded-full border transition-colors font-medium ${
                selectedPreset === preset.label
                  ? "bg-[#AC0F16] text-white border-[#AC0F16]"
                  : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => handlePresetClick(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        
        {/* Loading indicator */}
        {isPending && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <IconRefresh className="size-3.5 animate-spin" />
            <span className="text-xs">Loading...</span>
          </div>
        )}
      </div>

      {/* Period Label */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">{displayStats.periodLabel}</span>
        {customStats && (
          <span className="text-xs text-muted-foreground">
            ({displayStats.periodDays} days • vs prev {displayStats.periodDays} days)
          </span>
        )}
      </div>

      {/* Top Metric Cards - 2x2 grid on mobile */}
      <div className="grid grid-cols-2 gap-3">
        {/* Orders Count */}
        <div 
          className="bg-card rounded-xl border px-4 py-3 cursor-pointer hover:shadow-md transition-all hover:border-[#AC0F16]/30"
          onClick={() => router.push("/vendor/history")}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="size-7 rounded-lg bg-[#AC0F16]/20 flex items-center justify-center">
              <IconReceipt className="size-4 text-[#AC0F16]" />
            </div>
            <PercentBadge value={percentages.orders} />
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">{displayStats.primary.ordersCount}</p>
          <p className="text-[10px] text-muted-foreground">Orders Placed</p>
        </div>

        {/* Total Spent */}
        <div 
          className="bg-card rounded-xl border px-4 py-3 cursor-pointer hover:shadow-md transition-all hover:border-[#2EAFC5]/30"
          onClick={() => router.push("/vendor/history")}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="size-7 rounded-lg bg-[#2EAFC5]/20 flex items-center justify-center">
              <IconCash className="size-4 text-[#2EAFC5]" />
            </div>
            <PercentBadge value={percentages.spent} />
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(displayStats.primary.totalSpent)}</p>
          <p className="text-[10px] text-muted-foreground">Total Spent</p>
        </div>

        {/* Items Ordered */}
        <div 
          className="bg-card rounded-xl border px-4 py-3 cursor-pointer hover:shadow-md transition-all hover:border-[#F1782F]/30"
          onClick={() => router.push("/vendor/history")}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="size-7 rounded-lg bg-[#F1782F]/20 flex items-center justify-center">
              <IconPackage className="size-4 text-[#F1782F]" />
            </div>
            <PercentBadge value={percentages.items} />
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">{displayStats.primary.itemsOrdered}</p>
          <p className="text-[10px] text-muted-foreground">Items Ordered</p>
        </div>

        {/* Active Orders */}
        <div 
          className="bg-card rounded-xl border px-4 py-3 cursor-pointer hover:shadow-md transition-all hover:border-amber-500/30"
          onClick={() => router.push("/vendor/history")}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="size-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <IconClock className="size-4 text-amber-500" />
            </div>
            {stats.pendingOrders > 0 && (
              <span className="relative flex size-2">
                <span className="animate-ping absolute h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                <span className="relative rounded-full size-2 bg-amber-500"></span>
              </span>
            )}
          </div>
          <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{stats.pendingOrders}</p>
          <p className="text-[10px] text-muted-foreground">Active Orders</p>
        </div>
      </div>

      {/* Spending Trend Chart */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-medium text-sm text-foreground">Spending Overview</h3>
            <p className="text-[10px] text-muted-foreground">
              Your wholesale spending trend
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-[#2EAFC5]" />
            <span className="text-[10px] text-muted-foreground">Spending</span>
          </div>
        </div>
        
        <div className="h-[180px] sm:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spendingTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="fillSpending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2EAFC5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2EAFC5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="date" 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 10 }} 
                className="fill-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 10 }} 
                className="fill-muted-foreground" 
                tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`}
                width={40}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area 
                dataKey="spent" 
                type="monotone" 
                fill="url(#fillSpending)" 
                stroke="#2EAFC5"
                strokeWidth={2}
                dot={false}
                activeDot={{ fill: "#2EAFC5", stroke: "white", strokeWidth: 2, r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Purchased Items - Quick Re-order */}
        <div className="bg-card rounded-xl border">
          <div className="flex items-center gap-2 p-3 border-b">
            <IconTrendingUp className="size-4 text-[#AC0F16]" />
            <h3 className="font-medium text-sm flex-1">Top Purchased</h3>
            <span className="text-[10px] text-muted-foreground">Quick re-order</span>
          </div>
          
          {topPurchasedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[180px] py-8 text-muted-foreground">
              <IconPackage className="size-8 mb-2 opacity-50" />
              <p className="text-sm">No purchase history yet</p>
              <Button
                variant="link"
                className="mt-2 text-[#AC0F16]"
                onClick={() => router.push("/vendor/order")}
              >
                Place your first order
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {topPurchasedItems.map((item, index) => {
                const isOutOfStock = item.current_stock === 0;
                return (
                  <div
                    key={item.product_id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                  >
                    {/* Rank Badge */}
                    <div className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? "bg-amber-500/20 text-amber-600" :
                      index === 1 ? "bg-slate-300/30 text-slate-600" :
                      "bg-orange-400/20 text-orange-600"
                    }`}>
                      {index + 1}
                    </div>
                    
                    {/* Product Image */}
                    <div className="size-10 rounded-lg bg-muted overflow-hidden shrink-0">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.product_name}
                          width={40}
                          height={40}
                          className="object-cover size-full"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <IconPackage className="size-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs line-clamp-1">
                        {item.product_name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="font-mono text-[#2EAFC5] font-medium">
                          {formatCurrency(item.wholesale_price)}
                        </span>
                        <span>•</span>
                        <span>{item.total_quantity} ordered</span>
                      </div>
                    </div>

                    {/* Quick Add Button */}
                    <Button
                      size="sm"
                      variant={isOutOfStock ? "outline" : "default"}
                      onClick={() => handleQuickAdd(item)}
                      disabled={isOutOfStock}
                      className="shrink-0 h-8 px-2 text-xs"
                    >
                      <IconPlus className="size-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="bg-card rounded-xl border">
          <div className="flex items-center gap-2 p-3 border-b">
            <IconHistory className="size-4 text-[#2EAFC5]" />
            <h3 className="font-medium text-sm flex-1">Recent Orders</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => router.push("/vendor/history")}
            >
              View All
              <IconArrowRight className="size-3 ml-1" />
            </Button>
          </div>
          
          <ScrollArea className="h-[220px]">
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                <IconPackage className="size-8 mb-2 opacity-50" />
                <p className="text-sm">No orders yet</p>
                <Button
                  variant="link"
                  className="mt-2 text-[#AC0F16]"
                  onClick={() => router.push("/vendor/order")}
                >
                  Place your first order
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentOrders.map((order) => (
                  <button
                    key={order.order_id}
                    onClick={() => router.push(`/vendor/history?order=${order.order_id}`)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="size-9 rounded-full bg-[#2EAFC5]/20 flex items-center justify-center flex-shrink-0">
                      <IconReceipt className="size-4 text-[#2EAFC5]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium truncate text-foreground">
                          Order #{order.order_id}
                        </p>
                        <Badge className={`text-[10px] px-1.5 py-0 ${getStatusColor(order.status)}`}>
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {order.items.length} item{order.items.length !== 1 ? "s" : ""} • {formatDate(order.order_date)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium font-mono text-xs text-[#2EAFC5]">
                        {formatCurrency(order.total_amount)}
                      </p>
                    </div>
                    <IconArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
          
          <div className="flex items-center justify-center p-2 border-t">
            <p className="text-[10px] text-muted-foreground">{formatDateLong(new Date())}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card rounded-xl border p-3">
        <div className="flex items-center gap-2 mb-3">
          <IconChartBar className="size-4 text-foreground" />
          <h3 className="font-medium text-sm">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-1.5"
            onClick={() => router.push("/vendor/order")}
          >
            <IconShoppingCart className="size-5 text-[#AC0F16]" />
            <span className="text-xs font-medium">New Order</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-1.5"
            onClick={() => router.push("/vendor/history")}
          >
            <IconHistory className="size-5 text-[#2EAFC5]" />
            <span className="text-xs font-medium">Order History</span>
          </Button>
        </div>
      </div>
    </div>
  );
}



