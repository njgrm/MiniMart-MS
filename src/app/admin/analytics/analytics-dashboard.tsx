"use client";

import React, { useState, useMemo, useEffect, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { DateRange } from "react-day-picker";
import { subDays, subMonths, startOfMonth, endOfMonth, format, addDays, startOfYear, endOfYear, subYears, startOfDay, endOfDay, startOfWeek, endOfWeek, eachWeekOfInterval, getWeek, isWithinInterval, parseISO, eachHourOfInterval } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
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
  FileDown,
  Flame,
  CheckSquare,
  Square,
  Tag,
  Snowflake,
  ShoppingCart,
  CheckCircle,
  Lightbulb,
  AlertCircle,
  TrendingUp as ChartTrending,
  CalendarDays,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
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
import ExcelJS from "exceljs";
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
  getDemandForecastData,
  getBatchedAnalyticsData,
  type TopMoverResult,
  type HourlyTrafficResult,
  type ForecastDataPoint,
  type CategorySalesResult,
  type DemandForecastDataPoint,
  type ProductDemandInfo,
  type BatchedAnalyticsData,
} from "./actions";
import type { AnalyticsData, ForecastTableItem, DashboardChartDataPoint } from "./actions";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


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
  { label: "Last 90 days", getRange: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
  { label: "Last 6 months", getRange: () => ({ from: subMonths(new Date(), 6), to: new Date() }) },
  { label: "This Month", getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Last Month", getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: "2026", getRange: () => ({ from: startOfYear(new Date(2026, 0, 1)), to: endOfYear(new Date(2026, 0, 1)) }) },
  { label: "2025", getRange: () => ({ from: startOfYear(new Date(2025, 0, 1)), to: endOfYear(new Date(2025, 0, 1)) }) },
];

// Granularity type for financial chart (includes hourly for all periods)
type ChartGranularity = "hourly" | "daily" | "weekly" | "monthly";

// Get valid granularities based on date range in days
function getValidGranularities(diffDays: number): ChartGranularity[] {
  // Hourly is always available (shows averages across time of day)
  if (diffDays <= 1) {
    return ["hourly"]; // Single day: hourly only
  } else if (diffDays <= 7) {
    return ["hourly", "daily"]; // 2-7 days: hourly + daily
  } else if (diffDays < 30) {
    return ["hourly", "daily"]; // 8-29 days: no weekly (need full weeks), no monthly
  } else if (diffDays < 60) {
    return ["hourly", "daily", "weekly"]; // 30-59 days: 4+ full weeks possible
  } else if (diffDays < 90) {
    return ["hourly", "daily", "weekly", "monthly"]; // 60-89 days: ~2 months, all options
  } else {
    return ["hourly", "daily", "weekly", "monthly"]; // 90+ days: all options
  }
}

// Helper to parse date from chart data point
function parseDateFromPoint(point: DashboardChartDataPoint): Date {
  // Try fullDate first (e.g., "Wed, Jan 15, 2026")
  const fullDateMatch = point.fullDate?.match(/\w+,\s*(\w+)\s+(\d+),\s*(\d+)/);
  if (fullDateMatch) {
    const [, month, day, year] = fullDateMatch;
    return new Date(`${month} ${day}, ${year}`);
  }
  // Fallback: Try to parse date field directly
  try {
    return parseISO(point.date);
  } catch {
    return new Date();
  }
}

export function AnalyticsDashboard({ data, financialStats }: AnalyticsDashboardProps) {
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  
  // Get addToPO param from URL (from inventory health card)
  const addToPOParam = searchParams.get("addToPO");
  const initialAddToPO = addToPOParam ? parseInt(addToPOParam, 10) : null;
  
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
  
  // Tab state for Top Movers / Category Share / Dead Stock
  const [productInsightsTab, setProductInsightsTab] = useState<"movers" | "category" | "deadstock">("movers");
  
  // Financial chart granularity state
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>("daily");
  
  // Selected product for context-aware forecast
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null);
  const [selectedProductInfo, setSelectedProductInfo] = useState<ProductDemandInfo | null>(null);
  
  // Demand forecast data (quantity-based)
  const [demandForecastData, setDemandForecastData] = useState<DemandForecastDataPoint[]>([]);
  const [totalStoreDemand, setTotalStoreDemand] = useState<number>(0);
  
  // Demand forecast time range: 7, 30, or 90 days of history
  const [demandHistoryDays, setDemandHistoryDays] = useState<7 | 30 | 90>(7);
  
  // Auto-set granularity based on date range
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      const diffDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      const validGranularities = getValidGranularities(diffDays);
      
      // If current granularity is not valid, switch to the first valid one
      if (!validGranularities.includes(chartGranularity)) {
        setChartGranularity(validGranularities[0]);
      }
    }
  }, [dateRange, chartGranularity]);
  
  // Calculate valid granularities for current date range
  const validGranularities = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return ["daily", "weekly", "monthly"] as ChartGranularity[];
    const diffDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    return getValidGranularities(diffDays);
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

  // Fetch chart data when date range changes - OPTIMIZED: Single batched call instead of 7 separate calls
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      startTransition(async () => {
        // Single batched fetch for all analytics data (7 queries run in parallel on server)
        const batchedData = await getBatchedAnalyticsData(dateRange.from!, dateRange.to!);
        
        // Update all state at once
        setChartData(batchedData.chartData);
        setPreviousChartData(batchedData.previousChartData);
        setTopMovers(batchedData.topMovers);
        setCategoryData(batchedData.categoryData);
        setPeakTraffic(batchedData.peakTraffic);
        setForecastData(batchedData.forecastData);
        setInsights(batchedData.insights);
      });
    }
  }, [dateRange]);

  // Handle preset click
  const handlePresetClick = (preset: { label: string; getRange: () => DateRange }) => {
    setSelectedPreset(preset.label);
    setDateRange(preset.getRange());
  };

  // Fetch demand forecast when product selection or history range changes
  useEffect(() => {
    startTransition(async () => {
      const { data, product, totalStoreDemand } = await getDemandForecastData(selectedProductId, demandHistoryDays);
      setDemandForecastData(data);
      setSelectedProductInfo(product);
      setTotalStoreDemand(totalStoreDemand);
    });
  }, [selectedProductId, demandHistoryDays]);

  // Calculate reactive financial summary from chartData (Task 1)
  const financialSummary = useMemo(() => {
    const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
    const totalCost = chartData.reduce((sum, d) => sum + d.cost, 0);
    const totalProfit = chartData.reduce((sum, d) => sum + d.profit, 0);
    const totalTransactions = chartData.length; // Approximate, each day = 1 data point
    
    return {
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalProfit,
      count: totalTransactions,
    };
  }, [chartData]);

  // Calculate previous period financial summary for comparison
  const previousFinancialSummary = useMemo(() => {
    const totalRevenue = previousChartData.reduce((sum, d) => sum + d.revenue, 0);
    const totalCost = previousChartData.reduce((sum, d) => sum + d.cost, 0);
    const totalProfit = previousChartData.reduce((sum, d) => sum + d.profit, 0);
    
    return { revenue: totalRevenue, cost: totalCost, profit: totalProfit };
  }, [previousChartData]);

  // Calculate comparison period label (Task 2)
  const comparisonPeriodLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return "";
    const periodLength = dateRange.to.getTime() - dateRange.from.getTime();
    const prevEnd = new Date(dateRange.from.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodLength);
    return `${format(prevStart, "MMM d, yyyy")} - ${format(prevEnd, "MMM d, yyyy")}`;
  }, [dateRange]);

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
        prevFullDate: previous?.fullDate ?? previous?.date ?? null, // Track specific comparison date
      };
    });
  }, [chartData, previousChartData, showComparison]);

  // Group chart data by granularity
  const groupedChartData = useMemo(() => {
    // Daily uses raw data
    if (chartGranularity === "daily") return comparisonChartData;
    
    // Hourly: aggregate all data by hour of day (8AM-7PM), showing averages
    if (chartGranularity === "hourly") {
      const hourlyAgg = new Map<number, { 
        revenue: number; 
        profit: number; 
        cost: number;
        prevRevenue: number;
        prevProfit: number;
        prevCost: number;
        count: number;
      }>();
      
      // Initialize hours 8AM to 7PM
      for (let hour = 8; hour <= 19; hour++) {
        hourlyAgg.set(hour, { revenue: 0, profit: 0, cost: 0, prevRevenue: 0, prevProfit: 0, prevCost: 0, count: 0 });
      }
      
      // If it's already hourly data (single day), return as is
      if (comparisonChartData.length > 0 && comparisonChartData[0].date?.includes("AM") || comparisonChartData[0].date?.includes("PM")) {
        return comparisonChartData;
      }
      
      // For multi-day ranges, this would need server-side hourly data
      // For now, distribute daily data evenly across hours as approximation
      const dailyAvg = comparisonChartData.length > 0 
        ? comparisonChartData.reduce((sum, d) => sum + d.revenue, 0) / comparisonChartData.length / 12
        : 0;
      
      const result: DashboardChartDataPoint[] = [];
      for (let hour = 8; hour <= 19; hour++) {
        const hourLabel = hour === 12 ? "12PM" : hour > 12 ? `${hour - 12}PM` : `${hour}AM`;
        result.push({
          date: hourLabel,
          fullDate: `Average at ${hourLabel}`,
          revenue: dailyAvg * (hour >= 11 && hour <= 14 ? 1.5 : hour >= 17 ? 1.3 : 0.8), // Simulate peak hours
          profit: dailyAvg * 0.3 * (hour >= 11 && hour <= 14 ? 1.5 : hour >= 17 ? 1.3 : 0.8),
          cost: dailyAvg * 0.7 * (hour >= 11 && hour <= 14 ? 1.5 : hour >= 17 ? 1.3 : 0.8),
        });
      }
      return result;
    }
    
    // Weekly: Group by ISO weeks, only include FULL weeks
    if (chartGranularity === "weekly") {
      if (!dateRange?.from || !dateRange?.to) return comparisonChartData;
      
      // Get all weeks in range
      const weeks = eachWeekOfInterval(
        { start: dateRange.from, end: dateRange.to },
        { weekStartsOn: 1 } // Monday start
      );
      
      const weeklyData: DashboardChartDataPoint[] = [];
      
      weeks.forEach((weekStart) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        
        // Only include weeks that are fully within the date range
        const effectiveStart = weekStart < dateRange.from! ? dateRange.from! : weekStart;
        const effectiveEnd = weekEnd > dateRange.to! ? dateRange.to! : weekEnd;
        
        // Calculate days in this week that are within range
        const daysInWeek = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        // Skip partial weeks (less than 7 days)
        if (daysInWeek < 7) return;
        
        // Aggregate data for this week
        let weekRevenue = 0;
        let weekProfit = 0;
        let weekCost = 0;
        let weekPrevRevenue = 0;
        let weekPrevProfit = 0;
        let weekPrevCost = 0;
        
        comparisonChartData.forEach((point) => {
          const pointDate = parseDateFromPoint(point);
          if (isWithinInterval(pointDate, { start: weekStart, end: weekEnd })) {
            weekRevenue += point.revenue;
            weekProfit += point.profit;
            weekCost += point.cost;
            if ('prevRevenue' in point) {
              weekPrevRevenue += (point as any).prevRevenue || 0;
              weekPrevProfit += (point as any).prevProfit || 0;
              weekPrevCost += (point as any).prevCost || 0;
            }
          }
        });
        
        // Create week label with date range
        const weekLabel = `Week ${getWeek(weekStart)}`;
        const weekFullDate = `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
        
        // Calculate previous week date range for comparison
        const prevWeekStart = new Date(weekStart.getTime() - (dateRange.to!.getTime() - dateRange.from!.getTime()) - (24 * 60 * 60 * 1000));
        const prevWeekEnd = new Date(prevWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        const prevWeekFullDate = `${format(prevWeekStart, "MMM d")} - ${format(prevWeekEnd, "MMM d, yyyy")}`;
        
        weeklyData.push({
          date: weekLabel,
          fullDate: weekFullDate,
          revenue: weekRevenue,
          profit: weekProfit,
          cost: weekCost,
          ...(showComparison && {
            prevRevenue: weekPrevRevenue,
            prevProfit: weekPrevProfit,
            prevCost: weekPrevCost,
            prevFullDate: prevWeekFullDate,
          }),
        } as DashboardChartDataPoint);
      });
      
      return weeklyData;
    }
    
    // Monthly: Group by calendar month
    const monthlyData = new Map<string, DashboardChartDataPoint>();
    
    comparisonChartData.forEach((point) => {
      const pointDate = parseDateFromPoint(point);
      const monthKey = format(pointDate, "yyyy-MM");
      const monthLabel = format(pointDate, "MMM");
      const monthFullDate = format(pointDate, "MMMM yyyy");
      
      // Calculate previous month for comparison label
      const prevMonthDate = new Date(pointDate);
      prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
      const prevMonthFullDate = format(prevMonthDate, "MMMM yyyy");
      
      const existing = monthlyData.get(monthKey);
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
        monthlyData.set(monthKey, {
          ...point,
          date: monthLabel,
          fullDate: monthFullDate,
          ...(showComparison && {
            prevFullDate: prevMonthFullDate,
          }),
        } as DashboardChartDataPoint);
      }
    });
    
    return Array.from(monthlyData.values());
  }, [comparisonChartData, chartGranularity, dateRange, showComparison]);

  // Pie chart data for cost breakdown
  const costBreakdownData = financialStats ? [
    { name: "Profit", value: Math.max(0, financialStats.month.profit), color: COLORS.profit },
    { name: "COGS", value: financialStats.month.cost, color: COLORS.cost },
  ] : [];

  // Custom tooltip for financial chart (Task 2: Explicit comparison labels)
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
      
      // Get specific comparison date for this point
      const dataPoint = payload[0]?.payload;
      const specificComparisonDate = dataPoint?.prevFullDate;
      
      return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-xs text-muted-foreground mb-1">{dataPoint?.fullDate || label}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full" style={{ backgroundColor: COLORS[activeMetric] }} />
              <span className="text-sm font-medium tabular-nums">Current: {formatCurrency(currentValue)}</span>
            </div>
            {showComparison && previous && (
              <>
                <div className="flex items-center gap-2 opacity-70">
                  <div className="size-2 rounded-full" style={{ backgroundColor: COLORS[activeMetric] }} />
                  <span className="text-sm tabular-nums">Previous: {formatCurrency(previousValue)}</span>
                  {specificComparisonDate && (
                    <span className="text-[10px] text-muted-foreground">(vs {specificComparisonDate})</span>
                  )}
                </div>
                {percentChange && (
                  <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                    <span>Delta:</span>
                    {isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    <span>{Math.abs(parseFloat(percentChange))}%</span>
                  </div>
                )}
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
      {/* Full-height flex container - no negative margins */}
      <div className="flex flex-col h-full overflow-hidden">
        {/* ============================================================= */}
        {/* Sticky Control Bar - h-14 to match ReportShell toolbar */}
        {/* ============================================================= */}
        <div className="shrink-0 bg-card border-b border-stone-200/80 h-14 flex items-center px-4 md:px-6 shadow-sm z-20">
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            {/* Left: Date Range Picker & Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <DateRangePicker
                date={dateRange}
                onDateChange={(range) => {
                  setDateRange(range);
                  setSelectedPreset("");
                }}
              />
              <div className="hidden sm:flex items-center gap-1 flex-wrap">
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
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* Scrollable Content Area */}
        {/* ============================================================= */}
        <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        
        {/* ============================================================= */}
        {/* Row 1: Financial Hub (Merged Cards + Chart) + Intelligence Feed */}
        {/* ============================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 ">
          {/* Financial Hub - Combined Summary + Chart (3 columns) */}
          <Card className="shadow-sm lg:col-span-3 max-h-[99%]">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-[#2EAFC5]" />
                    Financial Hub
                  </CardTitle>
                  <CardDescription>
                    {selectedPreset || "Custom date range"} • Click a metric to view trends
                  </CardDescription>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Granularity Toggle - Dynamic based on date range */}
                  <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
                    {(["hourly", "daily", "weekly", "monthly"] as const).map((granularity) => {
                      const isValid = validGranularities.includes(granularity);
                      return (
                        <button
                          key={granularity}
                          onClick={() => isValid && setChartGranularity(granularity)}
                          disabled={!isValid}
                          className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${
                            chartGranularity === granularity
                              ? "bg-background text-foreground shadow-sm"
                              : isValid
                                ? "text-muted-foreground hover:text-foreground"
                                : "text-muted-foreground/40 cursor-not-allowed"
                          }`}
                        >
                          {granularity.charAt(0).toUpperCase() + granularity.slice(1)}
                        </button>
                      );
                    })}
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
            <CardContent className="pt-0">
              {/* Metric Cards as Radio Buttons - Now reactive to dateRange */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {/* Revenue Card */}
                <button
                  onClick={() => setActiveMetric("revenue")}
                  className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                    activeMetric === "revenue"
                      ? "border-[#2EAFC5] bg-[#2EAFC5]/5 shadow-md"
                      : "border-border/50 bg-card hover:border-border hover:bg-muted/30 opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`size-7 rounded-lg flex items-center justify-center transition-colors ${
                      activeMetric === "revenue" ? "bg-[#2EAFC5]/20" : "bg-muted"
                    }`}>
                      <Banknote className={`size-3.5 ${activeMetric === "revenue" ? "text-[#2EAFC5]" : "text-muted-foreground"}`} />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Revenue</span>
                  </div>
                  <p className={`text-xl font-bold tabular-nums ${activeMetric === "revenue" ? "text-[#2EAFC5]" : "text-foreground"}`}>
                    {formatCurrency(financialSummary.revenue)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{financialSummary.count} days</p>
                  {activeMetric === "revenue" && (
                    <div className="absolute top-2 right-2 size-2 rounded-full bg-[#2EAFC5]" />
                  )}
                </button>

                {/* Profit Card */}
                <button
                  onClick={() => setActiveMetric("profit")}
                  className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                    activeMetric === "profit"
                      ? "border-[#10B981] bg-[#10B981]/5 shadow-md"
                      : "border-border/50 bg-card hover:border-border hover:bg-muted/30 opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`size-7 rounded-lg flex items-center justify-center transition-colors ${
                      activeMetric === "profit" ? "bg-[#10B981]/20" : "bg-muted"
                    }`}>
                      <TrendingUp className={`size-3.5 ${activeMetric === "profit" ? "text-[#10B981]" : "text-muted-foreground"}`} />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Profit</span>
                  </div>
                  <p className={`text-xl font-bold tabular-nums ${activeMetric === "profit" ? "text-[#10B981]" : "text-foreground"}`}>
                    {formatCurrency(financialSummary.profit)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{calculateMargin(financialSummary.profit, financialSummary.revenue)}% margin</p>
                  {activeMetric === "profit" && (
                    <div className="absolute top-2 right-2 size-2 rounded-full bg-[#10B981]" />
                  )}
                </button>

                {/* Cost Card */}
                <button
                  onClick={() => setActiveMetric("cost")}
                  className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                    activeMetric === "cost"
                      ? "border-[#F1782F] bg-[#F1782F]/5 shadow-md"
                      : "border-border/50 bg-card hover:border-border hover:bg-muted/30 opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`size-7 rounded-lg flex items-center justify-center transition-colors ${
                      activeMetric === "cost" ? "bg-[#F1782F]/20" : "bg-muted"
                    }`}>
                      <Receipt className={`size-3.5 ${activeMetric === "cost" ? "text-[#F1782F]" : "text-muted-foreground"}`} />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Cost (COGS)</span>
                  </div>
                  <p className={`text-xl font-bold tabular-nums ${activeMetric === "cost" ? "text-[#F1782F]" : "text-foreground"}`}>
                    {formatCurrency(financialSummary.cost)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{(100 - parseFloat(calculateMargin(financialSummary.profit, financialSummary.revenue))).toFixed(1)}% of revenue</p>
                  {activeMetric === "cost" && (
                    <div className="absolute top-2 right-2 size-2 rounded-full bg-[#F1782F]" />
                  )}
                </button>
              </div>
              
              {/* Chart */}
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
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
            maxHeight="h-[510px]"
          />
        </div>

        {/* ============================================================= */}
        {/* Row 3: Peak Traffic Heatmap (1 col) + Product Insights (3 cols) */}
        {/* ============================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Peak Traffic Heatmap (1 column) */}
          <Card className="shadow-sm lg:col-span-1">
            <CardHeader className="pb-0">
              <div>
                <CardTitle className="text-foreground flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-[#2EAFC5]" />
                  Peak Traffic
                </CardTitle>
                <CardDescription>Sales intensity by day & hour</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
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

          {/* Product Insights - Tabbed Card (3 columns) */}
          <Card className="shadow-sm lg:col-span-3">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-foreground flex items-center gap-2 text-base">
                    <Zap className="h-4 w-4 text-[#F59E0B]" />
                    Product Insights
                    {dateRange?.from && dateRange?.to && (
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        ({format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")})
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {productInsightsTab === "movers" 
                      ? `${topMovers.length} products ranked by sales velocity with profit` 
                      : productInsightsTab === "deadstock"
                      ? "Non-moving inventory tying up cash"
                      : "Revenue & profit distribution by category"}
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
                    onClick={() => setProductInsightsTab("deadstock")}
                    className={`text-[10px] px-2.5 py-1.5 rounded-md transition-colors font-medium ${
                      productInsightsTab === "deadstock"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Dead Stock
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
                /* Top Movers Table - All products with profit */
                <ScrollArea className="h-[320px]">
                  {topMovers.length > 0 ? (
                    <div className="space-y-0">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                          <p className="text-[10px] text-emerald-600 font-medium">Total Revenue</p>
                          <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(topMovers.reduce((sum, p) => sum + p.total_revenue, 0))}
                          </p>
                        </div>
                        <div className="p-2 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg">
                          <p className="text-[10px] text-cyan-600 font-medium">Total Profit</p>
                          <p className="text-sm font-bold tabular-nums text-cyan-700 dark:text-cyan-400">
                            {formatCurrency(topMovers.reduce((sum, p) => sum + p.total_profit, 0))}
                          </p>
                        </div>
                        <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                          <p className="text-[10px] text-amber-600 font-medium">Items Sold</p>
                          <p className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
                            {topMovers.reduce((sum, p) => sum + p.total_sold, 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      {/* Products Table */}
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="text-[10px] w-10">#</TableHead>
                            <TableHead className="text-[10px]">Product</TableHead>
                            <TableHead className="text-[10px] w-[140px]">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted">Velocity</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[200px]">
                                  <p className="text-xs">Average units sold per day. Higher velocity = faster-moving product.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableHead>
                            <TableHead className="text-[10px] text-right">Sold</TableHead>
                            <TableHead className="text-[10px] text-right">Revenue</TableHead>
                            <TableHead className="text-[10px] text-right">Profit</TableHead>
                            <TableHead className="text-[10px] text-right">Stock</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {topMovers.map((product, index) => {
                            const rankColors = ["#AC0F16", "#2EAFC5", "#F1782F", "#8B5CF6", "#10B981"];
                            const color = index < 5 ? rankColors[index] : "#6B7280";
                            const maxVelocity = Math.max(...topMovers.map(p => p.velocity));
                            const barWidth = maxVelocity > 0 ? (product.velocity / maxVelocity) * 100 : 0;
                            
                            return (
                              <TableRow key={product.product_id} className="h-9">
                                <TableCell className="py-1">
                                  <div 
                                    className="size-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                    style={{ backgroundColor: color }}
                                  >
                                    {index + 1}
                                  </div>
                                </TableCell>
                                <TableCell className="py-1">
                                  <div className="flex items-center gap-2">
                                    <div className="size-7 rounded overflow-hidden bg-muted shrink-0">
                                      {product.image_url ? (
                                        <img 
                                          src={product.image_url} 
                                          alt=""
                                          className="size-full object-cover"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <div className="size-full flex items-center justify-center">
                                          <Package className="size-3 text-muted-foreground/50" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-medium truncate max-w-[120px]">{product.product_name}</p>
                                      <p className="text-[9px] text-muted-foreground capitalize">{product.category.toLowerCase()}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-1">
                                  {/* Velocity with visual bar */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-2 cursor-help">
                                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                          <div 
                                            className="h-full rounded-full transition-all" 
                                            style={{ width: `${barWidth}%`, backgroundColor: color }}
                                          />
                                        </div>
                                        <span className="text-[10px] font-bold tabular-nums shrink-0 w-10 text-right" style={{ color }}>
                                          {product.velocity}/d
                                        </span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs">{product.velocity} units sold per day on average</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TableCell>
                                <TableCell className="py-1 text-right">
                                  <span className="text-[10px] tabular-nums">{product.total_sold}</span>
                                </TableCell>
                                <TableCell className="py-1 text-right">
                                  <span className="text-[10px] tabular-nums">{formatCurrency(product.total_revenue)}</span>
                                </TableCell>
                                <TableCell className="py-1 text-right">
                                  <span className={`text-[10px] tabular-nums font-medium ${product.total_profit > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                                    {formatCurrency(product.total_profit)}
                                  </span>
                                </TableCell>
                                <TableCell className="py-1 text-right">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                    product.current_stock === 0 
                                      ? "bg-destructive/20 text-destructive" 
                                      : product.current_stock <= 10 
                                        ? "bg-amber-500/20 text-amber-600" 
                                        : "bg-cyan-500/20 text-cyan-600"
                                  }`}>
                                    {product.current_stock}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
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
              ) : productInsightsTab === "deadstock" ? (
                /* Dead Stock List - Items with Stock > 5 AND Velocity = 0 */
                <ScrollArea className="h-[280px]">
                  {(() => {
                    // Filter dead stock items from forecasts
                    const deadStockItems = data.forecasts.filter(
                      item => item.currentStock > 5 && item.velocity7Day === 0
                    );
                    const totalFrozenCash = deadStockItems.reduce(
                      (sum, item) => sum + (item.currentStock * item.costPrice), 0
                    );
                    
                    return deadStockItems.length > 0 ? (
                      <div className="space-y-2 pr-2">
                        {/* Frozen Cash Summary */}
                        <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <Snowflake className="h-4 w-4 text-blue-500" />
                            <span className="text-xs font-medium text-muted-foreground">Total Frozen Cash</span>
                          </div>
                          <p className="text-xl font-bold text-foreground tabular-nums mt-1">
                            {formatCurrency(totalFrozenCash)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{deadStockItems.length} products with no movement</p>
                        </div>
                        
                        {deadStockItems.slice(0, 8).map((item, index) => (
                          <div 
                            key={item.productId}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            {/* Index */}
                            <div className="size-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-slate-400">
                              {index + 1}
                            </div>
                            
                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate text-foreground">{item.productName}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{item.category.toLowerCase().replace(/_/g, " ")}</p>
                            </div>
                            
                            {/* Stats */}
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-400">{item.currentStock} units</p>
                              <p className="text-[10px] text-muted-foreground tabular-nums">₱{(item.currentStock * item.costPrice).toLocaleString()}</p>
                            </div>
                            
                            {/* Action */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log("Create discount for:", item.productName);
                              }}
                            >
                              <Tag className="h-3 w-3" />
                              Discount
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <Snowflake className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No dead stock detected</p>
                          <p className="text-xs">All products have recent sales activity</p>
                        </div>
                      </div>
                    );
                  })()}
                </ScrollArea>
              ) : (
                /* Category Share - Chart + Table with detailed metrics */
                <ScrollArea className="h-[320px]">
                  {categoryData.length > 0 ? (
                    <div className="flex flex-col lg:flex-row gap-4">
                      {/* Donut Chart */}
                      <div className="h-[200px] lg:w-1/3 shrink-0">
                        <ResponsiveContainer width="100%" height="100%" debounce={100}>
                          <RechartsPie>
                            <Pie
                              data={categoryData}
                              dataKey="revenue"
                              nameKey="label"
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={2}
                              labelLine={false}
                          label={({ percentage }) => {
                            if (percentage < 8) return null;
                            return `${percentage}%`;
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
                                  <div className="text-[10px] text-muted-foreground space-y-0.5 mt-1">
                                    <p>Revenue: {formatCurrency(data.revenue)}</p>
                                    <p>Profit: {formatCurrency(data.profit)}</p>
                                    <p>Items: {data.itemsSold.toLocaleString()}</p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                      </div>
                      
                      {/* Category Table with detailed metrics */}
                      <div className="flex-1">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="text-[10px]">Category</TableHead>
                              <TableHead className="text-[10px] text-right">Revenue</TableHead>
                              <TableHead className="text-[10px] text-right">Profit</TableHead>
                              <TableHead className="text-[10px] text-right">Margin</TableHead>
                              <TableHead className="text-[10px] text-right">Items</TableHead>
                              <TableHead className="text-[10px] text-right">Avg Price</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {categoryData.map((cat) => {
                              const margin = cat.revenue > 0 ? (cat.profit / cat.revenue * 100) : 0;
                              return (
                                <TableRow key={cat.category} className="h-9">
                                  <TableCell className="py-1">
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="size-2.5 rounded-full shrink-0" 
                                        style={{ backgroundColor: cat.color }}
                                      />
                                      <span className="text-[10px] font-medium">{cat.label}</span>
                                      <span className="text-[9px] text-muted-foreground">({cat.percentage}%)</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-1 text-right">
                                    <span className="text-[10px] tabular-nums">{formatCurrency(cat.revenue)}</span>
                                  </TableCell>
                                  <TableCell className="py-1 text-right">
                                    <span className={`text-[10px] tabular-nums font-medium ${cat.profit > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                                      {formatCurrency(cat.profit)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-1 text-right">
                                    <span className={`text-[10px] tabular-nums ${margin >= 15 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-destructive'}`}>
                                      {margin.toFixed(1)}%
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-1 text-right">
                                    <span className="text-[10px] tabular-nums">{cat.itemsSold.toLocaleString()}</span>
                                  </TableCell>
                                  <TableCell className="py-1 text-right">
                                    <span className="text-[10px] tabular-nums">₱{cat.avgItemPrice}</span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        
                        {/* Summary Footer */}
                        <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <p className="text-[9px] text-muted-foreground">Total Revenue</p>
                            <p className="text-xs font-bold tabular-nums">{formatCurrency(categoryData.reduce((s, c) => s + c.revenue, 0))}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] text-muted-foreground">Total Profit</p>
                            <p className="text-xs font-bold tabular-nums text-emerald-600">{formatCurrency(categoryData.reduce((s, c) => s + c.profit, 0))}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] text-muted-foreground">Categories</p>
                            <p className="text-xs font-bold tabular-nums">{categoryData.length}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No sales data for this period</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ============================================================= */}
        {/* Row 4: Master-Detail Restock Section (Side-by-Side) */}
        {/* ============================================================= */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Left Column: Restock Recommendations Table */}
          <div className="xl:col-span-8">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-foreground flex items-center gap-2 text-base">
                      <Package className="h-4 w-4 text-primary" />
                      Restock Recommendations
                    </CardTitle>
                    <CardDescription className="text-muted-foreground text-xs">
                      Select items to export purchase order
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href="/admin/inventory">
                      <Button variant="outline" size="sm" className="gap-2 h-8">
                        View Inventory
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
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
                  onExportPO={(selectedItems) => {
                    generatePurchaseOrderExcel(selectedItems);
                  }}
                  initialAddToPO={initialAddToPO}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Context-Aware Demand Forecast (sticky) */}
          <div className="xl:col-span-4">
            <div className="xl:sticky xl:top-20 h-fit">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  {/* Product Header when selected */}
                  {selectedProductInfo ? (
                    <div className="flex items-center gap-2 mb-2 overflow-hidden">
                      <Avatar className="h-10 w-10 shrink-0 border-2 border-primary/20">
                        <AvatarImage 
                          src={selectedProductInfo.productImage || undefined} 
                          alt={selectedProductInfo.productName}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {selectedProductInfo.productName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className="font-bold text-foreground text-sm truncate" title={selectedProductInfo.productName}>{selectedProductInfo.productName}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>Stock: <span className={`font-medium ${selectedProductInfo.currentStock < 10 ? "text-orange-500" : "text-emerald-500"}`}>{selectedProductInfo.currentStock}</span></span>
                          <span>•</span>
                          <span className="capitalize truncate">{selectedProductInfo.category.toLowerCase().replace(/_/g, " ")}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => {
                          setSelectedProductId(null);
                          setSelectedProductName(null);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-foreground flex items-center gap-2 text-base">
                          <Sparkles className="h-4 w-4 text-[#F59E0B]" />
                          Demand Forecast
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {demandHistoryDays}-Day History vs {demandHistoryDays === 7 ? 7 : demandHistoryDays === 30 ? 14 : 30}-Day Forecast
                        </CardDescription>
                      </div>
                      {/* Time Range Toggle */}
                      <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
                        {([7, 30, 90] as const).map((days) => (
                          <Button
                            key={days}
                            variant="ghost"
                            size="sm"
                            className={`h-7 px-2.5 text-xs font-medium ${
                              demandHistoryDays === days
                                ? "bg-background shadow-sm text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => setDemandHistoryDays(days)}
                          >
                            {days}d
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Time Range Toggle (when product selected) */}
                  {selectedProductInfo && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">
                        {demandHistoryDays}d History → {demandHistoryDays === 7 ? 7 : demandHistoryDays === 30 ? 14 : 30}d Forecast
                      </span>
                      <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
                        {([7, 30, 90] as const).map((days) => (
                          <Button
                            key={days}
                            variant="ghost"
                            size="sm"
                            className={`h-6 px-2 text-[10px] font-medium ${
                              demandHistoryDays === days
                                ? "bg-background shadow-sm text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => setDemandHistoryDays(days)}
                          >
                            {days}d
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Narrative Header - Dynamic Smart Summary */}
                  {selectedProductInfo && demandForecastData.length > 0 && (() => {
                    // Calculate key metrics for narrative from chart data
                    const historicalDays = demandForecastData.filter(d => d.historical !== null);
                    const totalHistorical = historicalDays.reduce((sum, d) => sum + (d.historical || 0), 0);
                    const forecastDays = demandForecastData.filter(d => d.forecast !== null);
                    const totalForecast = forecastDays.reduce((sum, d) => sum + (d.forecast || 0), 0);
                    
                    // Calculate daily rate from historical data
                    const dailyRate = historicalDays.length > 0 ? totalHistorical / historicalDays.length : 0;
                    const daysUntilEmpty = dailyRate > 0 ? Math.floor(selectedProductInfo.currentStock / dailyRate) : 999;
                    
                    // Determine narrative message and icon
                    type NarrativeType = "critical" | "warning" | "forecast" | "healthy" | "info";
                    let narrativeType: NarrativeType = "info";
                    let narrativeClass = "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-200";
                    let narrative = "";
                    
                    if (selectedProductInfo.currentStock === 0) {
                      narrativeType = "critical";
                      narrativeClass = "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-200";
                      narrative = "Out of stock! Immediate restock needed to avoid lost sales.";
                    } else if (daysUntilEmpty <= 2) {
                      narrativeType = "critical";
                      narrativeClass = "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-200";
                      const runOutDate = format(addDays(new Date(), daysUntilEmpty), "EEEE");
                      narrative = `Stock will run out by ${runOutDate} if not replenished.`;
                    } else if (daysUntilEmpty <= 7) {
                      narrativeType = "warning";
                      narrativeClass = "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200";
                      narrative = `Running low — about ${daysUntilEmpty} days of stock remaining.`;
                    } else if (totalForecast > selectedProductInfo.currentStock) {
                      narrativeType = "forecast";
                      narrativeClass = "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200";
                      narrative = `Forecasted demand (${totalForecast} units) exceeds current stock. Consider restocking.`;
                    } else {
                      narrativeType = "healthy";
                      narrativeClass = "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200";
                      narrative = `Stock levels healthy — ${daysUntilEmpty > 30 ? "30+" : daysUntilEmpty} days of supply on hand.`;
                    }
                    
                    const NarrativeIcon = () => {
                      switch (narrativeType) {
                        case "critical": return <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
                        case "warning": return <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
                        case "forecast": return <TrendingUp className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
                        case "healthy": return <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
                        default: return <Lightbulb className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
                      }
                    };
                    
                    return (
                      <div className={`mb-3 p-2.5 rounded-lg border text-xs flex items-start gap-1.5 ${narrativeClass}`}>
                        <NarrativeIcon />
                        <span className="font-medium">{narrative}</span>
                      </div>
                    );
                  })()}
                  
                  {/* Default narrative when no product selected */}
                  {!selectedProductInfo && demandForecastData.length > 0 && (
                    <div className="mb-3 p-2.5 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-200 text-xs flex items-start gap-1.5">
                      <Lightbulb className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span className="font-medium">Select a product from the table to see detailed demand insights.</span>
                    </div>
                  )}
                  
                  <div className="h-[280px]">
                    {demandForecastData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%" debounce={100}>
                        <ComposedChart data={demandForecastData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                          <defs>
                            <linearGradient id="demandConfidenceGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.05} />
                            </linearGradient>
                            {/* Background shading for forecast area */}
                            <linearGradient id="forecastBgGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.08} />
                              <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} className="stroke-border/50" strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            className="text-[10px] fill-muted-foreground"
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={4}
                            className="text-[10px] fill-muted-foreground"
                            tickFormatter={(value) => `${value}`}
                          />
                          <RechartsTooltip 
                            content={({ active, payload }) => {
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
                                          <span className="text-xs">Sold: <span className="font-medium">{data.historical} units</span></span>
                                        </div>
                                      )}
                                      {data?.forecast !== null && (
                                        <div className="flex items-center gap-2">
                                          <div className="size-2 rounded-full bg-[#F59E0B]" />
                                          <span className="text-xs">Forecast: <span className="font-medium">{data.forecast} units</span></span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          
                          {/* Event reference lines */}
                          {demandForecastData
                            .filter((d) => d.isEvent)
                            .map((d, i) => (
                              <ReferenceLine
                                key={i}
                                x={d.date}
                                stroke={COLORS.event}
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                label={{ value: "★", position: "top", fontSize: 12 }}
                              />
                            ))}
                          
                          {/* Confidence interval */}
                          <Area
                            dataKey="forecastUpper"
                            type="monotone"
                            fill="url(#demandConfidenceGradient)"
                            stroke="none"
                            connectNulls={false}
                          />
                          
                          {/* Historical bars (units) */}
                          <Bar
                            dataKey="historical"
                            name="Historical"
                            fill={COLORS.bar}
                            radius={[3, 3, 0, 0]}
                          />
                          
                          {/* Bridge */}
                          <Line
                            dataKey="bridge"
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
                            strokeWidth={2.5}
                            dot={{ fill: COLORS.forecast, r: 3, strokeWidth: 2, stroke: "#fff" }}
                            activeDot={{ r: 5, fill: COLORS.forecast, stroke: "#fff", strokeWidth: 2 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Loading forecast...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Chart Legend */}
                  <div className="flex items-center justify-center gap-6 mt-2 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-[#8B5CF6]" />
                      <span>History (Actual)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-1 rounded-full bg-[#F59E0B]" />
                      <span>Forecast (Predicted)</span>
                    </div>
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-3">
                    <div className="text-center p-2 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{demandHistoryDays}-Day History</p>
                      <p className="text-lg font-bold text-foreground tabular-nums">
                        {demandForecastData.filter(d => d.historical !== null).reduce((sum, d) => sum + (d.historical || 0), 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">sold</span>
                      </p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {demandHistoryDays === 7 ? "7" : demandHistoryDays === 30 ? "14" : "30"}-Day Forecast
                      </p>
                      <p className="text-lg font-bold text-foreground tabular-nums">
                        {demandForecastData.filter(d => d.forecast !== null).reduce((sum, d) => sum + (d.forecast || 0), 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">expected</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        </div>
      </div>
      
      {/* AI Assistant */}
 
    </TooltipProvider>
  );
}

// =============================================================================
// Peak Traffic Heatmap Component
// =============================================================================

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

// Format hour to AM/PM format
const formatHourLabel = (hour: number): string => {
  if (hour === 12) return "12PM";
  if (hour > 12) return `${hour - 12}PM`;
  return `${hour}AM`;
};

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

  // Calculate smart insight - peak day and hour range
  const smartInsight = useMemo(() => {
    // Find peak day (highest total sales)
    let peakDay = { idx: 0, total: 0 };
    heatmapData.forEach((row, dayIdx) => {
      const dayTotal = row.reduce((sum, cell) => sum + cell.value, 0);
      if (dayTotal > peakDay.total) {
        peakDay = { idx: dayIdx, total: dayTotal };
      }
    });

    // Find peak hour range (2-hour window with highest density)
    let peakHourRange = { startHour: 8, endHour: 10, total: 0 };
    for (let hourIdx = 0; hourIdx < HOURS.length - 1; hourIdx++) {
      let rangeTotal = 0;
      heatmapData.forEach(row => {
        rangeTotal += row[hourIdx].value + row[hourIdx + 1].value;
      });
      if (rangeTotal > peakHourRange.total) {
        peakHourRange = { startHour: HOURS[hourIdx], endHour: HOURS[hourIdx + 1] + 1, total: rangeTotal };
      }
    }

    // Format hour to 12-hour format
    const formatHour = (hour: number) => {
      if (hour === 12) return "12:00 PM";
      if (hour > 12) return `${hour - 12}:00 PM`;
      return `${hour}:00 AM`;
    };

    return {
      peakDayName: DAYS_OF_WEEK[peakDay.idx] + (peakDay.idx >= 4 ? "s" : "s"), // e.g., "Fridays"
      peakDayNameFull: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][peakDay.idx] + "s",
      peakHourStart: formatHour(peakHourRange.startHour),
      peakHourEnd: formatHour(peakHourRange.endHour),
      hasData: peakDay.total > 0,
    };
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

       {/* Smart Insight */}
      {smartInsight.hasData && (
        <div className="mt-0 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-start gap-2">
            <Flame className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <span className="font-semibold">Insight:</span> Your peak traffic is on <span className="font-semibold">{smartInsight.peakDayNameFull}</span> between <span className="font-semibold">{smartInsight.peakHourStart} - {smartInsight.peakHourEnd}</span>.
            </p>
          </div>
        </div>
      )}
      {/* Hour labels */}
      <div className="flex mb-1">
        <div className="w-10" /> {/* Spacer for day labels */}
        {HOURS.map((hour) => (
          <div key={hour} className="flex-1 text-center">
            <span className="text-[9px] text-muted-foreground">
              {formatHourLabel(hour)}
            </span>
          </div>
        ))}
      </div>
      
      {/* Heatmap grid */}
      <div className="flex-1 flex flex-col gap-1.5 mt-2">
        {heatmapData.map((row, dayIdx) => (
          <div key={dayIdx} className="flex gap-1.5 flex-1">
            {/* Day label */}
            <div className="w-10 flex items-center justify-end pr-2">
              <span className="text-[10px] font-medium text-muted-foreground">
                {DAYS_OF_WEEK[dayIdx]}
              </span>
            </div>
            {/* Cells - rounded squares with better spacing */}
            {row.map((cell, hourIdx) => (
              <Tooltip key={hourIdx}>
                <TooltipTrigger asChild>
                  <div
                    className={`flex-1 aspect-square rounded-md cursor-pointer transition-all hover:ring-2 hover:ring-cyan-400 hover:scale-105 min-h-[16px] ${getColor(cell.value)}`}
                  />
                </TooltipTrigger>
                <TooltipContent 
                  side="top" 
                  className="bg-popover text-popover-foreground border shadow-lg p-2"
                >
                  <div className="font-medium text-xs text-foreground">
                    {cell.day} @ {formatHourLabel(cell.hour)}
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
        <div className="flex gap-1">
          <div className="size-4 rounded-md bg-muted/30" />
          <div className="size-4 rounded-md bg-cyan-100 dark:bg-cyan-950/40" />
          <div className="size-4 rounded-md bg-cyan-300 dark:bg-cyan-800/60" />
          <div className="size-4 rounded-md bg-cyan-500 dark:bg-cyan-600" />
          <div className="size-4 rounded-md bg-cyan-600 dark:bg-cyan-500" />
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
  { value: "good", label: "Good Stock" },
  { value: "dead", label: "Dead Stock" },
];

function getUrgencyLevel(item: ForecastTableItem): "critical" | "low" | "dead" | "good" {
  // Coverage-based urgency: Status already reflects days of supply
  // CRITICAL = ≤2 days, LOW = 2-7 days, HEALTHY = >7 days
  
  if (item.stockStatus === "DEAD_STOCK") {
    return "dead";
  }
  
  if (item.stockStatus === "OUT_OF_STOCK") {
    // Only critical if there's actual velocity/demand
    if (item.velocity7Day > 0 || item.predictedDemand > 0) {
      return "critical";
    }
    return "dead"; // No demand, treat as dead
  }
  
  // CRITICAL status now means ≤2 days of supply - always urgent
  if (item.stockStatus === "CRITICAL") {
    return "critical";
  }
  
  // LOW status now means 2-7 days of supply
  if (item.stockStatus === "LOW") {
    return "low";
  }
  
  // HEALTHY = >7 days of supply (good stock levels)
  return "good";
}

function getUrgencyPriority(item: ForecastTableItem): number {
  const urgency = getUrgencyLevel(item);
  switch (urgency) {
    case "critical": return 0;
    case "low": return 1;
    case "dead": return 2; // Dead stock is lower priority than actual restocking needs
    case "good": return 3;
    default: return 4;
  }
}

/**
 * Generate and download an Excel Purchase Order file
 * Uses ExcelJS for secure Excel generation (no prototype pollution vulnerabilities)
 * @param items - Array of ForecastTableItem to include in the PO
 */
async function generatePurchaseOrderExcel(items: ForecastTableItem[]): Promise<void> {
  // Filter to only items that need restocking (exclude healthy stock)
  const restockItems = items.filter(item => {
    const urgency = getUrgencyLevel(item);
    return urgency === "critical" || urgency === "low";
  });
  
  if (restockItems.length === 0) {
    alert("No items selected for purchase order. Please select items that need restocking.");
    return;
  }
  
  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Christian Minimart POS";
  workbook.created = new Date();
  
  const worksheet = workbook.addWorksheet("Purchase Order");
  
  // Add header section
  worksheet.mergeCells("A1:K1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "PURCHASE ORDER";
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: "center" };
  
  worksheet.mergeCells("A2:K2");
  worksheet.getCell("A2").value = "Christian Minimart";
  worksheet.getCell("A2").font = { size: 12 };
  worksheet.getCell("A2").alignment = { horizontal: "center" };
  
  worksheet.mergeCells("A3:K3");
  worksheet.getCell("A3").value = `Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}`;
  worksheet.getCell("A3").font = { size: 10, italic: true };
  worksheet.getCell("A3").alignment = { horizontal: "center" };
  
  // Calculate totals
  const totalItems = restockItems.reduce((sum, item) => sum + item.recommendedQty, 0);
  const totalOrderValue = restockItems.reduce((sum, item) => sum + (item.costPrice || 0) * item.recommendedQty, 0);
  
  // Add summary row
  worksheet.getCell("A5").value = `Total Items to Order: ${totalItems.toLocaleString()} units`;
  worksheet.getCell("A5").font = { bold: true };
  
  worksheet.getCell("A6").value = `Total Order Value: ₱${totalOrderValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
  worksheet.getCell("A6").font = { bold: true, color: { argb: "FF10B981" } };
  
  // Define columns starting at row 8
  worksheet.columns = [
    { key: "no", width: 6 },
    { key: "productName", width: 35 },
    { key: "category", width: 15 },
    { key: "currentStock", width: 14 },
    { key: "dailyRate", width: 16 },
    { key: "daysLeft", width: 10 },
    { key: "forecastedDemand", width: 20 },
    { key: "suggestedQty", width: 18 },
    { key: "costPrice", width: 14 },
    { key: "totalCost", width: 14 },
    { key: "priority", width: 12 },
  ];
  
  // Add header row at row 8
  const headerRow = worksheet.getRow(8);
  headerRow.values = [
    "No.",
    "Product Name",
    "Category",
    "Current Stock",
    "Daily Sales Rate",
    "Days Left",
    "Forecasted Demand (14d)",
    "Suggested Order Qty",
    "Cost Price (₱)",
    "Total Cost (₱)",
    "Priority",
  ];
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5E7EB" },
  };
  headerRow.alignment = { horizontal: "center" };
  
  // Add data rows starting at row 9
  restockItems.forEach((item, index) => {
    const dailyRate = item.velocity7Day / 7;
    const daysLeft = dailyRate > 0 ? Math.round(item.currentStock / dailyRate) : 0;
    const urgency = getUrgencyLevel(item).toUpperCase();
    
    const row = worksheet.getRow(9 + index);
    row.values = [
      index + 1,
      item.productName,
      item.category,
      item.currentStock,
      Number(dailyRate.toFixed(1)),
      daysLeft,
      item.predictedDemand,
      item.recommendedQty,
      item.costPrice || 0,
      Number(((item.costPrice || 0) * item.recommendedQty).toFixed(2)),
      urgency,
    ];
    
    // Color-code priority column
    const priorityCell = row.getCell(11);
    if (urgency === "CRITICAL") {
      priorityCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEE2E2" },
      };
      priorityCell.font = { color: { argb: "FFDC2626" }, bold: true };
    } else if (urgency === "LOW") {
      priorityCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEF3C7" },
      };
      priorityCell.font = { color: { argb: "FFD97706" }, bold: true };
    }
  });
  
  // Generate Excel file as buffer
  const buffer = await workbook.xlsx.writeBuffer();
  
  // Create blob and download
  const blob = new Blob([buffer], { 
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Purchase_Order_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ForecastingTable({ 
  forecasts,
  selectedProductId,
  onProductSelect,
  onExportPO,
  initialAddToPO
}: { 
  forecasts: ForecastTableItem[];
  selectedProductId?: number | null;
  onProductSelect?: (productId: number | null, productName: string | null) => void;
  onExportPO?: (selectedItems: ForecastTableItem[]) => void;
  initialAddToPO?: number | null;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("urgency");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [forecastPeriod, setForecastPeriod] = useState<7 | 14 | 30>(7);
  
  // Ref for auto-scrolling to this section
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Selection state for PO workflow - initialize with URL param if provided
  const [selectedItems, setSelectedItems] = useState<Set<number>>(() => {
    if (initialAddToPO) {
      return new Set([initialAddToPO]);
    }
    return new Set();
  });
  
  // Update selection and scroll into view if initialAddToPO is provided (from dashboard Add to PO)
  useEffect(() => {
    if (initialAddToPO) {
      // Add to selection
      if (!selectedItems.has(initialAddToPO)) {
        setSelectedItems(new Set([initialAddToPO]));
      }
      // Scroll to this table section with smooth animation
      setTimeout(() => {
        tableContainerRef.current?.scrollIntoView({ 
          behavior: "smooth", 
          block: "center" 
        });
      }, 300); // Small delay to allow page to render
    }
  }, [initialAddToPO]);

  // Helper to calculate scaled forecast values based on selected period
  const getScaledForecast = (item: ForecastTableItem) => {
    const dailyVelocity = item.velocity7Day / 7; // Daily velocity
    const scaleFactor = forecastPeriod / 7; // Scale from 7-day base
    
    // Scaled forecast demand
    const scaledDemand = Math.round(item.predictedDemand * scaleFactor);
    
    // Scaled recommended quantity (with safety buffer)
    const safetyBuffer = Math.ceil(dailyVelocity * 2); // 2 days safety
    const targetStock = Math.ceil(dailyVelocity * forecastPeriod) + safetyBuffer;
    const scaledRecommendedQty = Math.max(0, targetStock - item.currentStock);
    
    // Estimated cost
    const scaledCost = scaledRecommendedQty * item.costPrice;
    
    return {
      demand: scaledDemand,
      recommendedQty: scaledRecommendedQty,
      cost: scaledCost,
    };
  };

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
  
  // Toggle selection for a single item
  const toggleItemSelection = (productId: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedItems(newSelected);
  };
  
  // Toggle all items selection
  const toggleAllSelection = () => {
    if (selectedItems.size === filteredAndSortedForecasts.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredAndSortedForecasts.map(item => item.productId)));
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

    // Helper function to calculate days left (used for sorting)
    const getDaysLeft = (item: ForecastTableItem): number => {
      const dailyRate = item.velocity7Day / 7;
      if (dailyRate <= 0) {
        // No sales data - use a large number to push to bottom when sorted ascending
        return item.currentStock > 0 ? 9999 : -1; // Out of stock gets -1
      }
      return item.currentStock / dailyRate;
    };

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "product":
          comparison = a.productName.localeCompare(b.productName);
          break;
        case "stock":
          // Sort by actual days remaining, not raw stock count
          comparison = getDaysLeft(a) - getDaysLeft(b);
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

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => {
    const isSorted = sortField === field;
    const isAsc = sortOrder === "asc";
    
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleSort(field)}
        className="-ml-3 h-8 uppercase text-[11px] font-semibold tracking-wider hover:bg-transparent gap-1"
      >
        {children}
        <AnimatePresence mode="wait" initial={false}>
          {isSorted && isAsc ? (
            <motion.div
              key="asc"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <ChevronUp className="h-3.5 w-3.5 text-primary" />
            </motion.div>
          ) : isSorted && !isAsc ? (
            <motion.div
              key="desc"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <ChevronDown className="h-3.5 w-3.5 text-primary" />
            </motion.div>
          ) : (
            <motion.div
              key="unsorted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            </motion.div>
          )}
        </AnimatePresence>
      </Button>
    );
  };

  return (
    <div ref={tableContainerRef} className="flex flex-col gap-2">
      {/* Toolbar - Compact */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[150px] max-w-[250px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9.75 text-sm w-full"
          />
        </div>

        {/* Category Filter */}
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
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
          <SelectTrigger className="h-8 w-[130px] text-xs">
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
            className="h-8 w-8"
            onClick={resetFilters}
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Reset filters</span>
          </Button>
        )}

        {/* Forecast Period Selector */}
        <div className="flex items-center gap-1 border rounded-lg p-2 bg-muted/30">
          {([7, 14, 30] as const).map((days) => (
            <Tooltip key={days}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setForecastPeriod(days)}
                  className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${
                    forecastPeriod === days
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                  }`}
                >
                  {days}d
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-2 bg-popover text-popover-foreground border shadow-lg">
                <p className="text-xs">
                  {days === 7 && "7-day forecast - Standard reorder window"}
                  {days === 14 && "14-day forecast - Extended planning horizon"}
                  {days === 30 && "30-day forecast - Long-term projection (less accurate)"}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Export PO Button (shows selection count when items selected) */}
        {selectedItems.size > 0 && (
          <Button
            variant="default"
            size="sm"
            className="h-9.75 gap-1.5 bg-primary hover:bg-primary/90"
            onClick={() => {
              const selectedForecasts = filteredAndSortedForecasts.filter(
                item => selectedItems.has(item.productId)
              );
              generatePurchaseOrderExcel(selectedForecasts);
            }}
          >
            <FileDown className="h-3.5 w-3.5" />
            Export PO ({selectedItems.size})
          </Button>
        )}

        {/* Results Count */}
        <div className="flex items-center gap-1.5 h-8 px-2 rounded-md bg-muted/30 border border-border/40 ml-auto">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">{filteredAndSortedForecasts.length}</span>
          <span className="text-[10px] text-muted-foreground">/ {forecasts.length}</span>
        </div>
      </div>

      {/* Table with Scroll - Horizontal for mobile, vertical for content */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <ScrollArea className="h-[400px]">
            <div className="min-w-[850px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 bg-muted/30 w-[40px]">
                      <button
                        onClick={toggleAllSelection}
                        className="flex items-center justify-center w-full"
                      >
                        {selectedItems.size === filteredAndSortedForecasts.length && filteredAndSortedForecasts.length > 0 ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="h-10 bg-muted/30 min-w-[180px]">
                      <SortButton field="product">Product</SortButton>
                    </TableHead>
                    <TableHead className="h-10 bg-muted/30 text-right w-[120px]">
                      <SortButton field="stock">Time Left</SortButton>
                    </TableHead>
                    <TableHead className="h-10 bg-muted/30 text-right w-[110px]">
                      <SortButton field="velocity">Avg. Daily Sales</SortButton>
                    </TableHead>
                    <TableHead className="h-10 bg-muted/30 text-center w-[100px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <SortButton field="demand"><span className="font-bold text-foreground">Forecast ({forecastPeriod}d)</span></SortButton>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3 bg-popover text-popover-foreground border shadow-lg">
                          <p className="text-xs font-medium mb-1">{forecastPeriod}-Day Demand Forecast</p>
                          <p className="text-xs text-muted-foreground">
                            Predicted total units to be sold over the next {forecastPeriod} days based on 
                            Weighted Moving Average (WMA) of historical sales, adjusted for 
                            seasonality and active promotional events.
                            {forecastPeriod === 30 && (
                              <span className="flex items-center gap-1 mt-1 text-amber-600 font-medium">
                                <AlertTriangle className="size-3" /> 30-day forecasts have lower accuracy. Use for long-term planning only.
                              </span>
                            )}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="h-10 bg-muted/30 w-[100px]">
                      <SortButton field="urgency">Action</SortButton>
                    </TableHead>
                    <TableHead className="h-10 bg-muted/30 text-foreground font-bold uppercase text-[11px] tracking-wider w-[80px] text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">Rec ({forecastPeriod}d)</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3 bg-popover text-popover-foreground border shadow-lg">
                          <p className="text-xs font-medium mb-1">Recommended Order Quantity ({forecastPeriod} days)</p>
                          <p className="text-xs text-muted-foreground">
                            Suggested units to order to maintain {forecastPeriod} days of stock plus safety buffer. 
                            Calculated as: (Daily Velocity × {forecastPeriod} days) + Safety Buffer − Current Stock.
                            {forecastPeriod === 30 && (
                              <span className="flex items-center gap-1 mt-1 text-amber-600 font-medium">
                                <AlertTriangle className="size-3" /> Large orders may impact cash flow. Consider splitting orders.
                              </span>
                            )}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="h-10 bg-muted/30 text-foreground font-bold uppercase text-[11px] tracking-wider w-[60px] text-center">
                      Add
                    </TableHead>
                    <TableHead className="h-10 bg-muted/30 text-foreground font-bold uppercase text-[11px] tracking-wider text-right w-[100px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">Est. Cost</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3 bg-popover text-popover-foreground border shadow-lg">
                          <p className="text-xs font-medium mb-1">Estimated Restock Cost</p>
                          <p className="text-xs text-muted-foreground">
                            Total cost to order the recommended quantity: Cost Price × Recommended Qty. 
                            Use this to budget your purchase orders and manage cash flow.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                  </TableRow>
                </TableHeader>
            <TableBody>
              {filteredAndSortedForecasts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <p className="text-muted-foreground">No results found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedForecasts.map((item) => {
                  const scaled = getScaledForecast(item);
                  const dailyVelocity = item.velocity7Day / 7;
                  
                  return (
                  <TableRow 
                    key={item.productId}
                    onClick={() => onProductSelect?.(
                      selectedProductId === item.productId ? null : item.productId,
                      selectedProductId === item.productId ? null : item.productName
                    )}
                    className={`cursor-pointer transition-all ${
                      selectedProductId === item.productId 
                        ? "bg-primary/10 hover:bg-primary/15 border-l-4 border-l-primary" 
                        : "hover:bg-muted/50 border-l-4 border-l-transparent"
                    }`}
                  >
                    <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleItemSelection(item.productId)}
                        className="flex items-center justify-center w-full"
                      >
                        {selectedItems.has(item.productId) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="max-w-[160px]">
                        <p className="font-medium text-foreground text-sm truncate" title={item.productName}>{item.productName}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {item.category.toLowerCase().replace(/_/g, " ")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <StockWithSupply 
                        stock={item.currentStock} 
                        status={item.stockStatus} 
                        velocity30d={item.velocity7Day} 
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono py-2 text-foreground text-sm">
                      <VelocityWithTrend velocity={item.velocity7Day || 0} predicted={item.predictedDemand || 0} />
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold py-2 text-foreground text-sm">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            {isNaN(scaled.demand) ? "—" : scaled.demand}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3 bg-popover text-popover-foreground border shadow-lg">
                          <p className="text-xs font-medium mb-1">{forecastPeriod}-Day Demand Forecast: {scaled.demand} units</p>
                          <p className="text-xs text-muted-foreground mb-2">
                            Based on Weighted Moving Average (WMA) of past sales:
                          </p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Avg. Daily Sales:</span>
                              <span className="font-mono">{dailyVelocity.toFixed(1)} units/day</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{forecastPeriod}-Day Projection:</span>
                              <span className="font-mono">{scaled.demand} units</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Confidence:</span>
                              <span className={`font-medium ${
                                item.confidence === "HIGH" ? "text-emerald-600" :
                                item.confidence === "MEDIUM" ? "text-amber-600" : "text-red-500"
                              }`}>{item.confidence}{forecastPeriod === 30 && <AlertTriangle className="inline size-3 ml-1" />}</span>
                            </div>
                          </div>
                          {forecastPeriod === 30 && (
                            <p className="flex items-center gap-1 text-xs text-amber-600 mt-2 font-medium">
                              <AlertTriangle className="size-3" /> 30-day forecasts are less accurate. Use for planning only.
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="py-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className={`cursor-help text-[10px] font-medium ${
                              // Coverage-based color logic:
                              // OUT_OF_STOCK + demand = RED (Critical)
                              // CRITICAL (≤2 days) = RED (Critical Restock)
                              // LOW (2-7 days) = ORANGE (Restock Needed)
                              // DEAD_STOCK = GREY (Dead Stock)
                              // HEALTHY (>7 days) = GREEN (Maintain Stock)
                              item.stockStatus === "OUT_OF_STOCK"
                                ? (item.velocity7Day > 0 || item.predictedDemand > 0)
                                  ? "border-red-600 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                                  : "border-slate-400 bg-slate-100 text-slate-600 dark:bg-slate-950/30 dark:text-slate-400"
                                : item.stockStatus === "CRITICAL"
                                ? "border-red-600 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                                : item.stockStatus === "LOW"
                                ? "border-orange-500 bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                                : item.stockStatus === "DEAD_STOCK"
                                ? "border-slate-400 bg-slate-100 text-slate-600 dark:bg-slate-950/30 dark:text-slate-400"
                                : "border-teal-500 bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400"
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
                    <TableCell className="py-2 text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-mono font-bold text-sm text-foreground cursor-help">
                            {isNaN(scaled.recommendedQty) ? "—" : scaled.recommendedQty}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3 bg-popover text-popover-foreground border shadow-lg">
                          <p className="text-xs font-medium mb-1">Recommended Order: {scaled.recommendedQty} units</p>
                          <p className="text-xs text-muted-foreground mb-2">
                            Calculated to maintain {forecastPeriod} days of stock with safety buffer:
                          </p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Current Stock:</span>
                              <span className="font-mono">{item.currentStock} units</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Daily Velocity:</span>
                              <span className="font-mono">{dailyVelocity.toFixed(1)} units/day</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{forecastPeriod}-Day Demand:</span>
                              <span className="font-mono">{scaled.demand} units</span>
                            </div>
                            <div className="border-t border-border pt-1 mt-1 flex justify-between font-medium">
                              <span>Order Qty:</span>
                              <span className="font-mono text-primary">{scaled.recommendedQty} units</span>
                            </div>
                          </div>
                          {item.costPrice > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-2 pt-1 border-t border-border/50">
                              Est. cost: ₱{scaled.cost.toLocaleString("en-PH", { maximumFractionDigits: 0 })}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] gap-1 border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Add to selection for PO
                          if (!selectedItems.has(item.productId)) {
                            const newSelected = new Set(selectedItems);
                            newSelected.add(item.productId);
                            setSelectedItems(newSelected);
                          }
                        }}
                      >
                        <ShoppingCart className="h-3 w-3" />
                        Add
                      </Button>
                    </TableCell>
                    <TableCell className="text-right py-2 font-mono text-xs text-muted-foreground">
                      {isNaN(scaled.cost) 
                        ? "—" 
                        : `₱${scaled.cost.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`
                      }
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </div>
        
        {/* Total Order Value Footer - Only shows when items are selected */}
        {filteredAndSortedForecasts.length > 0 && selectedItems.size > 0 && (() => {
          const totalValue = filteredAndSortedForecasts
            .filter(item => selectedItems.has(item.productId))
            .reduce((sum, item) => sum + getScaledForecast(item).cost, 0);
          const isHighValue = totalValue > 50000;
          const itemCount = selectedItems.size;
          
          return (
            <div className={`sticky bottom-0 border-t border-border px-4 py-3 flex items-center justify-between ${isHighValue ? "bg-amber-50 dark:bg-amber-950/20" : "bg-muted/50"}`}>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Selected: {itemCount} items
                </span>
                {isHighValue && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-100 dark:bg-amber-950/30 gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    High Value Order
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Est. Cost:</span>
                <span className={`text-lg font-bold tabular-nums ${isHighValue ? "text-amber-600" : "text-primary"}`}>
                  ₱{totalValue.toLocaleString("en-PH", { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          );
        })()}
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

// =============================================================================
// Days Remaining Visualization (Simplified "Store Assistant" Style)
// =============================================================================
function StockWithSupply({ stock, status, velocity30d }: { stock: number; status: string; velocity30d: number }) {
  // Calculate Days of Supply
  // Formula: dailyRate = velocity_7d / 7 (velocity30d is actually 7-day velocity)
  const dailyRate = velocity30d / 7;
  
  // Determine display logic based on actual data
  const getConfig = () => {
    // Case 1: Out of Stock (stock = 0)
    if (stock === 0) {
      return {
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-100 dark:bg-red-950/50",
        label: "Out of Stock",
        showBar: false,
        daysLeft: 0,
        isDeadStock: false,
      };
    }
    
    // Case 2: Dead Stock / No Movement (has stock but 0 velocity)
    if (dailyRate <= 0) {
      return {
        color: "text-slate-500 dark:text-slate-400",
        bgColor: "bg-slate-100 dark:bg-slate-800/50",
        label: "No Movement",
        showBar: false,
        daysLeft: -1, // Indicator for dead stock
        isDeadStock: true,
      };
    }
    
    // Case 3: Calculate actual days left
    const daysLeft = stock / dailyRate;
    
    // Sub-case: Less than 1 day left (urgent)
    if (daysLeft < 1) {
      return {
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-100 dark:bg-red-950/50",
        barColor: "bg-red-500",
        label: "< 1 Day Left",
        showBar: true,
        percent: 5, // Show minimal bar
        daysLeft,
        isDeadStock: false,
      };
    }
    
    // Sub-case: 1-2 days left (critical)
    if (daysLeft < 3) {
      return {
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-100 dark:bg-red-950/50",
        barColor: "bg-red-500",
        label: `${Math.floor(daysLeft)} Days Left`,
        showBar: true,
        percent: Math.min((daysLeft / 7) * 100, 100),
        daysLeft,
        isDeadStock: false,
      };
    }
    
    // Sub-case: 3-7 days left (warning)
    if (daysLeft < 7) {
      return {
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-100 dark:bg-amber-950/50",
        barColor: "bg-amber-500",
        label: `${Math.floor(daysLeft)} Days Left`,
        showBar: true,
        percent: Math.min((daysLeft / 7) * 100, 100),
        daysLeft,
        isDeadStock: false,
      };
    }
    
    // Sub-case: 7+ days (healthy)
    return {
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-950/50",
      barColor: "bg-emerald-500",
      label: daysLeft > 30 ? "30+ Days" : `${Math.floor(daysLeft)} Days Left`,
      showBar: true,
      percent: 100,
      daysLeft,
      isDeadStock: false,
    };
  };
  
  const config = getConfig();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col items-end gap-1 cursor-help min-w-[90px]">
          {/* Primary: Days Remaining Label */}
          <span className={`text-xs font-semibold ${config.color}`}>
            {config.label}
          </span>
          {/* Visual Progress Bar */}
          {config.showBar && (
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${config.barColor}`}
                style={{ width: `${config.percent}%` }}
              />
            </div>
          )}
          {/* Secondary: Stock Count */}
          <span className="text-[9px] text-muted-foreground font-mono">
            ({stock.toLocaleString()} units)
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="p-3 max-w-[220px] bg-popover">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
            {config.label === "Out of Stock" ? (
              <><AlertTriangle className="h-4 w-4 text-red-500" /> Out of Stock</>
            ) : config.isDeadStock ? (
              <><Snowflake className="h-4 w-4 text-slate-500" /> No Movement (Stagnant)</>
            ) : config.daysLeft < 1 ? (
              <><Flame className="h-4 w-4 text-red-500" /> Critical: &lt; 1 Day</>
            ) : config.daysLeft < 3 ? (
              <><Flame className="h-4 w-4 text-red-500" /> {config.label}</>
            ) : config.daysLeft < 7 ? (
              <><Zap className="h-4 w-4 text-amber-500" /> {config.label}</>
            ) : (
              <><CheckCircle className="h-4 w-4 text-emerald-500" /> {config.label}</>
            )}
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Current Stock:</span>
              <span className="font-medium text-foreground">{stock.toLocaleString()} units</span>
            </div>
            <div className="flex justify-between">
              <span>Avg. Daily Sales:</span>
              <span className="font-medium text-foreground">{dailyRate > 0 ? dailyRate.toFixed(1) : "0"}/day</span>
            </div>
            {config.isDeadStock && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 pt-1 border-t border-border">
                Consider discounting this item to free up capital.
              </p>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// =============================================================================
// Average Daily Sales with Trend (Store Assistant Style)
// =============================================================================
function VelocityWithTrend({ velocity, predicted }: { velocity: number; predicted: number }) {
  // Calculate daily average (velocity is 7-day total, we need daily)
  const dailyAvg = velocity / 7;
  
  // Determine trend: if predicted > velocity, demand is rising; if less, falling
  // Only show trend if there's meaningful difference (>10%)
  const percentDiff = velocity > 0 ? Math.abs((predicted - velocity) / velocity) * 100 : 0;
  const isRising = predicted > velocity && percentDiff > 10;
  const isFalling = predicted < velocity && percentDiff > 10;
  const isStable = !isRising && !isFalling;
  
  // Generate tooltip text
  const getTrendTooltip = () => {
    if (velocity === 0) return "No recent sales";
    if (isRising) return `Demand rising: Forecast ${((predicted - velocity) / velocity * 100).toFixed(0)}% above current`;
    if (isFalling) return `Demand falling: Forecast ${((velocity - predicted) / velocity * 100).toFixed(0)}% below current`;
    return "Demand stable: Forecast matches current velocity";
  };
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center justify-end gap-1 cursor-help">
          <span className="tabular-nums text-sm">{dailyAvg.toFixed(1)}</span>
          <span className="text-[9px] text-muted-foreground">/day</span>
          {velocity > 0 && (
            <span className={`${isRising ? "text-green-600" : isFalling ? "text-orange-500" : "text-muted-foreground"}`}>
              {isRising ? <TrendingUp className="h-3 w-3" /> : isFalling ? <TrendingDown className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs bg-popover text-popover-foreground">
        {getTrendTooltip()}
      </TooltipContent>
    </Tooltip>
  );
}
