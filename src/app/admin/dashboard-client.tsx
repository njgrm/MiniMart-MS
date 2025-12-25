"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconCash,
  IconReceipt,
  IconPackage,
  IconChartBar,
  IconClock,
  IconAlertTriangle,
  IconAlertCircle,
  IconTrophy,
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
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
}

/**
 * DashboardClient - Enhanced Dashboard with Stock Alerts, Filters & Top Products
 */
export function DashboardClient({
  stats,
  recentSales,
  inventoryMetrics,
  topProducts = [],
}: DashboardClientProps) {
  const router = useRouter();
  const [chartRange, setChartRange] = useState<"7" | "14" | "30">("7");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const calculateMargin = (profit: number, revenue: number) => {
    if (revenue === 0) return 0;
    return ((profit / revenue) * 100).toFixed(1);
  };

  // Generate chart data based on selected range
  const generateChartData = () => {
    const days = [];
    const now = new Date();
    const range = parseInt(chartRange);
    
    for (let i = range - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
      
      // Find transactions for this day
      const dayTransactions = recentSales.transactions.filter((tx) => {
        const txDate = new Date(tx.created_at);
        return (
          txDate.getDate() === date.getDate() &&
          txDate.getMonth() === date.getMonth() &&
          txDate.getFullYear() === date.getFullYear()
        );
      });

      const revenue = dayTransactions.reduce((sum, tx) => sum + tx.total_amount, 0);
      days.push({
        date: dayStr,
        revenue,
      });
    }
    return days;
  };

  const chartData = generateChartData();

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Stock Alert Cards - Clickable */}
      {(inventoryMetrics.outOfStockItems > 0 || inventoryMetrics.lowStockItems > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Critical Stock Alert */}
          {inventoryMetrics.outOfStockItems > 0 && (
            <Card
              className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all duration-200"
              onClick={() => router.push("/admin/inventory?status=out")}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="size-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                  <IconAlertTriangle className="size-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-red-800 dark:text-red-300">Critical Stock Alert</p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {inventoryMetrics.outOfStockItems} item{inventoryMetrics.outOfStockItems !== 1 ? "s" : ""} out of stock
                  </p>
                </div>
                <Badge variant="destructive" className="shrink-0">
                  {inventoryMetrics.outOfStockItems}
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* Low Stock Alert */}
          {inventoryMetrics.lowStockItems > 0 && (
            <Card
              className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all duration-200"
              onClick={() => router.push("/admin/inventory?status=low")}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="size-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                  <IconAlertCircle className="size-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-amber-800 dark:text-amber-300">Low Stock Warning</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    {inventoryMetrics.lowStockItems} item{inventoryMetrics.lowStockItems !== 1 ? "s" : ""} running low
                  </p>
                </div>
                <Badge className="bg-amber-500 text-white shrink-0">
                  {inventoryMetrics.lowStockItems}
                </Badge>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Section Cards - Reference Dashboard Style */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 gap-3 sm:gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-sm lg:grid-cols-4">
        {/* Today's Revenue Card - Emerald */}
        <Card
          className="@container/card cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all duration-200"
          onClick={() => router.push("/admin/sales/financial")}
        >
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Today&apos;s Revenue</CardDescription>
            <CardTitle className="text-lg sm:text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-emerald-600 dark:text-emerald-400">
              {formatCurrency(stats.today.revenue)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                <IconTrendingUp className="size-3" />
                <span className="hidden sm:inline">{stats.today.count} sales</span>
                <span className="sm:hidden">{stats.today.count}</span>
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 sm:gap-1.5 text-xs sm:text-sm p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="line-clamp-1 flex gap-2 font-medium">
              <span className="hidden sm:inline">{stats.today.revenue > 0 ? "Sales active today" : "No sales yet"}</span>
              <span className="sm:hidden">{stats.today.revenue > 0 ? "Active" : "No sales"}</span>
              <IconCash className="size-4 text-emerald-500" />
            </div>
            <div className="text-muted-foreground hidden sm:block">
              Revenue from {stats.today.count} transaction{stats.today.count !== 1 ? "s" : ""}
            </div>
          </CardFooter>
        </Card>

        {/* Today's Profit Card - Indigo */}
        <Card
          className="@container/card cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all duration-200"
          onClick={() => router.push("/admin/sales/financial")}
        >
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Today&apos;s Profit</CardDescription>
            <CardTitle className={`text-lg sm:text-2xl font-semibold tabular-nums @[250px]/card:text-3xl ${stats.today.profit >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-red-600 dark:text-red-400"}`}>
              {formatCurrency(stats.today.profit)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className={`gap-1 text-xs ${stats.today.profit >= 0 ? "text-indigo-600 border-indigo-200 dark:text-indigo-400 dark:border-indigo-800" : "text-red-600 border-red-200 dark:text-red-400 dark:border-red-800"}`}>
                {stats.today.profit >= 0 ? <IconTrendingUp className="size-3" /> : <IconTrendingDown className="size-3" />}
                {calculateMargin(stats.today.profit, stats.today.revenue)}%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 sm:gap-1.5 text-xs sm:text-sm p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="line-clamp-1 flex gap-2 font-medium">
              <span className="hidden sm:inline">{stats.today.profit >= 0 ? "Healthy margins" : "Review pricing"}</span>
              <span className="sm:hidden">{stats.today.profit >= 0 ? "Healthy" : "Review"}</span>
              {stats.today.profit >= 0 ? <IconTrendingUp className="size-4 text-indigo-500" /> : <IconTrendingDown className="size-4 text-red-500" />}
            </div>
            <div className="text-muted-foreground hidden sm:block">
              Net profit after COGS
            </div>
          </CardFooter>
        </Card>

        {/* Monthly Revenue Card - Emerald */}
        <Card
          className="@container/card cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all duration-200"
          onClick={() => router.push("/admin/sales/financial")}
        >
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Monthly Revenue</CardDescription>
            <CardTitle className="text-lg sm:text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-emerald-600 dark:text-emerald-400">
              {formatCurrency(stats.month.revenue)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                <IconChartBar className="size-3" />
                <span className="hidden sm:inline">{stats.month.count} sales</span>
                <span className="sm:hidden">{stats.month.count}</span>
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 sm:gap-1.5 text-xs sm:text-sm p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="line-clamp-1 flex gap-2 font-medium">
              <span className="hidden sm:inline">This month&apos;s performance</span>
              <span className="sm:hidden">This month</span>
              <IconTrendingUp className="size-4 text-emerald-500" />
            </div>
            <div className="text-muted-foreground hidden sm:block">
              {stats.month.count} total transactions
            </div>
          </CardFooter>
        </Card>

        {/* Inventory Status Card */}
        <Card
          className="@container/card cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all duration-200"
          onClick={() => router.push("/admin/inventory")}
        >
          <CardHeader className="p-4 sm:p-6">
            <CardDescription className="text-xs sm:text-sm">Inventory Value</CardDescription>
            <CardTitle className="text-lg sm:text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatCurrency(inventoryMetrics.inventoryValue)}
            </CardTitle>
            <CardAction>
              <Badge 
                variant="outline" 
                className={`gap-1 text-xs ${inventoryMetrics.outOfStockItems > 0 ? "text-red-600 border-red-200 dark:text-red-400 dark:border-red-800" : inventoryMetrics.lowStockItems > 0 ? "text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800" : "text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800"}`}
              >
                <IconPackage className="size-3" />
                <span className="hidden sm:inline">{inventoryMetrics.totalProducts} items</span>
                <span className="sm:hidden">{inventoryMetrics.totalProducts}</span>
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 sm:gap-1.5 text-xs sm:text-sm p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="line-clamp-1 flex gap-2 font-medium">
              <span className="hidden sm:inline">
                {inventoryMetrics.outOfStockItems > 0 
                  ? `${inventoryMetrics.outOfStockItems} out of stock` 
                  : inventoryMetrics.lowStockItems > 0 
                    ? `${inventoryMetrics.lowStockItems} low stock`
                    : "Stock levels healthy"}
              </span>
              <span className="sm:hidden">
                {inventoryMetrics.outOfStockItems > 0 
                  ? `${inventoryMetrics.outOfStockItems} OOS` 
                  : inventoryMetrics.lowStockItems > 0 
                    ? `${inventoryMetrics.lowStockItems} low`
                    : "Healthy"}
              </span>
              <IconPackage className={`size-4 ${inventoryMetrics.outOfStockItems > 0 ? "text-red-500" : inventoryMetrics.lowStockItems > 0 ? "text-amber-500" : "text-emerald-500"}`} />
            </div>
            <div className="text-muted-foreground hidden sm:block">
              Total retail value of inventory
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Charts Section with Date Range Picker */}
      <Card className="@container/card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>
              <span className="hidden @[540px]/card:block">
                Revenue for the last {chartRange} days
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
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} className="stroke-border" strokeDasharray="3 3" />
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
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.5rem",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  fill="url(#fillRevenue)"
                  stroke="#10b981"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Section: Recent Activity, Top Products & Quick Actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mb-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <IconReceipt className="size-5 text-primary" />
                  Recent Activity
                </CardTitle>
                <CardDescription className="text-xs">Latest transactions</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/admin/sales")}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[280px]">
              {recentSales.transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                  <IconReceipt className="size-8 mb-2 opacity-50" />
                  <p>No recent transactions</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentSales.transactions.slice(0, 6).map((tx) => (
                    <div
                      key={tx.transaction_id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/admin/sales?receipt=${tx.receipt_no}&view=true`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <IconReceipt className="size-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {tx.itemsCount} item{tx.itemsCount !== 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(tx.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium font-mono text-sm text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(tx.total_amount)}
                        </p>
                        <Badge variant="outline" className="text-[10px]">
                          {tx.payment_method || "N/A"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconTrophy className="size-5 text-amber-500" />
              Top Selling Items
            </CardTitle>
            <CardDescription className="text-xs">Best performers this month</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[280px]">
              {topProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                  <IconTrophy className="size-8 mb-2 opacity-50" />
                  <p>No sales data yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {topProducts.slice(0, 5).map((product, index) => (
                    <div
                      key={product.product_id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`size-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400" :
                          index === 1 ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" :
                          index === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate max-w-[150px]">
                            {product.product_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.quantity_sold} sold
                          </p>
                        </div>
                      </div>
                      <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(product.revenue)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* System Status & Quick Actions */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <IconClock className="size-5 text-muted-foreground" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="relative flex size-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-3 bg-emerald-500"></span>
              </span>
              <div>
                <p className="font-medium text-sm">All Systems Operational</p>
                <p className="text-xs text-muted-foreground">
                  Database connected • Sync active
                </p>
              </div>
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1.5"
                  onClick={() => router.push("/admin/pos")}
                >
                  <IconCash className="size-4" />
                  <span className="text-[10px]">New Sale</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1.5"
                  onClick={() => router.push("/admin/inventory")}
                >
                  <IconPackage className="size-4" />
                  <span className="text-[10px]">Add Product</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1.5"
                  onClick={() => router.push("/admin/sales")}
                >
                  <IconReceipt className="size-4" />
                  <span className="text-[10px]">View Sales</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1.5"
                  onClick={() => router.push("/admin/sales/financial")}
                >
                  <IconChartBar className="size-4" />
                  <span className="text-[10px]">Reports</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
