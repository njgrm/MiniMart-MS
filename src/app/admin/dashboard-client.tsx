"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DateRange } from "react-day-picker";
import { subDays, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay, startOfYear, endOfYear, format } from "date-fns";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconReceipt,
  IconPackage,
  IconChartBar,
  IconClock,
  IconArrowRight,
  IconUser,
  IconWallet,
  IconShoppingCart,
  IconCurrencyPeso,
  IconBroadcast,
  IconRefresh,
  IconPlus,
  IconHelpCircle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getSalesStatsByDateRange } from "@/actions/sales";
import { getDashboardChartDataByDateRange, type DashboardChartDataPoint } from "@/app/admin/analytics/actions";
import { ActiveOrdersCard } from "@/components/dashboard/active-orders-card";
import { CashRegisterCard, type CashRegisterData } from "@/components/dashboard/cash-register-card";
import { InventoryHealthCard, type InventoryHealthData } from "@/components/dashboard/inventory-health-card";
import type { SalesHistoryResult } from "@/actions/sales";
import type { GroupedOrders, IncomingOrder } from "@/actions/orders";

interface SalesStats {
  today: { count: number; revenue: number; cost: number; profit: number };
  yesterday: { count: number; revenue: number; cost: number; profit: number };
  month: { count: number; revenue: number; cost: number; profit: number };
  lastMonth: { count: number; revenue: number; cost: number; profit: number };
}

interface InventoryMetrics {
  totalProducts: number;
  outOfStockItems: number;
  lowStockItems: number;
  inventoryValue: number;
}

interface DashboardClientProps {
  stats: SalesStats;
  recentSales: SalesHistoryResult;
  inventoryMetrics: InventoryMetrics;
  topProducts?: { product_id: number; product_name: string; quantity_sold: number; revenue: number }[];
  incomingOrders?: GroupedOrders;
  recentCompletedOrders?: IncomingOrder[];
  activeOrdersCount?: number;
  cashRegisterData?: CashRegisterData;
  inventoryHealthData?: InventoryHealthData;
  todayStats?: {
    revenue: number;
    cost: number;
    profit: number;
    count: number;
    cashSales: number;
    gcashSales: number;
  };
}

