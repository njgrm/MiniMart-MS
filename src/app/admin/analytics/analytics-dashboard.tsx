"use client";

import React, { useState, useMemo, useEffect, useTransition } from "react";
import { DateRange } from "react-day-picker";
import { subDays, subMonths, startOfMonth, endOfMonth, format, addDays, startOfYear, endOfYear, subYears, startOfDay, endOfDay } from "date-fns";
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Sparkles,
  Calendar,
  ArrowRight,
  Search,
  X,
  ArrowUpDown,
  Filter,
  BarChart3,
  Banknote,
  TrendingDown,
  Receipt,
  PieChart,
  Clock,
  Zap,
} from "lucide-react";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconPackage,
  IconAlertTriangle,
  IconSparkles,
  IconChartBar,
  IconReceipt,
  IconRefresh,
} from "@tabler/icons-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { AIAssistant } from "@/components/ai-assistant";
import { InsightCardsGrid, IntelligenceFeed } from "@/components/sales/insight-cards";
import type { Insight } from "@/lib/insights";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  ReferenceLine,
} from "recharts";
import { 
  getDashboardChartDataByDateRange, 
  getTopMovers, 
  getPeakTrafficData, 
  getForecastData,
  getSmartInsights,
  getCategorySalesShare,
  type TopMoverResult,
  type HourlyTrafficResult,
  type ForecastDataPoint,
  type CategorySalesResult,
} from "./actions";
import type { AnalyticsData, ForecastTableItem, DashboardChartDataPoint } from "./actions";
import Link from "next/link";


// Chart colors - matching design system
const COLORS = {
  revenue: "#2EAFC5",    // Teal - Primary accent
  profit: "#10B981",     // Emerald/Green
  cost: "#F1782F",       // Orange - Secondary accent
  primary: "#AC0F16",    // Deep Red
  bar: "#8B5CF6",        // Purple for bars
  forecast: "#F59E0B",   // Amber for forecast line
  event: "#EC4899",      // Pink for event markers
};

interface SalesStats {
  today: { count: number; revenue: number; cost: number; profit: number };
  month: { count: number; revenue: number; cost: number; profit: number };
}

interface AnalyticsDashboardProps {
  data: AnalyticsData;
  financialStats?: SalesStats;
}

