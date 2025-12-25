"use client";

import { useState } from "react";
import {
  IconCash,
  IconTrendingUp,
  IconTrendingDown,
  IconChartPie,
  IconChartBar,
  IconCalendar,
  IconReceipt,
  IconPercentage,
} from "@tabler/icons-react";
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
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  ComposedChart,
  Line,
} from "recharts";
import type { SalesHistoryResult } from "@/actions/sales";

interface SalesStats {
  today: {
    count: number;
    revenue: number;
    cost: number;
    profit: number;
  };
  month: {
    count: number;
    revenue: number;
    cost: number;
    profit: number;
  };
}

interface FinancialBreakdownClientProps {
  stats: SalesStats;
  salesData: SalesHistoryResult;
}

// Chart colors - specific hex values for consistency
// Revenue = Emerald, Profit = Indigo
const COLORS = {
  revenue: "#10b981", // Emerald/Green
  cost: "#f43f5e",    // Rose/Red  
  profit: "#6366f1",  // Indigo/Blue
  cash: "#22c55e",    // Green
  gcash: "#3b82f6",   // Blue
};

/**
 * FinancialBreakdownClient - Financial Analytics with proper theming
 * Colors:
 * - Revenue: Emerald (#10b981)
 * - Cost: Rose (#f43f5e)
 * - Profit: Indigo (#6366f1)
 */