export function DashboardClient({
  stats,
  recentSales,
  inventoryMetrics,
  topProducts = [],
  incomingOrders = { pending: [], preparing: [], ready: [] },
  recentCompletedOrders = [],
  activeOrdersCount = 0,
  cashRegisterData,
  inventoryHealthData,
  todayStats,
}: DashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Date range picker state - default to TODAY for operational dashboard
  const today = new Date();
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>({
    from: startOfDay(today),
    to: endOfDay(today),
  });
  
  // Custom stats from date range
  const [customStats, setCustomStats] = useState<{
    current: { count: number; revenue: number; cost: number; profit: number };
    previous: { count: number; revenue: number; cost: number; profit: number };
    periodDays: number;
  } | null>(null);
  
  // Selected preset for highlighting - default to Today
  const [selectedPreset, setSelectedPreset] = useState<string>("Today");
  
  // Chart line toggles for Sales Overview
  const [showRevenue, setShowRevenue] = useState(true);
  const [showProfit, setShowProfit] = useState(true);
  const [showCost, setShowCost] = useState(false);
  
  // Chart data from server
  const [salesChartData, setSalesChartData] = useState<DashboardChartDataPoint[]>([]);
  
  // Quick date range presets - Today first for operational focus
  const datePresets = [
    { label: "Today", getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
    { label: "Yesterday", getRange: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
    { label: "Last 7 days", getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: "Last 30 days", getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: "Last 90 days", getRange: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
    { label: "Last 6 months", getRange: () => ({ from: subMonths(new Date(), 6), to: new Date() }) },
    { label: "This month", getRange: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
    { label: "Last month", getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
    { label: "2026", getRange: () => ({ from: startOfYear(new Date(2026, 0, 1)), to: endOfYear(new Date(2026, 0, 1)) }) },
    { label: "2025", getRange: () => ({ from: startOfYear(new Date(2025, 0, 1)), to: endOfYear(new Date(2025, 0, 1)) }) },
  ];
  
  // Fetch custom stats when date range changes
  useEffect(() => {
    if (customDateRange?.from && customDateRange?.to) {
      startTransition(async () => {
        // Fetch stats
        const result = await getSalesStatsByDateRange(customDateRange.from!, customDateRange.to!);
        setCustomStats(result);
        
        // Fetch chart data from server (queries ALL transactions with actual profit/cost)
        const chartData = await getDashboardChartDataByDateRange(customDateRange.from!, customDateRange.to!);
        setSalesChartData(chartData);
      });
    }
  }, [customDateRange]);

  // Display stats calculation - use today's stats from server if available and showing today
  const isShowingToday = selectedPreset === "Today";
  const displayStats = customStats ? {
    primary: customStats.current,
    comparison: customStats.previous,
    periodLabel: customDateRange?.from && customDateRange?.to
      ? format(customDateRange.from, "MMM d") === format(customDateRange.to, "MMM d")
        ? format(customDateRange.from, "MMMM d, yyyy")
        : `${format(customDateRange.from, "MMM d")} - ${format(customDateRange.to, "MMM d, yyyy")}`
      : "Selected Period",
    periodDays: customStats.periodDays,
  } : todayStats ? {
    primary: { count: todayStats.count, revenue: todayStats.revenue, cost: todayStats.cost, profit: todayStats.profit },
    comparison: stats.yesterday,
    periodLabel: "Today",
    periodDays: 1,
  } : {
    primary: stats.today,
    comparison: stats.yesterday,
    periodLabel: "Today",
    periodDays: 1,
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

  // Format peso with normal weight sign (for JSX rendering)
  const formatPeso = (amount: number, decimals: number = 2) => {
    const formatted = amount.toLocaleString("en-PH", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return (
      <>
        <span className="font-normal">₱</span>{formatted}
      </>
    );
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-PH", {
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
    profit: calcPercentChange(displayStats.primary.profit, displayStats.comparison.profit),
    revenue: calcPercentChange(displayStats.primary.revenue, displayStats.comparison.revenue),
    cost: calcPercentChange(displayStats.primary.cost, displayStats.comparison.cost),
    transactions: calcPercentChange(displayStats.primary.count, displayStats.comparison.count),
  }), [displayStats]);

  // Generate comparison period label based on selected preset
  const getComparisonLabel = (): string => {
    switch (selectedPreset) {
      case "Today":
        return "vs Yesterday";
      case "Yesterday":
        return "vs 2 days ago";
      case "Last 7 days":
        return "vs previous 7 days";
      case "Last 30 days":
        return "vs previous 30 days";
      case "Last 90 days":
        return "vs previous 90 days";
      case "Last 6 months":
        return "vs previous 6 months";
      case "This month":
        return "vs last month";
      case "Last month":
        return "vs month before";
      case "2026":
        return "vs 2025";
      case "2025":
        return "vs 2024";
      default:
        return "vs previous period";
    }
  };

  // Percentage badge component with tooltip - Smart comparison: hide negative % for "Today"
  const PercentBadge = ({ value, inverted = false, metric }: { value: number; inverted?: boolean; metric: string }) => {
    const isPositive = inverted ? value <= 0 : value >= 0;
    
    // Smart Trend Logic: If showing "Today", only show POSITIVE trends
    // Why: Negative % in the morning just means the day isn't over yet - it's noise
    const showTrend = selectedPreset !== "Today" || isPositive;
    if (!showTrend) return null;
    
    const comparisonLabel = getComparisonLabel();
    const tooltipText = `${metric}: ${value >= 0 ? "+" : ""}${value}% ${comparisonLabel}`;
    
    return (
      <TooltipProvider delayDuration={100}>
        <TooltipUI>
          <TooltipTrigger asChild>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 cursor-help ${
              isPositive 
                ? "bg-[#2EAFC5]/20 text-[#2EAFC5]" 
                : "bg-destructive/20 text-destructive"
            }`}>
              {isPositive ? <IconTrendingUp className="size-3" /> : <IconTrendingDown className="size-3" />}
              {value >= 0 ? "+" : ""}{value}%
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p>{tooltipText}</p>
          </TooltipContent>
        </TooltipUI>
      </TooltipProvider>
    );
  };

  // Handle live feed item click - navigate to sales with drawer open
  const handleTransactionClick = (receiptNo: string) => {
    router.push(`/admin/sales?receipt=${receiptNo}&view=true`);
  };

  // Handle preset click for main date range
  const handlePresetClick = (preset: { label: string; getRange: () => DateRange }) => {
    setSelectedPreset(preset.label);
    setCustomDateRange(preset.getRange());
  };

  // Custom tooltip for sales chart
  const SalesChartTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string; payload: { fullDate: string } }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border text-foreground px-3 py-2 rounded-lg shadow-xl">
          <p className="text-[10px] text-muted-foreground mb-1">{payload[0]?.payload?.fullDate}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-xs capitalize">{entry.dataKey}:</span>
              <span className="text-xs font-medium">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Default cash register data
  const defaultCashRegister: CashRegisterData = {
    openingFund: 2000,
    cashSales: todayStats?.cashSales ?? 0,
    gcashSales: todayStats?.gcashSales ?? 0,
    expenses: 0,
    expectedDrawer: 2000 + (todayStats?.cashSales ?? 0),
    transactionCount: todayStats?.count ?? 0,
    shiftStartTime: startOfDay(new Date()),
    isShiftActive: true,
  };

  // Default inventory health data
  const defaultInventoryHealth: InventoryHealthData = {
    lowStockItems: [],
    expiringItems: [],
    outOfStockCount: inventoryMetrics.outOfStockItems,
    lowStockCount: inventoryMetrics.lowStockItems,
    expiringCount: 0,
  };

  return (
    <div className="flex flex-col gap-4 pb-6 relative">
      {/* Combined Header Row: Date Picker + Presets + Quick Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date Range Picker */}
        <DateRangePicker 
          date={customDateRange} 
          onDateChange={(range) => {
            setCustomDateRange(range);
            setSelectedPreset(""); // Clear preset selection when manually picking
          }}
        />
        
        {/* Quick Presets - Clickable badges with primary highlight */}
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
        
        {/* Spacer to push actions to right */}
        <div className="flex-1" />
        
        {/* Quick Actions - Command Bar (moved from bottom) */}
        <div className="flex items-center gap-1.5">
          <Button 
            size="sm"
            className="h-8 px-4 gap-1.5 bg-[#AC0F16] hover:bg-[#AC0F16]/90 text-white shadow-md hover:shadow-lg transition-shadow font-medium"
            onClick={() => router.push("/admin/pos")}
          >
            <IconPlus className="size-3.5" />
            <span className="text-xs">New Sale</span>
          </Button>
          <Button 
            variant="outline"
            size="sm"
            className="h-8 px-3 gap-1.5"
            onClick={() => router.push("/admin/inventory")}
          >
            <IconPackage className="size-3.5 text-[#F1782F]" />
            <span className="hidden sm:inline text-xs">Inventory</span>
          </Button>
          <Button 
            variant="outline"
            size="sm"
            className="h-8 px-3 gap-1.5"
            onClick={() => router.push("/admin/orders")}
          >
            <IconClock className="size-3.5 text-[#2EAFC5]" />
            <span className="hidden sm:inline text-xs">Orders</span>
          </Button>
          <Button 
            variant="outline"
            size="sm"
            className="h-8 px-3 gap-1.5"
            onClick={() => router.push("/admin/reports")}
          >
            <IconChartBar className="size-3.5 text-[#AC0F16]" />
            <span className="hidden lg:inline text-xs">Reports</span>
          </Button>
        </div>
        
        {/* Loading indicator */}
        {isPending && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <IconRefresh className="size-3.5 animate-spin" />
            <span className="text-xs hidden sm:inline">Loading...</span>
          </div>
        )}
      </div>

      {/* Top Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Profit Card */}
        <div 
          className="bg-card rounded-xl border px-4 py-3 cursor-pointer hover:shadow-md transition-all hover:border-[#AC0F16]/30"
          onClick={() => router.push("/admin/sales/financial")}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="size-7 rounded-lg bg-[#AC0F16]/20 flex items-center justify-center">
              <IconCurrencyPeso className="size-4 text-[#AC0F16]" />
            </div>
            <PercentBadge value={percentages.profit} metric="Profit" />
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">{formatPeso(displayStats.primary.profit)}</p>
          <div className="flex items-center gap-1">
            <p className="text-[10px] text-muted-foreground">Profit</p>
            <TooltipProvider delayDuration={100}>
              <TooltipUI>
                <TooltipTrigger asChild>
                  <IconHelpCircle className="size-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  <p className="font-medium">Sales Revenue − Cost of Goods</p>
                  <p className="text-muted-foreground">Net earnings from completed sales</p>
                </TooltipContent>
              </TooltipUI>
            </TooltipProvider>
          </div>
        </div>

        {/* Total Revenue Card */}
        <div 
          className="bg-card rounded-xl border px-4 py-3 cursor-pointer hover:shadow-md transition-all hover:border-[#2EAFC5]/30"
          onClick={() => router.push("/admin/sales/financial")}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="size-7 rounded-lg bg-[#2EAFC5]/20 flex items-center justify-center">
              <IconWallet className="size-4 text-[#2EAFC5]" />
            </div>
            <PercentBadge value={percentages.revenue} metric="Revenue" />
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">{formatPeso(displayStats.primary.revenue)}</p>
          <div className="flex items-center gap-1">
            <p className="text-[10px] text-muted-foreground">Sales Revenue</p>
            <TooltipProvider delayDuration={100}>
              <TooltipUI>
                <TooltipTrigger asChild>
                  <IconHelpCircle className="size-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  <p className="font-medium">Total sales value (Cash + Digital)</p>
                  <p className="text-muted-foreground">Gross income before costs</p>
                </TooltipContent>
              </TooltipUI>
            </TooltipProvider>
          </div>
        </div>

        {/* Total Cost Card */}
        <div 
          className="bg-card rounded-xl border px-4 py-3 cursor-pointer hover:shadow-md transition-all hover:border-[#F1782F]/30"
          onClick={() => router.push("/admin/vendor")}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="size-7 rounded-lg bg-[#F1782F]/20 flex items-center justify-center">
              <IconShoppingCart className="size-4 text-[#F1782F]" />
            </div>
            <PercentBadge value={percentages.cost} inverted metric="Cost" />
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">{formatPeso(displayStats.primary.cost)}</p>
          <div className="flex items-center gap-1">
            <p className="text-[10px] text-muted-foreground">Cost of Goods</p>
            <TooltipProvider delayDuration={100}>
              <TooltipUI>
                <TooltipTrigger asChild>
                  <IconHelpCircle className="size-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  <p className="font-medium">Sum of item cost prices × quantity sold</p>
                  <p className="text-muted-foreground">Lower is better for margins</p>
                </TooltipContent>
              </TooltipUI>
            </TooltipProvider>
          </div>
        </div>

        {/* Transactions Count Card */}
        <div 
          className="bg-card rounded-xl border px-4 py-3 cursor-pointer hover:shadow-md transition-all hover:border-[#AC0F16]/30"
          onClick={() => router.push("/admin/sales")}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="size-7 rounded-lg bg-[#AC0F16]/20 flex items-center justify-center">
              <IconReceipt className="size-4 text-[#AC0F16]" />
            </div>
            <PercentBadge value={percentages.transactions} metric="Transactions" />
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">{displayStats.primary.count}</p>
          <div className="flex items-center gap-1">
            <p className="text-[10px] text-muted-foreground">Transactions</p>
            <TooltipProvider delayDuration={100}>
              <TooltipUI>
                <TooltipTrigger asChild>
                  <IconHelpCircle className="size-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  <p className="font-medium">Count of completed receipts</p>
                  <p className="text-muted-foreground">Higher traffic = more customers served</p>
                </TooltipContent>
              </TooltipUI>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Sales Overview + Active Orders - 75/25 Split */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sales Overview Chart */}
        <div className="bg-card rounded-xl border p-4 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-medium text-sm text-foreground">Sales Overview</h3>
              <p className="text-[10px] text-muted-foreground">
                Revenue, profit, and cost trends for selected period
              </p>
            </div>
            
            {/* Toggle buttons for chart lines */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowRevenue(!showRevenue)}
                className={`text-[10px] px-2.5 py-1.5 rounded-full border transition-colors font-medium flex items-center gap-1.5 ${
                  showRevenue
                    ? "bg-[#2EAFC5] text-white border-[#2EAFC5]"
                    : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="size-2 rounded-full bg-current" />
                Revenue
              </button>
              <button
                onClick={() => setShowProfit(!showProfit)}
                className={`text-[10px] px-2.5 py-1.5 rounded-full border transition-colors font-medium flex items-center gap-1.5 ${
                  showProfit
                    ? "bg-[#10B981] text-white border-[#10B981]"
                    : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="size-2 rounded-full bg-current" />
                Profit
              </button>
              <button
                onClick={() => setShowCost(!showCost)}
                className={`text-[10px] px-2.5 py-1.5 rounded-full border transition-colors font-medium flex items-center gap-1.5 ${
                  showCost
                    ? "bg-[#F1782F] text-white border-[#F1782F]"
                    : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="size-2 rounded-full bg-current" />
                Cost
              </button>
            </div>
          </div>
          
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2EAFC5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2EAFC5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F1782F" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F1782F" stopOpacity={0} />
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
                width={45}
              />
              <Tooltip content={<SalesChartTooltip />} />
              {showRevenue && (
                <Area 
                  dataKey="revenue" 
                  type="monotone" 
                  fill="url(#fillRevenue)" 
                  stroke="#2EAFC5"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ fill: "#2EAFC5", stroke: "white", strokeWidth: 2, r: 5 }}
                />
              )}
              {showProfit && (
                <Area 
                  dataKey="profit" 
                  type="monotone" 
                  fill="url(#fillProfit)" 
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ fill: "#10B981", stroke: "white", strokeWidth: 2, r: 5 }}
                />
              )}
              {showCost && (
                <Area 
                  dataKey="cost" 
                  type="monotone" 
                  fill="url(#fillCost)" 
                  stroke="#F1782F"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ fill: "#F1782F", stroke: "white", strokeWidth: 2, r: 5 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

        {/* Active Orders Card - 50% width */}
        <ActiveOrdersCard 
          incomingOrders={incomingOrders} 
          className="h-[320px]"
        />
      </div>

      {/* Operational Row: Cash Register + Inventory Health + Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cash Register Card */}
        <CashRegisterCard 
          data={cashRegisterData ?? defaultCashRegister}
          className="lg:col-span-1"
        />

        {/* Inventory Health Card */}
        <InventoryHealthCard 
          data={inventoryHealthData ?? defaultInventoryHealth}
          className="lg:col-span-1"
        />

        {/* Live Feed */}
        <div className="bg-card rounded-xl border flex flex-col lg:col-span-1">
          <div className="flex items-center gap-2 p-3 border-b">
            <IconBroadcast className="mt-0 size-5 text-[#AC0F16]" />
            <h3 className="font-medium text-sm mt-0 mb-0.75">Live Feed</h3>
            <span className="relative flex size-2 ml-auto">
              <span className="animate-ping absolute h-full w-full rounded-full bg-[#2EAFC5] opacity-75"></span>
              <span className="relative rounded-full size-2 bg-[#2EAFC5]"></span>
            </span>
          </div>
          <ScrollArea className="flex-1 h-[320px]">
            {recentSales.transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                <IconBroadcast className="size-6 mb-1 opacity-30" />
                <p className="text-xs">No recent activity</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {recentSales.transactions.slice(0, 8).map((tx) => {
                  // Smart content: Show item name for single-item sales
                  const isSingleItem = tx.items && tx.items.length === 1;
                  const itemContent = isSingleItem 
                    ? `${tx.items[0].quantity}× ${tx.items[0].product_name}`
                    : `${tx.itemsCount} item${tx.itemsCount !== 1 ? 's' : ''}`;
                  
                  return (
                    <TooltipProvider key={tx.transaction_id} delayDuration={200}>
                      <TooltipUI>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleTransactionClick(tx.receipt_no)}
                            className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                          >
                            {/* Left: Avatar + Sale Info */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="size-8 rounded-full bg-[#2EAFC5]/20 flex items-center justify-center flex-shrink-0">
                                <IconUser className="size-4 text-[#2EAFC5]" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground">Sale #{tx.receipt_no.slice(-4)}</p>
                                <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{itemContent}</p>
                              </div>
                            </div>
                            
                            {/* Right: Price + Time (stacked) */}
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                  +{formatCurrency(tx.total_amount)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{formatTime(tx.created_at)}</p>
                              </div>
                              <IconArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        </TooltipTrigger>
                        {/* Tooltip showing all items */}
                        {tx.items && tx.items.length > 1 && (
                          <TooltipContent side="left" className="text-xs max-w-[200px]">
                            <p className="font-medium mb-1">Items in this sale:</p>
                            <ul className="space-y-0.5">
                              {tx.items.slice(0, 5).map((item, idx) => (
                                <li key={idx} className="text-muted-foreground">
                                  {item.quantity}× {item.product_name}
                                </li>
                              ))}
                              {tx.items.length > 5 && (
                                <li className="text-muted-foreground/70">+{tx.items.length - 5} more...</li>
                              )}
                            </ul>
                          </TooltipContent>
                        )}
                      </TooltipUI>
                    </TooltipProvider>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          <div className="flex items-center justify-center p-2 border-t">
            <p className="text-[10px] text-muted-foreground">{formatDateLong(new Date())}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