// Date range presets - Enhanced with more useful options
const datePresets = [
  { label: "Today", getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: "Yesterday", getRange: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { label: "Last 7 days", getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "Last 30 days", getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: "This Month", getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Last Month", getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: "Year 2026", getRange: () => ({ from: new Date(2026, 0, 1), to: new Date(2026, 11, 31) }) },
  { label: "Year 2025", getRange: () => ({ from: new Date(2025, 0, 1), to: new Date(2025, 11, 31) }) },
  { label: "Year 2024", getRange: () => ({ from: new Date(2024, 0, 1), to: new Date(2024, 11, 31) }) },
];

// Granularity type for financial chart
type ChartGranularity = "daily" | "weekly" | "monthly";

export function AnalyticsDashboard({ data, financialStats }: AnalyticsDashboardProps) {
  const [isPending, startTransition] = useTransition();
  
  // Date range state
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [selectedPreset, setSelectedPreset] = useState<string>("Last 30 days");
  
  // Metric toggle state
  const [activeMetric, setActiveMetric] = useState<"revenue" | "profit" | "cost">("revenue");
  
  // Compare toggle state
  const [showComparison, setShowComparison] = useState(false);
  
  // Chart data states
  const [chartData, setChartData] = useState<DashboardChartDataPoint[]>([]);
  const [previousChartData, setPreviousChartData] = useState<DashboardChartDataPoint[]>([]);
  const [topMovers, setTopMovers] = useState<TopMoverResult[]>([]);
  const [categoryData, setCategoryData] = useState<CategorySalesResult[]>([]);
  const [peakTraffic, setPeakTraffic] = useState<HourlyTrafficResult[]>([]);
  const [forecastData, setForecastData] = useState<ForecastDataPoint[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  
  // Tab state for Top Movers / Category Share
  const [productInsightsTab, setProductInsightsTab] = useState<"movers" | "category">("movers");
  
  // Financial chart granularity state
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>("daily");
  
  // Selected product for context-aware forecast
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null);
  
  // Auto-set granularity based on date range
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      const diffDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 90) {
        setChartGranularity("monthly");
      } else if (diffDays > 30) {
        setChartGranularity("weekly");
      } else {
        setChartGranularity("daily");
      }
    }
  }, [dateRange]);
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate profit margin
  const calculateMargin = (profit: number, revenue: number) => {
    if (revenue === 0) return "0.0";
    return ((profit / revenue) * 100).toFixed(1);
  };

  // Fetch chart data when date range changes
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      startTransition(async () => {
        // Fetch current period data
        const currentData = await getDashboardChartDataByDateRange(dateRange.from!, dateRange.to!);
        setChartData(currentData);
        
        // Fetch previous period data for comparison
        const periodLength = dateRange.to!.getTime() - dateRange.from!.getTime();
        const prevEnd = new Date(dateRange.from!.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - periodLength);
        const prevData = await getDashboardChartDataByDateRange(prevStart, prevEnd);
        setPreviousChartData(prevData);
        
        // Fetch top movers
        const movers = await getTopMovers(dateRange.from!, dateRange.to!);
        setTopMovers(movers);
        
        // Fetch category sales share
        const categories = await getCategorySalesShare(dateRange.from!, dateRange.to!);
        setCategoryData(categories);
        
        // Fetch peak traffic
        const traffic = await getPeakTrafficData(dateRange.from!, dateRange.to!);
        setPeakTraffic(traffic);
        
        // Fetch forecast data
        const forecast = await getForecastData();
        setForecastData(forecast);
        
        // Fetch smart insights
        const smartInsights = await getSmartInsights();
        setInsights(smartInsights);
      });
    }
  }, [dateRange]);

  // Handle preset click
  const handlePresetClick = (preset: { label: string; getRange: () => DateRange }) => {
    setSelectedPreset(preset.label);
    setDateRange(preset.getRange());
  };

  // Merge current and previous data for comparison chart
  const comparisonChartData = useMemo(() => {
    if (!showComparison) return chartData;
    
    return chartData.map((current, index) => {
      const previous = previousChartData[index];
      return {
        ...current,
        prevRevenue: previous?.revenue ?? 0,
        prevProfit: previous?.profit ?? 0,
        prevCost: previous?.cost ?? 0,
      };
    });
  }, [chartData, previousChartData, showComparison]);

  // Group chart data by granularity
  const groupedChartData = useMemo(() => {
    if (chartGranularity === "daily") return comparisonChartData;
    
    const grouped = new Map<string, DashboardChartDataPoint>();
    
    comparisonChartData.forEach((point) => {
      // Parse the date from the data point
      const dateStr = point.fullDate || point.date;
      let groupKey: string;
      let groupLabel: string;
      
      // Try to extract week or month grouping
      if (chartGranularity === "weekly") {
        // Group by week - use week number
        const weekNum = Math.ceil(comparisonChartData.indexOf(point) / 7) + 1;
        groupKey = `Week ${weekNum}`;
        groupLabel = `Week ${weekNum}`;
      } else {
        // Group by month - extract from fullDate
        const monthMatch = dateStr.match(/([A-Za-z]+)\s+(\d{4})/);
        if (monthMatch) {
          groupKey = `${monthMatch[1]} ${monthMatch[2]}`;
          groupLabel = monthMatch[1].slice(0, 3);
        } else {
          groupKey = point.date;
          groupLabel = point.date;
        }
      }
      
      const existing = grouped.get(groupKey);
      if (existing) {
        existing.revenue += point.revenue;
        existing.profit += point.profit;
        existing.cost += point.cost;
        if ('prevRevenue' in point) {
          (existing as any).prevRevenue = ((existing as any).prevRevenue || 0) + ((point as any).prevRevenue || 0);
          (existing as any).prevProfit = ((existing as any).prevProfit || 0) + ((point as any).prevProfit || 0);
          (existing as any).prevCost = ((existing as any).prevCost || 0) + ((point as any).prevCost || 0);
        }
      } else {
        grouped.set(groupKey, {
          ...point,
          date: groupLabel,
          fullDate: groupKey,
        });
      }
    });
    
    return Array.from(grouped.values());
  }, [comparisonChartData, chartGranularity]);

  // Pie chart data for cost breakdown
  const costBreakdownData = financialStats ? [
    { name: "Profit", value: Math.max(0, financialStats.month.profit), color: COLORS.profit },
    { name: "COGS", value: financialStats.month.cost, color: COLORS.cost },
  ] : [];

  // Custom tooltip for financial chart
  const FinancialTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const current = payload.find((p: any) => p.dataKey === activeMetric);
      const previous = payload.find((p: any) => p.dataKey === `prev${activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)}`);
      
      const currentValue = current?.value ?? 0;
      const previousValue = previous?.value ?? 0;
      const percentChange = previousValue > 0 
        ? ((currentValue - previousValue) / previousValue * 100).toFixed(1) 
        : null;
      const isPositive = currentValue >= previousValue;
      
      return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-xs text-muted-foreground mb-1">{payload[0]?.payload?.fullDate || label}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full" style={{ backgroundColor: COLORS[activeMetric] }} />
              <span className="text-sm font-medium tabular-nums">{formatCurrency(currentValue)}</span>
            </div>
            {showComparison && previous && percentChange && (
              <>
                <div className="flex items-center gap-2 opacity-60">
                  <div className="size-2 rounded-full" style={{ backgroundColor: COLORS[activeMetric] }} />
                  <span className="text-sm tabular-nums">vs {formatCurrency(previousValue)}</span>
                </div>
                <div className={`text-xs font-medium ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                  {isPositive ? "↑" : "↓"} {percentChange}%
                </div>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for top movers
  const TopMoversTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const product = payload[0]?.payload;
      return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-xs font-medium text-foreground truncate max-w-[180px]">{product?.product_name}</p>
          <p className="text-[10px] text-muted-foreground capitalize">{product?.category?.toLowerCase().replace(/_/g, " ")}</p>
          <div className="flex items-center justify-between gap-4 mt-1">
            <span className="text-xs text-muted-foreground">Sales Velocity:</span>
            <span className="text-xs font-medium">{product?.velocity?.toFixed(1)}/day</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Current Stock:</span>
            <span className={`text-xs font-medium ${product?.current_stock < 10 ? "text-orange-500" : "text-emerald-500"}`}>
              {product?.current_stock}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for peak traffic
  const PeakTrafficTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-xs font-medium text-foreground">{data?.hour}</p>
          <div className="flex items-center justify-between gap-4 mt-1">
            <span className="text-xs text-muted-foreground">Transactions:</span>
            <span className="text-xs font-medium">{data?.transactions}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Revenue:</span>
            <span className="text-xs font-medium">{formatCurrency(data?.revenue ?? 0)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for forecast
  const ForecastTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-xs font-medium text-foreground">{data?.date}</p>
          {data?.isEvent && (
            <Badge variant="outline" className="text-[10px] mt-1 border-pink-500 text-pink-500">
              {data?.eventName || "Event Day"}
            </Badge>
          )}
          <div className="mt-1 space-y-1">
            {data?.historical !== null && (
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-[#8B5CF6]" />
                <span className="text-xs">Historical: {formatCurrency(data.historical)}</span>
              </div>
            )}
            {data?.forecast !== null && (
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-[#F59E0B]" />
                <span className="text-xs">Forecast: {formatCurrency(data.forecast)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <TooltipProvider>
      {/* Full-height container that breaks out of parent padding for sticky header */}
      <div className="flex flex-col h-full -m-4 md:-m-6">
        {/* ============================================================= */}
        {/* Sticky Control Bar - Flush to top, outside padding */}
        {/* ============================================================= */}
        <div className="sticky top-[-10%] z-20 bg-card border-b px-4 md:px-6 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Date Range Picker & Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <DateRangePicker
                date={dateRange}
                onDateChange={(range) => {
                  setDateRange(range);
                  setSelectedPreset("");
                }}
              />
              <div className="hidden sm:flex items-center gap-1">
                {datePresets.slice(0, 3).map((preset) => (
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
              {isPending && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <IconRefresh className="size-3.5 animate-spin" />
                  <span className="text-xs">Loading...</span>
                </div>
              )}
            </div>
            
            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <Link href="/admin/analytics/events">
                <Button variant="outline" size="sm" className="gap-2 h-9">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Manage Events</span>
                </Button>
              </Link>
              <Button variant="outline" size="sm" className="gap-2 h-9">
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* Scrollable Content Area - Restored padding */}
        {/* ============================================================= */}
        <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left: Financial Performance Chart (3 columns) */}
          <Card className="shadow-sm lg:col-span-3">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-[#2EAFC5]" />
                    Financial Performance
                  </CardTitle>
                  <CardDescription>
                    {selectedPreset || "Custom date range"} • {groupedChartData.length} data points ({chartGranularity})
                  </CardDescription>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Granularity Toggle */}
                  <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
                    {(["daily", "weekly", "monthly"] as const).map((granularity) => (
                      <button
                        key={granularity}
                        onClick={() => setChartGranularity(granularity)}
                        className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${
                          chartGranularity === granularity
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {granularity.charAt(0).toUpperCase() + granularity.slice(1)}
                      </button>
                    ))}
                  </div>
                  
                  {/* Metric Toggles */}
                  <div className="flex items-center gap-1">
                    {(["revenue", "profit", "cost"] as const).map((metric) => (
                      <button
                        key={metric}
                        onClick={() => setActiveMetric(metric)}
                        className={`text-[10px] px-3 py-1.5 rounded-full border transition-colors font-medium flex items-center gap-1.5 ${
                          activeMetric === metric
                            ? `text-white border-transparent`
                            : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                        style={{
                          backgroundColor: activeMetric === metric ? COLORS[metric] : undefined,
                        }}
                      >
                        <div 
                          className="size-2 rounded-full" 
                          style={{ backgroundColor: activeMetric === metric ? "white" : COLORS[metric] }} 
                        />
                        {metric.charAt(0).toUpperCase() + metric.slice(1)}
                      </button>
                    ))}
                  </div>
                  
                  {/* Compare Toggle */}
                  <div className="flex items-center gap-2">
                    <Switch
                      id="compare-toggle"
                      checked={showComparison}
                      onCheckedChange={setShowComparison}
                    />
                    <Label htmlFor="compare-toggle" className="text-xs text-muted-foreground cursor-pointer">
                      Compare
                    </Label>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={groupedChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id={`fill-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[activeMetric]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS[activeMetric]} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} className="stroke-border/50" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      className="text-xs fill-muted-foreground"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      className="text-xs fill-muted-foreground"
                      tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip content={<FinancialTooltip />} />
                    
                    {/* Previous period (dashed, lighter) */}
                    {showComparison && (
                      <Area
                        dataKey={`prev${activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)}`}
                        type="monotone"
                        stroke={COLORS[activeMetric]}
                        strokeWidth={1.5}
                        strokeDasharray="5 5"
                        strokeOpacity={0.4}
                        fill="none"
                      />
                    )}
                    
                    {/* Current period (solid) */}
                    <Area
                      dataKey={activeMetric}
                      type="monotone"
                      stroke={COLORS[activeMetric]}
                      strokeWidth={2.5}
                      fill={`url(#fill-${activeMetric})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          {/* Right: Intelligence Feed Sidebar (1 column) */}
          <IntelligenceFeed 
            insights={insights} 
            className="lg:col-span-1" 
            maxHeight="h-[465px]"
          />
        </div>
        {financialStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Revenue Sparkline Card */}
            <div className="bg-card rounded-xl border px-4 py-3 hover:shadow-md transition-all hover:border-emerald-500/30 group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-emerald-500/15 flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
                    <Banknote className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Revenue</p>
                    <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(financialStats.month.revenue)}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30">
                  <TrendingUp className="size-3 mr-1" />
                  {financialStats.month.count}
                </Badge>
              </div>
              {/* Mini Sparkline Area */}
              <div className="h-8 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.slice(-7)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sparkRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={1.5} fill="url(#sparkRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Profit Sparkline Card */}
            <div className="bg-card rounded-xl border px-4 py-3 hover:shadow-md transition-all hover:border-indigo-500/30 group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-indigo-500/15 flex items-center justify-center group-hover:bg-indigo-500/25 transition-colors">
                    <TrendingUp className="size-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Profit</p>
                    <p className="text-lg font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(financialStats.month.profit)}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30">
                  {calculateMargin(financialStats.month.profit, financialStats.month.revenue)}%
                </Badge>
              </div>
              <div className="h-8 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.slice(-7)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sparkProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={1.5} fill="url(#sparkProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Margin Card */}
            <div className="bg-card rounded-xl border px-4 py-3 hover:shadow-md transition-all hover:border-amber-500/30 group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-amber-500/15 flex items-center justify-center group-hover:bg-amber-500/25 transition-colors">
                    <PieChart className="size-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Margin</p>
                    <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      {calculateMargin(financialStats.month.profit, financialStats.month.revenue)}%
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-50/50 dark:bg-amber-950/30">
                  Gross
                </Badge>
              </div>
              {/* Mini Pie representation */}
              <div className="h-8 flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all" 
                    style={{ width: `${calculateMargin(financialStats.month.profit, financialStats.month.revenue)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ₱{formatCurrency(financialStats.month.cost).replace('₱', '')} COGS
                </span>
              </div>
            </div>

            {/* Transactions Card */}
            <div className="bg-card rounded-xl border px-4 py-3 hover:shadow-md transition-all hover:border-cyan-500/30 group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-cyan-500/15 flex items-center justify-center group-hover:bg-cyan-500/25 transition-colors">
                    <Receipt className="size-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Transactions</p>
                    <p className="text-lg font-bold tabular-nums text-cyan-600 dark:text-cyan-400">
                      {financialStats.month.count.toLocaleString()}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-600 bg-cyan-50/50 dark:bg-cyan-950/30">
                  +{financialStats.today.count} today
                </Badge>
              </div>
              <div className="h-8 flex items-center">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-muted-foreground">Avg:</span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(financialStats.month.count > 0 ? financialStats.month.revenue / financialStats.month.count : 0)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">/sale</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* Row 3: Product Insights (Tabbed) + Peak Traffic */}
        {/* ============================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Product Insights - Tabbed Card (Top Movers + Category Share) */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-foreground flex items-center gap-2 text-base">
                    <Zap className="h-4 w-4 text-[#F59E0B]" />
                    Product Insights
                  </CardTitle>
                  <CardDescription>
                    {productInsightsTab === "movers" ? "Top products by sales velocity" : "Revenue distribution by category"}
                  </CardDescription>
                </div>
                {/* Tab Toggles */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                  <button
                    onClick={() => setProductInsightsTab("movers")}
                    className={`text-[10px] px-2.5 py-1.5 rounded-md transition-colors font-medium ${
                      productInsightsTab === "movers"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Top Movers
                  </button>
                  <button
                    onClick={() => setProductInsightsTab("category")}
                    className={`text-[10px] px-2.5 py-1.5 rounded-md transition-colors font-medium ${
                      productInsightsTab === "category"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Category Share
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {productInsightsTab === "movers" ? (
                /* Top Movers List */
                <ScrollArea className="h-[280px]">
                  {topMovers.length > 0 ? (
                    <div className="space-y-2 pr-2">
                      {topMovers.slice(0, 8).map((product, index) => {
                        const rankColors = ["#AC0F16", "#2EAFC5", "#F1782F", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#6366F1"];
                        const color = rankColors[index % rankColors.length];
                        const maxVelocity = Math.max(...topMovers.map(p => p.velocity));
                        const barWidth = (product.velocity / maxVelocity) * 100;
                        
                        return (
                          <div 
                            key={product.product_id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            {/* Rank Badge */}
                            <div 
                              className="size-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{ backgroundColor: color }}
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
                                  <Package className="size-5 text-muted-foreground/50" />
                                </div>
                              )}
                            </div>
                            
                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate text-foreground">{product.product_name}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{product.category.toLowerCase().replace(/_/g, " ")}</p>
                              {/* Velocity Bar */}
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full transition-all" 
                                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Stats */}
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold tabular-nums" style={{ color }}>{product.velocity}/day</p>
                              <p className="text-[10px] text-muted-foreground tabular-nums">{product.total_sold} sold</p>
                              {/* Stock Badge */}
                              <span className={`text-[9px] px-1.5 py-0.5 rounded inline-block mt-0.5 ${
                                product.current_stock === 0 
                                  ? "bg-destructive/20 text-destructive" 
                                  : product.current_stock <= 10 
                                    ? "bg-amber-500/20 text-amber-600" 
                                    : "bg-cyan-500/20 text-cyan-600"
                              }`}>
                                {product.current_stock} in stock
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No sales data for this period</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              ) : (
                /* Category Share Donut Chart */
                <div className="h-[280px]">
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={categoryData}
                          dataKey="revenue"
                          nameKey="label"
                          cx="50%"
                          cy="45%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                          labelLine={false}
                          label={({ label, percentage, cx, cy, midAngle, outerRadius }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = outerRadius + 20;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            
                            if (percentage < 5) return null; // Hide labels for small segments
                            
                            return (
                              <text
                                x={x}
                                y={y}
                                textAnchor={x > cx ? "start" : "end"}
                                dominantBaseline="central"
                                className="text-[10px] fill-muted-foreground"
                              >
                                {label} ({percentage}%)
                              </text>
                            );
                          }}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload as CategorySalesResult;
                              return (
                                <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
                                  <p className="text-xs font-medium text-foreground">{data.label}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatCurrency(data.revenue)} ({data.percentage}%)
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={50}
                          content={({ payload }) => (
                            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                              {payload?.slice(0, 6).map((entry: any, index: number) => (
                                <div key={index} className="flex items-center gap-1">
                                  <div 
                                    className="size-2 rounded-full" 
                                    style={{ backgroundColor: entry.color }} 
                                  />
                                  <span className="text-[10px] text-muted-foreground">
                                    {entry.value}
                                  </span>
                                </div>
                              ))}
                              {payload && payload.length > 6 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{payload.length - 6} more
                                </span>
                              )}
                            </div>
                          )}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No sales data for this period</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Peak Traffic Heatmap */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-foreground flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-[#2EAFC5]" />
                    Peak Traffic Heatmap
                  </CardTitle>
                  <CardDescription>Sales intensity by day of week and hour</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                {peakTraffic.some(p => p.transactions > 0) ? (
                  <PeakTrafficHeatmap data={peakTraffic} chartData={chartData} />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No transactions for this period</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ============================================================= */}
        {/* Row 3: Demand Forecast */}
        {/* ============================================================= */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#F59E0B]" />
                  {selectedProductName 
                    ? `Forecast: ${selectedProductName}` 
                    : "Demand Forecast (Next 7 Days)"}
                </CardTitle>
                <CardDescription>
                  {selectedProductName
                    ? "Click on another product in the table below, or click the same to deselect"
                    : "Historical sales vs AI-powered demand prediction • Click a product below for details"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedProductName && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSelectedProductId(null);
                      setSelectedProductName(null);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear Selection
                  </Button>
                )}
                <Link href="/admin/analytics/events">
                  <Button variant="outline" size="sm" className="gap-2 h-8">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Events</span>
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {forecastData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecastData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      {/* Gradient for confidence interval */}
                      <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} className="stroke-border/50" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      className="text-xs fill-muted-foreground"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      className="text-xs fill-muted-foreground"
                      tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip content={<ForecastTooltip />} />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(value) => (
                        <span className="text-xs text-muted-foreground capitalize">{value}</span>
                      )}
                    />
                    
                    {/* Event reference lines */}
                    {forecastData
                      .filter((d) => d.isEvent)
                      .map((d, i) => (
                        <ReferenceLine
                          key={i}
                          x={d.date}
                          stroke={COLORS.event}
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          label={{
                            value: "📅",
                            position: "top",
                            fontSize: 14,
                          }}
                        />
                      ))}
                    
                    {/* Confidence interval area (±15% of forecast) */}
                    <Area
                      dataKey="forecastUpper"
                      name="Confidence Band"
                      type="monotone"
                      fill="url(#confidenceGradient)"
                      stroke="none"
                      connectNulls={false}
                    />
                    
                    {/* Historical bars */}
                    <Bar
                      dataKey="historical"
                      name="Historical"
                      fill={COLORS.bar}
                      radius={[4, 4, 0, 0]}
                    />
                    
                    {/* Visual Bridge: Connect last historical point to first forecast */}
                    <Line
                      dataKey="bridge"
                      name="Bridge"
                      type="monotone"
                      stroke={COLORS.bar}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      legendType="none"
                      connectNulls
                    />
                    
                    {/* Forecast line */}
                    <Line
                      dataKey="forecast"
                      name="Forecast"
                      type="monotone"
                      stroke={COLORS.forecast}
                      strokeWidth={3}
                      dot={{ fill: COLORS.forecast, r: 4, strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 6, fill: COLORS.forecast, stroke: "#fff", strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Loading forecast data...</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ============================================================= */}
        {/* Row 4: Forecasting Table */}
        {/* ============================================================= */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Restock Recommendations
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  AI-powered restocking suggestions based on demand forecasting
                </CardDescription>
              </div>
              <Link href="/admin/inventory">
                <Button variant="outline" size="sm" className="gap-2">
                  View Inventory
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <ForecastingTable 
              forecasts={data.forecasts} 
              selectedProductId={selectedProductId}
              onProductSelect={(id, name) => {
                setSelectedProductId(id);
                setSelectedProductName(name);
              }}
            />
          </CardContent>
        </Card>

        </div>
      </div>
      
      {/* AI Assistant */}
      <AIAssistant />
    </TooltipProvider>
  );
}

// =============================================================================
// Peak Traffic Heatmap Component
// =============================================================================

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

function PeakTrafficHeatmap({ data, chartData }: { data: HourlyTrafficResult[]; chartData: DashboardChartDataPoint[] }) {
  // Generate heatmap data from hourly traffic
  // This creates a 7x12 grid (days x hours)
  const heatmapData = useMemo(() => {
    const grid: { day: string; hour: number; value: number; revenue: number }[][] = [];
    
    // Initialize grid
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      grid[dayIdx] = [];
      for (let hourIdx = 0; hourIdx < HOURS.length; hourIdx++) {
        grid[dayIdx][hourIdx] = {
          day: DAYS_OF_WEEK[dayIdx],
          hour: HOURS[hourIdx],
          value: 0,
          revenue: 0,
        };
      }
    }
    
    // Aggregate data - for now using hourly data distributed across days
    // In a real implementation, you'd have day-specific hourly data
    data.forEach((hourData, idx) => {
      const hour = parseInt(hourData.hour.split(":")[0]);
      if (hour >= 8 && hour <= 19) {
        const hourIdx = hour - 8;
        // Distribute across days with some variation
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
          const dayMultiplier = dayIdx >= 5 ? 1.3 : 1.0; // Weekend boost
          grid[dayIdx][hourIdx].value += Math.floor(hourData.transactions * dayMultiplier / 7);
          grid[dayIdx][hourIdx].revenue += hourData.revenue * dayMultiplier / 7;
        }
      }
    });
    
    return grid;
  }, [data]);

  // Find max value for color scaling
  const maxValue = useMemo(() => {
    let max = 0;
    heatmapData.forEach(row => {
      row.forEach(cell => {
        if (cell.value > max) max = cell.value;
      });
    });
    return max || 1;
  }, [heatmapData]);

  // Get color based on intensity
  const getColor = (value: number) => {
    const intensity = value / maxValue;
    if (intensity === 0) return "bg-muted/30";
    if (intensity < 0.25) return "bg-cyan-100 dark:bg-cyan-950/40";
    if (intensity < 0.5) return "bg-cyan-300 dark:bg-cyan-800/60";
    if (intensity < 0.75) return "bg-cyan-500 dark:bg-cyan-600";
    return "bg-cyan-600 dark:bg-cyan-500";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Hour labels */}
      <div className="flex mb-1">
        <div className="w-10" /> {/* Spacer for day labels */}
        {HOURS.map((hour) => (
          <div key={hour} className="flex-1 text-center">
            <span className="text-[9px] text-muted-foreground">
              {hour}:00
            </span>
          </div>
        ))}
      </div>
      
      {/* Heatmap grid */}
      <div className="flex-1 flex flex-col gap-1">
        {heatmapData.map((row, dayIdx) => (
          <div key={dayIdx} className="flex gap-1 flex-1">
            {/* Day label */}
            <div className="w-10 flex items-center justify-end pr-2">
              <span className="text-[10px] font-medium text-muted-foreground">
                {DAYS_OF_WEEK[dayIdx]}
              </span>
            </div>
            {/* Cells */}
            {row.map((cell, hourIdx) => (
              <Tooltip key={hourIdx}>
                <TooltipTrigger asChild>
                  <div
                    className={`flex-1 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-cyan-400/50 ${getColor(cell.value)}`}
                  />
                </TooltipTrigger>
                <TooltipContent 
                  side="top" 
                  className="bg-popover text-popover-foreground border shadow-lg p-2"
                >
                  <div className="font-medium text-xs text-foreground">
                    {cell.day} @ {cell.hour}:00
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <span className="text-[10px] text-muted-foreground">Transactions:</span>
                    <span className="text-xs font-semibold tabular-nums">{cell.value}</span>
                  </div>
                  {cell.revenue > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] text-muted-foreground">Revenue:</span>
                      <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        ₱{cell.revenue.toLocaleString("en-PH", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-border/50">
        <span className="text-[10px] text-muted-foreground">Low</span>
        <div className="flex gap-0.5">
          <div className="size-3 rounded-sm bg-muted/30" />
          <div className="size-3 rounded-sm bg-cyan-100 dark:bg-cyan-950/40" />
          <div className="size-3 rounded-sm bg-cyan-300 dark:bg-cyan-800/60" />
          <div className="size-3 rounded-sm bg-cyan-500 dark:bg-cyan-600" />
          <div className="size-3 rounded-sm bg-cyan-600 dark:bg-cyan-500" />
        </div>
        <span className="text-[10px] text-muted-foreground">High</span>
      </div>
    </div>
  );
}

// =============================================================================
// Forecasting Table Component with Filters & Sorting
// =============================================================================

type SortField = "product" | "stock" | "velocity" | "demand" | "urgency";
type SortOrder = "asc" | "desc";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "SOFTDRINKS_CASE", label: "Soft Drinks Case" },
  { value: "SODA", label: "Soft Drinks" },
  { value: "SNACK", label: "Snack" },
  { value: "CANNED_GOODS", label: "Canned Goods" },
  { value: "BEVERAGES", label: "Beverages" },
  { value: "DAIRY", label: "Dairy" },
  { value: "BREAD", label: "Bread" },
  { value: "INSTANT_NOODLES", label: "Instant Noodles" },
  { value: "CONDIMENTS", label: "Condiments" },
  { value: "PERSONAL_CARE", label: "Personal Care" },
  { value: "HOUSEHOLD", label: "Household" },
  { value: "OTHER", label: "Other" },
];

const URGENCY_OPTIONS = [
  { value: "all", label: "All Urgency" },
  { value: "critical", label: "Restock Immediately" },
  { value: "low", label: "Low Stock" },
  { value: "dead", label: "Dead Stock" },
  { value: "monitor", label: "Monitor" },
];

function getUrgencyLevel(item: ForecastTableItem): "critical" | "low" | "dead" | "monitor" {
  if (item.stockStatus === "DEAD_STOCK") {
    return "dead";
  }
  if (item.stockStatus === "OUT_OF_STOCK" || item.stockStatus === "CRITICAL") {
    // Only critical if there's actual velocity/demand
    if (item.velocity7Day > 0 || item.predictedDemand > 0) {
      return "critical";
    }
    return "dead"; // No demand, treat as dead
  }
  if (item.stockStatus === "LOW") {
    if (item.velocity7Day > 0) {
      return "low";
    }
    return "monitor";
  }
  return "monitor";
}

function getUrgencyPriority(item: ForecastTableItem): number {
  const urgency = getUrgencyLevel(item);
  switch (urgency) {
    case "critical": return 0;
    case "low": return 1;
    case "dead": return 2; // Dead stock is lower priority than actual restocking needs
    case "monitor": return 3;
    default: return 4;
  }
}

function ForecastingTable({ 
  forecasts,
  selectedProductId,
  onProductSelect
}: { 
  forecasts: ForecastTableItem[];
  selectedProductId?: number | null;
  onProductSelect?: (productId: number | null, productName: string | null) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("urgency");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const hasActiveFilters = searchQuery || categoryFilter !== "all" || urgencyFilter !== "all";

  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setUrgencyFilter("all");
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "urgency" ? "asc" : "desc");
    }
  };

  const filteredAndSortedForecasts = useMemo(() => {
    let result = [...forecasts];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.productName.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (categoryFilter !== "all") {
      result = result.filter((item) => item.category === categoryFilter);
    }

    // Apply urgency filter
    if (urgencyFilter !== "all") {
      result = result.filter((item) => getUrgencyLevel(item) === urgencyFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "product":
          comparison = a.productName.localeCompare(b.productName);
          break;
        case "stock":
          comparison = a.currentStock - b.currentStock;
          break;
        case "velocity":
          comparison = a.velocity7Day - b.velocity7Day;
          break;
        case "demand":
          comparison = a.predictedDemand - b.predictedDemand;
          break;
        case "urgency":
          comparison = getUrgencyPriority(a) - getUrgencyPriority(b);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [forecasts, searchQuery, categoryFilter, urgencyFilter, sortField, sortOrder]);

  if (forecasts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No restock recommendations at this time</p>
        <p className="text-sm">All products have adequate stock levels</p>
      </div>
    );
  }

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="-ml-3 h-8 uppercase text-[11px] font-semibold tracking-wider hover:bg-transparent"
    >
      {children}
      <ArrowUpDown className={`ml-1 h-3 w-3 ${sortField === field ? "text-primary" : "text-muted-foreground"}`} />
    </Button>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 w-full"
          />
        </div>

        {/* Category Filter */}
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-10 w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Urgency Filter */}
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="h-10 w-[160px]">
            <SelectValue placeholder="Urgency" />
          </SelectTrigger>
          <SelectContent>
            {URGENCY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={resetFilters}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Reset filters</span>
          </Button>
        )}

        {/* Separator */}
        <div className="h-8 w-px bg-border mx-1" />

        {/* Results Count */}
        <div className="flex items-center gap-2 h-10 px-3 rounded-md bg-muted/30 border border-border/40">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{filteredAndSortedForecasts.length}</span>
          <span className="text-xs text-muted-foreground">of {forecasts.length}</span>
        </div>
      </div>

      {/* Table with Scroll */}
      <div className="rounded-xl border border-border overflow-hidden">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 bg-muted/30">
                  <SortButton field="product">Product</SortButton>
                </TableHead>
                <TableHead className="h-10 bg-muted/30 text-right">
                  <SortButton field="stock">Stock</SortButton>
                </TableHead>
                <TableHead className="h-10 bg-muted/30 text-right">
                  <SortButton field="velocity">Velocity</SortButton>
                </TableHead>
                <TableHead className="h-10 bg-muted/30 text-right">
                  <SortButton field="demand"><span className="font-bold text-foreground">Demand</span></SortButton>
                </TableHead>
                <TableHead className="h-10 bg-muted/30">
                  <SortButton field="urgency">Action</SortButton>
                </TableHead>
                <TableHead className="h-10 bg-muted/30 text-foreground font-bold uppercase text-[11px] tracking-wider text-right">
                  Order Qty
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedForecasts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <p className="text-muted-foreground">No results found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedForecasts.map((item) => (
                  <TableRow 
                    key={item.productId}
                    onClick={() => onProductSelect?.(
                      selectedProductId === item.productId ? null : item.productId,
                      selectedProductId === item.productId ? null : item.productName
                    )}
                    className={`cursor-pointer transition-colors ${
                      selectedProductId === item.productId 
                        ? "bg-primary/10 hover:bg-primary/15 ring-1 ring-inset ring-primary/30" 
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <TableCell className="py-3">
                      <div>
                        <p className="font-medium text-foreground">{item.productName}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {item.category.toLowerCase().replace(/_/g, " ")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <StockBadge stock={item.currentStock} status={item.stockStatus} />
                    </TableCell>
                    <TableCell className="text-right font-mono py-3 text-foreground">
                      {item.velocity7Day}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold py-3 text-foreground">
                      {item.predictedDemand}
                    </TableCell>
                    <TableCell className="py-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className={`cursor-help text-xs font-medium ${
                              item.stockStatus === "OUT_OF_STOCK"
                                ? (item.velocity7Day > 0 || item.predictedDemand > 0)
                                  ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                  : "border-slate-400 bg-slate-50 text-slate-600 dark:bg-slate-950/30 dark:text-slate-400"
                                : item.stockStatus === "DEAD_STOCK"
                                ? "border-slate-400 bg-slate-50 text-slate-600 dark:bg-slate-950/30 dark:text-slate-400"
                                : item.stockStatus === "CRITICAL"
                                ? (item.velocity7Day > 0 || item.predictedDemand > 0)
                                  ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
                                  : "border-slate-400 bg-slate-50 text-slate-600 dark:bg-slate-950/30 dark:text-slate-400"
                                : item.stockStatus === "LOW"
                                ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                                : "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400"
                            }`}
                          >
                            {item.recommendedAction}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent 
                          side="top" 
                          className="max-w-xs p-3 bg-popover text-popover-foreground border shadow-lg"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-xs text-muted-foreground">Forecast Confidence:</span>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  item.confidence === "HIGH" 
                                    ? "border-green-500 text-green-600 bg-green-50 dark:bg-green-950/30" 
                                    : item.confidence === "MEDIUM"
                                    ? "border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30"
                                    : "border-red-500 text-red-600 bg-red-50 dark:bg-red-950/30"
                                }`}
                              >
                                {item.confidence}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {item.confidence === "LOW" 
                                ? "Limited sales history. Recommendation based on stock levels."
                                : item.velocity7Day > item.predictedDemand 
                                ? "Demand trending down from recent activity."
                                : "Demand trending up based on velocity analysis."}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold shadow-sm">
                        +{item.recommendedQty}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}

function StockBadge({ stock, status }: { stock: number; status: string }) {
  const getVariant = () => {
    switch (status) {
      case "OUT_OF_STOCK":
        return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400";
      case "CRITICAL":
        return "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400";
      case "LOW":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400";
      case "DEAD_STOCK":
        return "bg-slate-100 text-slate-600 dark:bg-slate-950/50 dark:text-slate-400";
      default:
        return "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400";
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-sm font-mono ${getVariant()}`}>
      {stock}
    </span>
  );
}
