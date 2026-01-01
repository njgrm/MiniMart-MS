"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DateRange } from "react-day-picker";
import { subDays, subMonths, startOfMonth, endOfMonth, startOfYear, format } from "date-fns";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconReceipt,
  IconPackage,
  IconChartBar,
  IconClock,
  IconArrowRight,
  IconUser,
  IconCash,
  IconWallet,
  IconShoppingCart,
  IconCurrencyPeso,
  IconBroadcast,
  IconPrinter,
  IconRefresh,
  IconTrophy,
  IconCategory,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { getSalesStatsByDateRange, getTopProductsByDateRange } from "@/actions/sales";
import type { SalesHistoryResult, TopProductWithCategory } from "@/actions/sales";
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

interface TopProduct {
  product_id: number;
  product_name: string;
  quantity_sold: number;
  revenue: number;
}

interface DashboardClientProps {
  stats: SalesStats;
  recentSales: SalesHistoryResult;
  inventoryMetrics: InventoryMetrics;
  topProducts?: TopProduct[];
  incomingOrders?: GroupedOrders;
  recentCompletedOrders?: IncomingOrder[];
  activeOrdersCount?: number;
}

// Chart colors palette
const CHART_COLORS = ["#AC0F16", "#2EAFC5", "#F1782F", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#6366F1"];

// Category display names mapping
const CATEGORY_LABELS: Record<string, string> = {
  "SOFTDRINKS_CASE": "Soft Drinks Case",
  "SODA": "Soft Drinks",
  "SNACK": "Snack",
  "CANNED_GOODS": "Canned Goods",
  "BEVERAGES": "Beverages",
  "DAIRY": "Dairy",
  "BREAD": "Bread",
  "INSTANT_NOODLES": "Instant Noodles",
  "CONDIMENTS": "Condiments",
  "PERSONAL_CARE": "Personal Care",
  "HOUSEHOLD": "Household",
  "OTHER": "Other",
};

// Get category display name
const getCategoryLabel = (category: string): string => {
  return CATEGORY_LABELS[category] || category;
};

export function DashboardClient({
  stats,
  recentSales,
  inventoryMetrics,
  topProducts = [],
  incomingOrders = { pending: [], preparing: [], ready: [] },
  recentCompletedOrders = [],
  activeOrdersCount = 0,
}: DashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Date range picker state - default to last 30 days
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 31),
    to: subDays(new Date(), 1),
  });
  
  // Custom stats from date range
  const [customStats, setCustomStats] = useState<{
    current: { count: number; revenue: number; cost: number; profit: number };
    previous: { count: number; revenue: number; cost: number; profit: number };
    periodDays: number;
  } | null>(null);
  
  // Top products state for the ranking card
  const [topProductsDateRange, setTopProductsDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 31),
    to: subDays(new Date(), 1),
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [rankedProducts, setRankedProducts] = useState<TopProductWithCategory[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  
  // Selected preset for highlighting
  const [selectedPreset, setSelectedPreset] = useState<string>("Last 30 days");
  const [selectedTopProductsPreset, setSelectedTopProductsPreset] = useState<string>("Dec 2025");
  
  // Chart line toggles for Sales Overview
  const [showRevenue, setShowRevenue] = useState(true);
  const [showProfit, setShowProfit] = useState(true);
  const [showCost, setShowCost] = useState(false);
  
  // Quick date range presets
  const datePresets = [
    { label: "Last 7 days", getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: "Last 30 days", getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: "Last month", getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
    { label: "Dec 2025", getRange: () => ({ from: new Date(2025, 11, 1), to: new Date(2025, 11, 31) }) },
    { label: "Nov 2025", getRange: () => ({ from: new Date(2025, 10, 1), to: new Date(2025, 10, 30) }) },
    { label: "Year 2025", getRange: () => ({ from: startOfYear(new Date(2025, 0, 1)), to: new Date(2025, 11, 31) }) },
  ];
  
  // Fetch custom stats when date range changes
  useEffect(() => {
    if (customDateRange?.from && customDateRange?.to) {
      startTransition(async () => {
        const result = await getSalesStatsByDateRange(customDateRange.from!, customDateRange.to!);
        setCustomStats(result);
      });
    }
  }, [customDateRange]);

  // Fetch top products when date range or category changes
  useEffect(() => {
    if (topProductsDateRange?.from && topProductsDateRange?.to) {
      setIsLoadingProducts(true);
      getTopProductsByDateRange(
        topProductsDateRange.from,
        topProductsDateRange.to,
        selectedCategory === "all" ? undefined : selectedCategory,
        50 // Fetch more products for scrollable chart
      ).then((result) => {
        setRankedProducts(result.products);
        setCategories(result.categories);
        setIsLoadingProducts(false);
      });
    }
  }, [topProductsDateRange, selectedCategory]);

  // Display stats calculation
  const displayStats = customStats ? {
    primary: customStats.current,
    comparison: customStats.previous,
    periodLabel: customDateRange?.from && customDateRange?.to
      ? `${format(customDateRange.from, "MMM d")} - ${format(customDateRange.to, "MMM d, yyyy")}`
      : "Selected Period",
    periodDays: customStats.periodDays,
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

  // Custom tooltip for bar chart
  const ProductTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: TopProductWithCategory }> }) => {
    if (active && payload && payload.length) {
      const product = payload[0].payload;
      return (
        <div className="bg-card border border-border text-foreground px-3 py-2 rounded-lg shadow-xl max-w-[200px]">
          <p className="text-xs font-semibold text-foreground truncate">{product.product_name}</p>
          <p className="text-[10px] text-muted-foreground">{getCategoryLabel(product.category)}</p>
          <div className="flex items-center justify-between gap-3 mt-1">
            <span className="text-[10px] text-muted-foreground">{product.quantity_sold} sold</span>
            <span className="text-xs font-medium text-[#2EAFC5]">{formatCurrency(product.revenue)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Percentage badge component
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

  // Handle live feed item click - navigate to sales with drawer open
  const handleTransactionClick = (receiptNo: string) => {
    router.push(`/admin/sales?receipt=${receiptNo}&view=true`);
  };

  // Handle preset click for main date range
  const handlePresetClick = (preset: { label: string; getRange: () => DateRange }) => {
    setSelectedPreset(preset.label);
    setCustomDateRange(preset.getRange());
  };

  // Handle preset click for top products date range
  const handleTopProductsPresetClick = (preset: { label: string; getRange: () => DateRange }) => {
    setSelectedTopProductsPreset(preset.label);
    setTopProductsDateRange(preset.getRange());
  };

  // Calculate sidebar metrics
  const grossSales = displayStats.primary.revenue;

  // Calculate bar chart height based on number of products
  const barChartHeight = Math.max(300, rankedProducts.length * 40);

  // Generate chart data for Sales Overview based on selected date range
  const salesChartData = useMemo(() => {
    if (!customDateRange?.from || !customDateRange?.to) return [];
    
    const days: { date: string; fullDate: string; revenue: number; profit: number; cost: number }[] = [];
    const start = new Date(customDateRange.from);
    const end = new Date(customDateRange.to);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Group transactions by day
    for (let i = 0; i < diffDays; i++) {
      const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = format(date, "yyyy-MM-dd");
      
      const dayTransactions = recentSales.transactions.filter((tx) => {
        const txDate = new Date(tx.created_at);
        return (
          txDate.getDate() === date.getDate() &&
          txDate.getMonth() === date.getMonth() &&
          txDate.getFullYear() === date.getFullYear()
        );
      });

      const revenue = dayTransactions.reduce((sum, tx) => sum + tx.total_amount, 0);
      const cost = dayTransactions.reduce((sum, tx) => {
        return sum + tx.items.reduce((itemSum, item) => itemSum + (item.cost_at_sale * item.quantity), 0);
      }, 0);
      const profit = revenue - cost;
      
      // Format date label based on range length
      const dateLabel = diffDays > 60 
        ? format(date, "MMM") 
        : diffDays > 14 
          ? format(date, "d") 
          : format(date, "MMM d");
      
      days.push({ 
        date: dateLabel, 
        fullDate: format(date, "EEE, MMM d, yyyy"),
        revenue,
        profit,
        cost,
      });
    }
    return days;
  }, [customDateRange, recentSales.transactions]);

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

  return (
    <div className="flex flex-col gap-4 pb-6 relative">
      {/* Combined Header Row: Date Picker + Presets + Period Label */}
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
        
        {/* Separator */}
        <div className="h-6 w-px bg-border hidden lg:block" />
        
        {/* Period Label */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{displayStats.periodLabel}</span>
          {customStats && (
            <span className="text-xs text-muted-foreground">
              ({displayStats.periodDays} days • vs prev {displayStats.periodDays} days)
            </span>
          )}
        </div>
        
        {/* Loading indicator */}
        {isPending && (
          <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
            <IconRefresh className="size-3.5 animate-spin" />
            <span className="text-xs">Loading...</span>
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
            <PercentBadge value={percentages.profit} />
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">{formatNumber(displayStats.primary.profit)}</p>
          <p className="text-[10px] text-muted-foreground">Profit</p>
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
            <PercentBadge value={percentages.revenue} />
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">{formatNumber(displayStats.primary.revenue)}</p>
          <p className="text-[10px] text-muted-foreground">Sales Revenue</p>
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
            <PercentBadge value={percentages.cost} inverted />
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">{formatNumber(displayStats.primary.cost)}</p>
          <p className="text-[10px] text-muted-foreground">Cost of Goods</p>
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
            <PercentBadge value={percentages.transactions} />
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">{displayStats.primary.count}</p>
          <p className="text-[10px] text-muted-foreground">Transactions</p>
        </div>
      </div>

      {/* Sales Overview Chart */}
      <div className="bg-card rounded-xl border p-4">
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
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ fill: "#2EAFC5", stroke: "white", strokeWidth: 2, r: 4 }}
                />
              )}
              {showProfit && (
                <Area 
                  dataKey="profit" 
                  type="monotone" 
                  fill="url(#fillProfit)" 
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ fill: "#10B981", stroke: "white", strokeWidth: 2, r: 4 }}
                />
              )}
              {showCost && (
                <Area 
                  dataKey="cost" 
                  type="monotone" 
                  fill="url(#fillCost)" 
                  stroke="#F1782F"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ fill: "#F1782F", stroke: "white", strokeWidth: 2, r: 4 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main Content: Sidebar + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Top Products Ranking Card - Takes 3 columns */}
        <div className="lg:col-span-3 bg-card rounded-xl border flex flex-col">
          {/* Header with filters */}
          <div className="flex flex-wrap items-center gap-2 p-3 border-b">
            <IconTrophy className="size-4 text-[#F1782F]" />
            <h3 className="font-medium text-sm">Top Selling Products</h3>
            
            {/* Category Filter - Shadcn Select */}
            <div className="flex items-center gap-2 ml-auto">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="SOFTDRINKS_CASE">Soft Drinks Case</SelectItem>
                  <SelectItem value="SODA">Soft Drinks</SelectItem>
                  <SelectItem value="SNACK">Snack</SelectItem>
                  <SelectItem value="CANNED_GOODS">Canned Goods</SelectItem>
                  <SelectItem value="BEVERAGES">Beverages</SelectItem>
                  <SelectItem value="DAIRY">Dairy</SelectItem>
                  <SelectItem value="BREAD">Bread</SelectItem>
                  <SelectItem value="INSTANT_NOODLES">Instant Noodles</SelectItem>
                  <SelectItem value="CONDIMENTS">Condiments</SelectItem>
                  <SelectItem value="PERSONAL_CARE">Personal Care</SelectItem>
                  <SelectItem value="HOUSEHOLD">Household</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Date Range Picker for this card */}
              <DateRangePicker 
                date={topProductsDateRange} 
                onDateChange={(range) => {
                  setTopProductsDateRange(range);
                  setSelectedTopProductsPreset(""); // Clear preset selection when manually picking
                }}
              />
            </div>
            
            {isLoadingProducts && (
              <IconRefresh className="size-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          
          {/* Date Presets Row - Clickable badges */}
          <div className="flex items-center gap-1 flex-wrap px-3 py-2 border-b bg-muted/30">
            {datePresets.map((preset) => (
              <button
                key={`top-${preset.label}`}
                className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors font-medium ${
                  selectedTopProductsPreset === preset.label
                    ? "bg-[#AC0F16] text-white border-[#AC0F16]"
                    : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => handleTopProductsPresetClick(preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          
          {/* Chart + Ranking Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-3 flex-1">
            {/* Scrollable Bar Chart */}
            <ScrollArea className="h-[480px]">
              <div style={{ height: barChartHeight, minHeight: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={rankedProducts} 
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="stroke-border" />
                    <XAxis 
                      type="number" 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fontSize: 10 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis 
                      type="category" 
                      dataKey="product_name" 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fontSize: 10 }}
                      width={100}
                      className="fill-muted-foreground"
                      tickFormatter={(value) => value.length > 15 ? value.slice(0, 15) + "..." : value}
                    />
                    <Tooltip content={<ProductTooltip />} />
                    <Bar dataKey="quantity_sold" radius={[0, 4, 4, 0]}>
                      {rankedProducts.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ScrollArea>
            
            {/* Ranking List */}
            <ScrollArea className="h-[480px]">
              <div className="space-y-2 pr-2">
                {rankedProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                    <IconCategory className="size-8 mb-2 opacity-30" />
                    <p className="text-xs">No sales data for this period</p>
                  </div>
                ) : (
                  rankedProducts.map((product, index) => (
                    <div 
                      key={product.product_id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      {/* Rank Badge */}
                      <div 
                        className="size-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      >
                        {index + 1}
                      </div>
                      
                      {/* Product Image */}
                      <div className="size-10 rounded-lg overflow-hidden bg-muted shrink-0">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.product_name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="size-full flex items-center justify-center">
                            <IconPackage className="size-5 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                      
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate text-foreground">{product.product_name}</p>
                        <p className="text-[10px] text-muted-foreground">{getCategoryLabel(product.category)}</p>
                        {/* Stock indicator */}
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                            product.current_stock === 0 
                              ? "bg-destructive/20 text-destructive" 
                              : product.current_stock <= 10 
                                ? "bg-[#F1782F]/20 text-[#F1782F]" 
                                : "bg-[#2EAFC5]/20 text-[#2EAFC5]"
                          }`}>
                            {product.current_stock} in stock
                          </span>
                        </div>
                      </div>
                      
                      {/* Stats */}
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold tabular-nums text-foreground">{product.quantity_sold} sold</p>
                        <p className="text-[10px] text-[#2EAFC5] tabular-nums">{formatCurrency(product.revenue)}</p>
                        <p className={`text-[10px] tabular-nums ${product.profit >= 0 ? "text-[#10B981]" : "text-destructive"}`}>
                          {product.profit >= 0 ? "+" : ""}{formatCurrency(product.profit)} profit
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
         {/* Left Column: Shift Summary + Live Feed */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Shift Summary */}
          <div className="bg-card rounded-xl border">
            <div className="flex items-center gap-2 p-3 border-b">
              <IconCash className="size-4 text-foreground" />
              <h3 className="font-medium text-sm">Shift Summary</h3>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between py-1.5 border-b border-dashed border-border">
                <span className="text-xs text-muted-foreground">Transactions</span>
                <span className="text-xs font-medium tabular-nums">{displayStats.primary.count}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-dashed border-border">
                <span className="text-xs text-muted-foreground">Total Revenue</span>
                <span className="text-xs font-bold tabular-nums text-[#2EAFC5]">{formatCurrency(displayStats.primary.revenue)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs font-medium text-foreground">Net Profit</span>
                <span className="text-xs font-bold tabular-nums text-[#AC0F16]">{formatCurrency(displayStats.primary.profit)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 border-t">
              <Button 
                size="sm" 
                className="flex-1 h-8 text-xs bg-[#2EAFC5] hover:bg-[#2EAFC5]/90 text-white"
                onClick={() => router.push("/admin/sales")}
              >
                <IconPrinter className="size-3.5 mr-1.5" />
                View Sales
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 h-8 text-xs"
                onClick={() => router.push("/admin/sales/financial")}
              >
                <IconChartBar className="size-3.5 mr-1.5" />
                Reports
              </Button>
            </div>
          </div>

          {/* Live Feed */}
          <div className="bg-card rounded-xl border flex-1">
            <div className="flex items-center gap-2 p-3 border-b">
              <IconBroadcast className="size-4 text-[#AC0F16]" />
              <h3 className="font-medium text-sm">Live Feed</h3>
              <span className="relative flex size-2 ml-auto">
                <span className="animate-ping absolute h-full w-full rounded-full bg-[#2EAFC5] opacity-75"></span>
                <span className="relative rounded-full size-2 bg-[#2EAFC5]"></span>
              </span>
            </div>
            <ScrollArea className="h-[180px]">
              {recentSales.transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <IconBroadcast className="size-6 mb-1 opacity-30" />
                  <p className="text-xs">No recent activity</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {recentSales.transactions.slice(0, 5).map((tx) => (
                    <button
                      key={tx.transaction_id}
                      onClick={() => handleTransactionClick(tx.receipt_no)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="size-7 rounded-full bg-[#2EAFC5]/20 flex items-center justify-center flex-shrink-0">
                        <IconUser className="size-3.5 text-[#2EAFC5]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium truncate text-foreground">Sale #{tx.receipt_no.slice(-4)}</p>
                          <span className="text-[10px] ml-2 text-muted-foreground">{formatTime(tx.created_at)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{tx.itemsCount} items • {formatCurrency(tx.total_amount)}</p>
                      </div>
                      <IconArrowRight className="size-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="flex items-center justify-center p-2 border-t">
              <p className="text-[10px] text-muted-foreground">{formatDateLong(new Date())}</p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div 
            className="bg-card rounded-xl border p-3 cursor-pointer hover:shadow-sm transition-all"
            onClick={() => router.push("/admin/orders")}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Active Orders</p>
                <p className="text-base font-bold tabular-nums text-foreground">{activeOrdersCount}</p>
              </div>
              {activeOrdersCount > 0 ? (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F1782F]/20 text-[#F1782F]">
                  {activeOrdersCount} pending
                </span>
              ) : (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#2EAFC5]/20 text-[#2EAFC5]">
                  All clear
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Button 
          variant="outline" 
          className="h-auto py-3 flex items-center justify-center gap-2 text-xs bg-card hover:bg-muted border-2 hover:border-[#AC0F16]/50"
          onClick={() => router.push("/admin/pos")}
        >
          <IconReceipt className="size-4 text-[#AC0F16]" />
          <span>New Sale</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-3 flex items-center justify-center gap-2 text-xs bg-card hover:bg-muted border-2 hover:border-[#F1782F]/50"
          onClick={() => router.push("/admin/inventory")}
        >
          <IconPackage className="size-4 text-[#F1782F]" />
          <span>Inventory</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-3 flex items-center justify-center gap-2 text-xs bg-card hover:bg-muted border-2 hover:border-[#2EAFC5]/50"
          onClick={() => router.push("/admin/orders")}
        >
          <IconClock className="size-4 text-[#2EAFC5]" />
          <span>Orders</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-3 flex items-center justify-center gap-2 text-xs bg-card hover:bg-muted border-2 hover:border-[#AC0F16]/50"
          onClick={() => router.push("/admin/sales/financial")}
        >
          <IconChartBar className="size-4 text-[#AC0F16]" />
          <span>Reports</span>
        </Button>
      </div>
    </div>
  );
}
