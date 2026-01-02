"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { DateRange } from "react-day-picker";
import { subDays, subMonths, startOfMonth, endOfMonth, format, addDays } from "date-fns";
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
  type TopMoverResult,
  type HourlyTrafficResult,
  type ForecastDataPoint,
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

// Date range presets
const datePresets = [
  { label: "Last 7 days", getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "Last 30 days", getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: "Last month", getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: "Dec 2025", getRange: () => ({ from: new Date(2025, 11, 1), to: new Date(2025, 11, 31) }) },
  { label: "Nov 2025", getRange: () => ({ from: new Date(2025, 10, 1), to: new Date(2025, 10, 30) }) },
];

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
  const [peakTraffic, setPeakTraffic] = useState<HourlyTrafficResult[]>([]);
  const [forecastData, setForecastData] = useState<ForecastDataPoint[]>([]);
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
        
        // Fetch peak traffic
        const traffic = await getPeakTrafficData(dateRange.from!, dateRange.to!);
        setPeakTraffic(traffic);
        
        // Fetch forecast data
        const forecast = await getForecastData();
        setForecastData(forecast);
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
        : "N/A";
      const isPositive = currentValue >= previousValue;
      
      return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-xs text-muted-foreground mb-1">{payload[0]?.payload?.fullDate || label}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full" style={{ backgroundColor: COLORS[activeMetric] }} />
              <span className="text-sm font-medium">{formatCurrency(currentValue)}</span>
            </div>
            {showComparison && previous && (
              <>
                <div className="flex items-center gap-2 opacity-60">
                  <div className="size-2 rounded-full" style={{ backgroundColor: COLORS[activeMetric] }} />
                  <span className="text-sm">vs {formatCurrency(previousValue)}</span>
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
      <div className="flex flex-col gap-4 pb-6">
        {/* ============================================================= */}
        {/* Global Filter Header */}
        {/* ============================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Analytics Hub</h1>
            <p className="text-muted-foreground text-sm">
              Financial performance, trends, and demand forecasting
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Date Range Picker */}
            <DateRangePicker
              date={dateRange}
              onDateChange={(range) => {
                setDateRange(range);
                setSelectedPreset("");
              }}
            />
            
            {/* Event Manager Link */}
            <Link href="/admin/analytics/events">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" />
                Events
              </Button>
            </Link>
          </div>
        </div>

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
          {isPending && (
            <div className="flex items-center gap-1.5 text-muted-foreground ml-2">
              <IconRefresh className="size-3.5 animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          )}
        </div>

        {/* ============================================================= */}
        {/* Main Chart: Financial Performance */}
        {/* ============================================================= */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#2EAFC5]" />
                  Financial Performance
                </CardTitle>
                <CardDescription>
                  {selectedPreset || "Custom date range"} • {chartData.length} data points
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-4">
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
                    Compare to previous period
                  </Label>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={comparisonChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      strokeOpacity={0.4}
                      fill="none"
                    />
                  )}
                  
                  {/* Current period (solid, bold) */}
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

        {/* ============================================================= */}
        {/* Row 2: Secondary Charts */}
        {/* ============================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Movers */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-[#F59E0B]" />
                Top Movers
              </CardTitle>
              <CardDescription>Top 5 products by sales velocity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                {topMovers.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topMovers.slice(0, 5)}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid horizontal={false} className="stroke-border/50" strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-muted-foreground"
                      />
                      <YAxis
                        type="category"
                        dataKey="product_name"
                        tickLine={false}
                        axisLine={false}
                        width={100}
                        tickMargin={8}
                        className="text-xs fill-muted-foreground"
                        tick={({ x, y, payload }) => (
                          <text x={x} y={y} dy={4} textAnchor="end" className="fill-foreground text-[10px]">
                            {payload.value.length > 15 ? payload.value.substring(0, 15) + "..." : payload.value}
                          </text>
                        )}
                      />
                      <RechartsTooltip content={<TopMoversTooltip />} />
                      <Bar
                        dataKey="velocity"
                        fill={COLORS.bar}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No sales data for this period</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Peak Traffic */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-[#2EAFC5]" />
                Peak Traffic Hours
              </CardTitle>
              <CardDescription>Sales distribution by hour of day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                {peakTraffic.some(p => p.transactions > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={peakTraffic} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid vertical={false} className="stroke-border/50" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="hour"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-muted-foreground"
                        interval={2}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-muted-foreground"
                      />
                      <RechartsTooltip content={<PeakTrafficTooltip />} />
                      <Bar
                        dataKey="transactions"
                        fill={COLORS.revenue}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#F59E0B]" />
                  Demand Forecast (Next 7 Days)
                </CardTitle>
                <CardDescription>
                  Historical sales vs AI-powered demand prediction
                </CardDescription>
              </div>
              <Link href="/admin/analytics/events">
                <Button variant="outline" size="sm" className="gap-2">
                  Manage Events
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {forecastData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecastData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
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
                    
                    {/* Historical bars */}
                    <Bar
                      dataKey="historical"
                      name="Historical"
                      fill={COLORS.bar}
                      radius={[4, 4, 0, 0]}
                    />
                    
                    {/* Forecast line */}
                    <Line
                      dataKey="forecast"
                      name="Forecast"
                      type="monotone"
                      stroke={COLORS.forecast}
                      strokeWidth={3}
                      dot={{ fill: COLORS.forecast, r: 4 }}
                      activeDot={{ r: 6, fill: COLORS.forecast }}
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
            <ForecastingTable forecasts={data.forecasts} />
          </CardContent>
        </Card>

        {/* ============================================================= */}
        {/* Row 5: Financial Summary */}
        {/* ============================================================= */}
        {financialStats && (
          <>
            <div className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-border" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Financial Summary
              </h2>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Monthly Revenue */}
              <div className="bg-card rounded-xl border px-4 py-3 hover:shadow-md transition-all hover:border-emerald-500/30">
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Banknote className="size-4 text-emerald-500" />
                  </div>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500">
                    {financialStats.month.count} sales
                  </span>
                </div>
                <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(financialStats.month.revenue)}
                </p>
                <p className="text-[10px] text-muted-foreground">Monthly Revenue</p>
              </div>

              {/* Cost of Goods */}
              <div className="bg-card rounded-xl border px-4 py-3 hover:shadow-md transition-all hover:border-rose-500/30">
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-7 rounded-lg bg-rose-500/20 flex items-center justify-center">
                    <TrendingDown className="size-4 text-rose-500" />
                  </div>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-500">
                    {financialStats.month.revenue > 0 ? ((financialStats.month.cost / financialStats.month.revenue) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <p className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  {formatCurrency(financialStats.month.cost)}
                </p>
                <p className="text-[10px] text-muted-foreground">Cost of Goods</p>
              </div>

              {/* Gross Profit */}
              <div className="bg-card rounded-xl border px-4 py-3 hover:shadow-md transition-all hover:border-indigo-500/30">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`size-7 rounded-lg flex items-center justify-center ${
                    financialStats.month.profit >= 0 ? "bg-indigo-500/20" : "bg-red-500/20"
                  }`}>
                    {financialStats.month.profit >= 0 ? (
                      <TrendingUp className="size-4 text-indigo-500" />
                    ) : (
                      <TrendingDown className="size-4 text-red-500" />
                    )}
                  </div>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    financialStats.month.profit >= 0 
                      ? "bg-indigo-500/20 text-indigo-500" 
                      : "bg-red-500/20 text-red-500"
                  }`}>
                    {calculateMargin(financialStats.month.profit, financialStats.month.revenue)}% margin
                  </span>
                </div>
                <p className={`text-lg font-bold tabular-nums ${
                  financialStats.month.profit >= 0 
                    ? "text-indigo-600 dark:text-indigo-400" 
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {formatCurrency(financialStats.month.profit)}
                </p>
                <p className="text-[10px] text-muted-foreground">Gross Profit</p>
              </div>

              {/* Today's Revenue */}
              <div className="bg-card rounded-xl border px-4 py-3 hover:shadow-md transition-all hover:border-amber-500/30">
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <IconReceipt className="size-4 text-amber-500" />
                  </div>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500">
                    {financialStats.today.count} today
                  </span>
                </div>
                <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {formatCurrency(financialStats.today.revenue)}
                </p>
                <p className="text-[10px] text-muted-foreground">Today&apos;s Revenue</p>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* AI Assistant */}
      <AIAssistant />
    </TooltipProvider>
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
  { value: "monitor", label: "Monitor" },
];

function getUrgencyLevel(item: ForecastTableItem): "critical" | "low" | "monitor" {
  if (item.stockStatus === "OUT_OF_STOCK" || item.stockStatus === "CRITICAL") {
    return "critical";
  }
  if (item.stockStatus === "LOW") {
    return "low";
  }
  return "monitor";
}

function getUrgencyPriority(item: ForecastTableItem): number {
  const urgency = getUrgencyLevel(item);
  switch (urgency) {
    case "critical": return 0;
    case "low": return 1;
    case "monitor": return 2;
    default: return 3;
  }
}

function ForecastingTable({ forecasts }: { forecasts: ForecastTableItem[] }) {
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
                  <SortButton field="demand">Demand</SortButton>
                </TableHead>
                <TableHead className="h-10 bg-muted/30">
                  <SortButton field="urgency">Action</SortButton>
                </TableHead>
                <TableHead className="h-10 bg-muted/30 text-foreground font-semibold uppercase text-[11px] tracking-wider text-right">
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
                  <TableRow key={item.productId}>
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
                    <TableCell className="text-right font-mono py-3 text-foreground">
                      {item.predictedDemand}
                    </TableCell>
                    <TableCell className="py-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`text-sm cursor-help ${
                            item.stockStatus === "OUT_OF_STOCK" || item.stockStatus === "CRITICAL"
                              ? "text-red-600 font-medium"
                              : item.stockStatus === "LOW"
                              ? "text-orange-600"
                              : ""
                          }`}>
                            {item.recommendedAction}
                          </span>
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
                      <Badge className="bg-primary hover:bg-primary/90 font-mono">
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