export function FinancialBreakdownClient({
  stats,
  salesData,
}: FinancialBreakdownClientProps) {
  const [chartRange, setChartRange] = useState<"7" | "14" | "30">("30");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const calculateMargin = (profit: number, revenue: number) => {
    if (revenue === 0) return "0.0";
    return ((profit / revenue) * 100).toFixed(1);
  };

  // Generate daily data for the selected range
  const generateDailyData = () => {
    const days = [];
    const now = new Date();
    const range = parseInt(chartRange);
    for (let i = range - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
      
      const dayTransactions = salesData.transactions.filter((tx) => {
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
      const txCount = dayTransactions.length;

      days.push({
        day: dayStr,
        revenue,
        cost,
        profit: revenue - cost,
        transactions: txCount,
      });
    }
    return days;
  };

  const dailyData = generateDailyData();
  
  // Calculate weekly performance data
  const generateWeeklyData = () => {
    const weeks = [];
    const now = new Date();
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(now.getTime() - (w * 7 + 6) * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      
      const weekTransactions = salesData.transactions.filter((tx) => {
        const txDate = new Date(tx.created_at);
        return txDate >= weekStart && txDate <= weekEnd;
      });

      const revenue = weekTransactions.reduce((sum, tx) => sum + tx.total_amount, 0);
      const cost = weekTransactions.reduce((sum, tx) => {
        return sum + tx.items.reduce((itemSum, item) => itemSum + (item.cost_at_sale * item.quantity), 0);
      }, 0);
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      weeks.push({
        week: `Week ${4 - w}`,
        revenue,
        profit,
        margin: parseFloat(margin.toFixed(1)),
      });
    }
    return weeks;
  };

  const weeklyData = generateWeeklyData();
  
  // Calculate hourly sales distribution (for peak hours analysis)
  const generateHourlyData = () => {
    const hours: { [key: number]: { count: number; revenue: number } } = {};
    for (let i = 6; i <= 22; i++) {
      hours[i] = { count: 0, revenue: 0 };
    }
    
    salesData.transactions.forEach((tx) => {
      const hour = new Date(tx.created_at).getHours();
      if (hours[hour]) {
        hours[hour].count++;
        hours[hour].revenue += tx.total_amount;
      }
    });

    return Object.entries(hours).map(([hour, data]) => ({
      hour: `${hour}:00`,
      transactions: data.count,
      revenue: data.revenue,
    }));
  };

  const hourlyData = generateHourlyData();
  
  // Calculate average basket size and daily transaction trends
  const generateDailyMetrics = () => {
    const metrics = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = date.toLocaleDateString("en-PH", { weekday: "short" });
      
      const dayTransactions = salesData.transactions.filter((tx) => {
        const txDate = new Date(tx.created_at);
        return (
          txDate.getDate() === date.getDate() &&
          txDate.getMonth() === date.getMonth() &&
          txDate.getFullYear() === date.getFullYear()
        );
      });

      const totalRevenue = dayTransactions.reduce((sum, tx) => sum + tx.total_amount, 0);
      const totalItems = dayTransactions.reduce((sum, tx) => sum + tx.itemsCount, 0);
      const avgBasket = dayTransactions.length > 0 ? totalRevenue / dayTransactions.length : 0;
      const avgItems = dayTransactions.length > 0 ? totalItems / dayTransactions.length : 0;

      metrics.push({
        day: dayStr,
        avgBasket: parseFloat(avgBasket.toFixed(0)),
        avgItems: parseFloat(avgItems.toFixed(1)),
        transactions: dayTransactions.length,
      });
    }
    return metrics;
  };

  const dailyMetrics = generateDailyMetrics();

  // Pie chart data for cost breakdown
  const costBreakdownData = [
    { name: "Profit", value: Math.max(0, stats.month.profit), color: COLORS.profit },
    { name: "COGS", value: stats.month.cost, color: COLORS.cost },
  ];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Top Row: Key Financial Metrics */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 gap-3 sm:gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-sm lg:grid-cols-4">
        {/* Monthly Revenue - Emerald */}
        <Card className="@container/card hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer">
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Monthly Revenue</CardDescription>
            <CardTitle className="text-lg sm:text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-emerald-600 dark:text-emerald-400">
              {formatCurrency(stats.month.revenue)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                <IconTrendingUp className="size-3" />
                <span className="hidden sm:inline">{stats.month.count} sales</span>
                <span className="sm:hidden">{stats.month.count}</span>
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 sm:gap-1.5 text-xs sm:text-sm p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="line-clamp-1 flex gap-2 font-medium">
              <span className="hidden sm:inline">Total sales revenue</span>
              <span className="sm:hidden">Revenue</span>
              <IconCash className="size-4 text-emerald-500" />
            </div>
            <div className="text-muted-foreground hidden sm:block">
              From {stats.month.count} transactions
            </div>
          </CardFooter>
        </Card>

        {/* Cost of Goods Sold - Rose */}
        <Card className="@container/card hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer">
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">COGS</CardDescription>
            <CardTitle className="text-lg sm:text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-rose-600 dark:text-rose-400">
              {formatCurrency(stats.month.cost)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 text-xs text-rose-600 border-rose-200 dark:text-rose-400 dark:border-rose-800">
                <IconTrendingDown className="size-3" />
                {stats.month.revenue > 0 ? ((stats.month.cost / stats.month.revenue) * 100).toFixed(0) : 0}%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 sm:gap-1.5 text-xs sm:text-sm p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="line-clamp-1 flex gap-2 font-medium">
              <span className="hidden sm:inline">Supply costs</span>
              <span className="sm:hidden">Costs</span>
              <IconTrendingDown className="size-4 text-rose-500" />
            </div>
            <div className="text-muted-foreground hidden sm:block">
              Percentage of revenue
            </div>
          </CardFooter>
        </Card>

        {/* Gross Profit - Indigo */}
        <Card className="@container/card hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer">
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Gross Profit</CardDescription>
            <CardTitle className={`text-lg sm:text-2xl font-semibold tabular-nums @[250px]/card:text-3xl ${stats.month.profit >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-red-600 dark:text-red-400"}`}>
              {formatCurrency(stats.month.profit)}
            </CardTitle>
            <CardAction>
              <Badge 
                variant="outline" 
                className={`gap-1 text-xs ${stats.month.profit >= 0 ? "text-indigo-600 border-indigo-200 dark:text-indigo-400 dark:border-indigo-800" : "text-red-600 border-red-200 dark:text-red-400 dark:border-red-800"}`}
              >
                {stats.month.profit >= 0 ? <IconTrendingUp className="size-3" /> : <IconTrendingDown className="size-3" />}
                {calculateMargin(stats.month.profit, stats.month.revenue)}%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 sm:gap-1.5 text-xs sm:text-sm p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="line-clamp-1 flex gap-2 font-medium">
              <span className="hidden sm:inline">Net earnings</span>
              <span className="sm:hidden">Profit</span>
              {stats.month.profit >= 0 ? <IconTrendingUp className="size-4 text-indigo-500" /> : <IconTrendingDown className="size-4 text-red-500" />}
            </div>
            <div className="text-muted-foreground hidden sm:block">
              Profit margin after COGS
            </div>
          </CardFooter>
        </Card>

        {/* Average Sale */}
        <Card className="@container/card hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer">
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Avg Sale</CardDescription>
            <CardTitle className="text-lg sm:text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatCurrency(stats.month.count > 0 ? stats.month.revenue / stats.month.count : 0)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 text-xs">
                <IconChartBar className="size-3" />
                <span className="hidden sm:inline">per txn</span>
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 sm:gap-1.5 text-xs sm:text-sm p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="line-clamp-1 flex gap-2 font-medium">
              <span className="hidden sm:inline">Transaction value</span>
              <span className="sm:hidden">Per sale</span>
              <IconChartBar className="size-4 text-primary" />
            </div>
            <div className="text-muted-foreground hidden sm:block">
              Average basket size
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Financial Trend Chart with Date Range Picker */}
      <Card className="@container/card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconCalendar className="size-5 text-primary" />
              Financial Trend
            </CardTitle>
            <CardDescription>
              <span className="hidden @[540px]/card:block">
                Daily revenue, COGS, and profit comparison for the last {chartRange} days
              </span>
              <span className="@[540px]/card:hidden">Last {chartRange} days</span>
            </CardDescription>
          </div>
          <Select value={chartRange} onValueChange={(v) => setChartRange(v as "7" | "14" | "30")}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.revenue} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.revenue} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.cost} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.cost} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.profit} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.profit} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} className="stroke-border" strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs fill-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs fill-muted-foreground"
                  tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.5rem",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Area
                  dataKey="revenue"
                  name="Revenue"
                  type="monotone"
                  fill="url(#fillRevenue)"
                  stroke={COLORS.revenue}
                  strokeWidth={2}
                />
                <Area
                  dataKey="cost"
                  name="COGS"
                  type="monotone"
                  fill="url(#fillCost)"
                  stroke={COLORS.cost}
                  strokeWidth={2}
                />
                <Area
                  dataKey="profit"
                  name="Profit"
                  type="monotone"
                  fill="url(#fillProfit)"
                  stroke={COLORS.profit}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Performance & Peak Hours */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Weekly Performance Chart */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconChartBar className="size-5 text-indigo-500" />
              Weekly Performance
            </CardTitle>
            <CardDescription>Revenue and profit by week with margin trend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weeklyData}>
                  <CartesianGrid vertical={false} className="stroke-border" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="week"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs fill-muted-foreground"
                  />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs fill-muted-foreground"
                    tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs fill-muted-foreground"
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.5rem",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === "margin") return [`${value}%`, "Margin"];
                      return [formatCurrency(value), name];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill={COLORS.revenue} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="profit" name="Profit" fill={COLORS.profit} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="margin" name="Margin %" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Peak Hours Analysis */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconReceipt className="size-5 text-primary" />
              Peak Hours Analysis
            </CardTitle>
            <CardDescription>Transaction volume by hour of day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid vertical={false} className="stroke-border" strokeDasharray="3 3" />
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
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.5rem",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === "transactions") return [value, "Transactions"];
                      return [formatCurrency(value), "Revenue"];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="transactions" name="Transactions" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pie Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue vs COGS Pie Chart */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconChartPie className="size-5 text-emerald-500" />
              Profit Breakdown
            </CardTitle>
            <CardDescription>Revenue allocation this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={costBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {costBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.5rem",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily Basket Size & Transaction Volume */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconPercentage className="size-5 text-amber-500" />
              Daily Sales Patterns
            </CardTitle>
            <CardDescription>Average basket size and transaction count (last 7 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyMetrics}>
                  <CartesianGrid vertical={false} className="stroke-border" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs fill-muted-foreground"
                  />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs fill-muted-foreground"
                    tickFormatter={(value) => `₱${value}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs fill-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.5rem",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === "avgBasket") return [formatCurrency(value), "Avg Basket"];
                      if (name === "transactions") return [value, "Transactions"];
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="right" dataKey="transactions" name="Transactions" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="left" type="monotone" dataKey="avgBasket" name="Avg Basket" stroke="#f59e0b" strokeWidth={3} dot={{ fill: "#f59e0b", r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today vs Monthly Comparison */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Today vs Monthly Average</CardTitle>
          <CardDescription>Performance comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-1">Today&apos;s Revenue</p>
              <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.today.revenue)}</p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">
                {stats.month.revenue > 0
                  ? `${((stats.today.revenue / (stats.month.revenue / 30)) * 100).toFixed(0)}% of daily avg`
                  : "No monthly data"}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
              <p className="text-sm text-rose-700 dark:text-rose-300 mb-1">Today&apos;s COGS</p>
              <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">{formatCurrency(stats.today.cost)}</p>
              <p className="text-xs text-rose-600/70 dark:text-rose-400/70 mt-1">
                {stats.today.revenue > 0
                  ? `${((stats.today.cost / stats.today.revenue) * 100).toFixed(1)}% of revenue`
                  : "No sales today"}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
              <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-1">Today&apos;s Profit</p>
              <p className={`text-xl font-bold font-mono ${stats.today.profit >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-red-600 dark:text-red-400"}`}>
                {formatCurrency(stats.today.profit)}
              </p>
              <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-1">
                {calculateMargin(stats.today.profit, stats.today.revenue)}% margin
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
