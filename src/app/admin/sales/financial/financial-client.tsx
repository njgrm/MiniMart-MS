"use client";

import {
  IconCash,
  IconTrendingUp,
  IconTrendingDown,
  IconChartPie,
  IconChartBar,
  IconCalendar,
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

/**
 * FinancialBreakdownClient - Reference Dashboard Style Financial Analytics
 */
export function FinancialBreakdownClient({
  stats,
  salesData,
}: FinancialBreakdownClientProps) {
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

  // Generate daily data for the month
  const generateDailyData = () => {
    const days = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
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

      days.push({
        day: dayStr,
        revenue,
        cost,
        profit: revenue - cost,
      });
    }
    return days;
  };

  const dailyData = generateDailyData();

  // Pie chart data for cost breakdown
  const costBreakdownData = [
    { name: "Profit", value: Math.max(0, stats.month.profit), color: "hsl(var(--accent))" },
    { name: "COGS", value: stats.month.cost, color: "hsl(var(--secondary))" },
  ];

  // Payment method distribution
  const paymentMethodData = () => {
    const cashCount = salesData.transactions.filter((tx) => tx.payment_method === "CASH").length;
    const gcashCount = salesData.transactions.filter((tx) => tx.payment_method === "GCASH").length;
    
    return [
      { name: "Cash", value: cashCount, color: "hsl(var(--chart-5))" },
      { name: "GCash", value: gcashCount, color: "hsl(var(--chart-3))" },
    ];
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Top Row: Key Financial Metrics */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-sm md:grid-cols-2 xl:grid-cols-4">
        {/* Monthly Revenue */}
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Monthly Revenue</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatCurrency(stats.month.revenue)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1">
                <IconTrendingUp className="size-3" />
                {stats.month.count} sales
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Total sales revenue <IconCash className="size-4 text-accent" />
            </div>
            <div className="text-muted-foreground">
              From {stats.month.count} transactions
            </div>
          </CardFooter>
        </Card>

        {/* Cost of Goods Sold */}
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Cost of Goods Sold</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatCurrency(stats.month.cost)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 text-secondary border-secondary/30">
                <IconTrendingDown className="size-3" />
                {stats.month.revenue > 0 ? ((stats.month.cost / stats.month.revenue) * 100).toFixed(0) : 0}%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Supply costs <IconTrendingDown className="size-4 text-secondary" />
            </div>
            <div className="text-muted-foreground">
              Percentage of revenue
            </div>
          </CardFooter>
        </Card>

        {/* Gross Profit */}
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Gross Profit</CardDescription>
            <CardTitle className={`text-2xl font-semibold tabular-nums @[250px]/card:text-3xl ${stats.month.profit >= 0 ? "" : "text-destructive"}`}>
              {formatCurrency(stats.month.profit)}
            </CardTitle>
            <CardAction>
              <Badge 
                variant="outline" 
                className={`gap-1 ${stats.month.profit >= 0 ? "text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800" : "text-red-600 border-red-200 dark:text-red-400 dark:border-red-800"}`}
              >
                {stats.month.profit >= 0 ? <IconTrendingUp className="size-3" /> : <IconTrendingDown className="size-3" />}
                {calculateMargin(stats.month.profit, stats.month.revenue)}%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Net earnings {stats.month.profit >= 0 ? <IconTrendingUp className="size-4 text-emerald-500" /> : <IconTrendingDown className="size-4 text-red-500" />}
            </div>
            <div className="text-muted-foreground">
              Profit margin after COGS
            </div>
          </CardFooter>
        </Card>

        {/* Average Sale */}
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Average Sale</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatCurrency(stats.month.count > 0 ? stats.month.revenue / stats.month.count : 0)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1">
                <IconChartBar className="size-3" />
                per txn
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Transaction value <IconChartBar className="size-4 text-primary" />
            </div>
            <div className="text-muted-foreground">
              Average basket size
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* 30-Day Financial Trend Chart */}
      <Card className="@container/card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCalendar className="size-5 text-primary" />
            30-Day Financial Trend
          </CardTitle>
          <CardDescription>
            <span className="hidden @[540px]/card:block">
              Daily revenue and COGS comparison for the last 30 days
            </span>
            <span className="@[540px]/card:hidden">Last 30 days</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0.05} />
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
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Area
                  dataKey="revenue"
                  name="Revenue"
                  type="monotone"
                  fill="url(#fillRevenue)"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                />
                <Area
                  dataKey="cost"
                  name="COGS"
                  type="monotone"
                  fill="url(#fillCost)"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Row: Pie Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue vs COGS Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconChartPie className="size-5 text-accent" />
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
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconChartBar className="size-5 text-primary" />
              Payment Methods
            </CardTitle>
            <CardDescription>Transaction distribution by payment type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentMethodData()} layout="vertical">
                  <CartesianGrid horizontal={false} className="stroke-border" strokeDasharray="3 3" />
                  <XAxis type="number" className="text-xs fill-muted-foreground" tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    className="text-xs fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                    formatter={(value: number) => [`${value} transactions`, "Count"]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {paymentMethodData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today vs Monthly Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Today vs Monthly Average</CardTitle>
          <CardDescription>Performance comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-1">Today&apos;s Revenue</p>
              <p className="text-xl font-bold font-mono">{formatCurrency(stats.today.revenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.month.revenue > 0
                  ? `${((stats.today.revenue / (stats.month.revenue / 30)) * 100).toFixed(0)}% of daily avg`
                  : "No monthly data"}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-1">Today&apos;s COGS</p>
              <p className="text-xl font-bold font-mono text-secondary">{formatCurrency(stats.today.cost)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.today.revenue > 0
                  ? `${((stats.today.cost / stats.today.revenue) * 100).toFixed(1)}% of revenue`
                  : "No sales today"}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-1">Today&apos;s Profit</p>
              <p className={`text-xl font-bold font-mono ${stats.today.profit >= 0 ? "text-accent" : "text-destructive"}`}>
                {formatCurrency(stats.today.profit)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {calculateMargin(stats.today.profit, stats.today.revenue)}% margin
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
