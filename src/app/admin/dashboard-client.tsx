"use client";

import { useRouter } from "next/navigation";
import {
  IconTrendingUp,
  IconTrendingDown,
  IconCash,
  IconReceipt,
  IconPackage,
  IconChartBar,
  IconClock,
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

interface DashboardClientProps {
  stats: SalesStats;
  recentSales: SalesHistoryResult;
  inventoryMetrics: InventoryMetrics;
}

/**
 * DashboardClient - Reference Dashboard Style
 * - Gradient cards from primary/5 to card
 * - Badge indicators with trends
 * - Clean typography and spacing
 */
export function DashboardClient({
  stats,
  recentSales,
  inventoryMetrics,
}: DashboardClientProps) {
  const router = useRouter();

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

  // Generate chart data from recent sales
  const generateChartData = () => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
      
      // Find transactions for this day
      const dayTransactions = recentSales.transactions.filter((tx) => {
        const txDate = new Date(tx.created_at);
        return (
          txDate.getDate() === date.getDate() &&
          txDate.getMonth() === date.getMonth()
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
      {/* Section Cards - Reference Dashboard Style */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-sm md:grid-cols-2 xl:grid-cols-4">
        {/* Today's Revenue Card */}
        <Card
          className="@container/card cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/admin/sales/financial")}
        >
          <CardHeader>
            <CardDescription>Today&apos;s Revenue</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatCurrency(stats.today.revenue)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1">
                <IconTrendingUp className="size-3" />
                {stats.today.count} sales
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {stats.today.revenue > 0 ? "Sales active today" : "No sales yet"} 
              <IconCash className="size-4 text-accent" />
            </div>
            <div className="text-muted-foreground">
              Revenue from {stats.today.count} transaction{stats.today.count !== 1 ? "s" : ""}
            </div>
          </CardFooter>
        </Card>

        {/* Today's Profit Card */}
        <Card
          className="@container/card cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/admin/sales/financial")}
        >
          <CardHeader>
            <CardDescription>Today&apos;s Profit</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatCurrency(stats.today.profit)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className={`gap-1 ${stats.today.profit >= 0 ? "text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800" : "text-red-600 border-red-200 dark:text-red-400 dark:border-red-800"}`}>
                {stats.today.profit >= 0 ? <IconTrendingUp className="size-3" /> : <IconTrendingDown className="size-3" />}
                {calculateMargin(stats.today.profit, stats.today.revenue)}%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {stats.today.profit >= 0 ? "Healthy margins" : "Review pricing"} 
              {stats.today.profit >= 0 ? <IconTrendingUp className="size-4 text-emerald-500" /> : <IconTrendingDown className="size-4 text-red-500" />}
            </div>
            <div className="text-muted-foreground">
              Net profit after COGS
            </div>
          </CardFooter>
        </Card>

        {/* Monthly Revenue Card */}
        <Card
          className="@container/card cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/admin/sales/financial")}
        >
          <CardHeader>
            <CardDescription>Monthly Revenue</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatCurrency(stats.month.revenue)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1">
                <IconChartBar className="size-3" />
                {stats.month.count} sales
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              This month&apos;s performance
              <IconTrendingUp className="size-4 text-accent" />
            </div>
            <div className="text-muted-foreground">
              {stats.month.count} total transactions
            </div>
          </CardFooter>
        </Card>

        {/* Inventory Status Card */}
        <Card
          className="@container/card cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/admin/inventory")}
        >
          <CardHeader>
            <CardDescription>Inventory Value</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatCurrency(inventoryMetrics.inventoryValue)}
            </CardTitle>
            <CardAction>
              <Badge 
                variant="outline" 
                className={`gap-1 ${inventoryMetrics.outOfStockItems > 0 ? "text-red-600 border-red-200 dark:text-red-400 dark:border-red-800" : inventoryMetrics.lowStockItems > 0 ? "text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800" : "text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800"}`}
              >
                <IconPackage className="size-3" />
                {inventoryMetrics.totalProducts} items
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {inventoryMetrics.outOfStockItems > 0 
                ? `${inventoryMetrics.outOfStockItems} out of stock` 
                : inventoryMetrics.lowStockItems > 0 
                  ? `${inventoryMetrics.lowStockItems} low stock`
                  : "Stock levels healthy"}
              <IconPackage className={`size-4 ${inventoryMetrics.outOfStockItems > 0 ? "text-red-500" : inventoryMetrics.lowStockItems > 0 ? "text-amber-500" : "text-emerald-500"}`} />
            </div>
            <div className="text-muted-foreground">
              Total retail value of inventory
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Charts Section */}
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
          <CardDescription>
            <span className="hidden @[540px]/card:block">
              Revenue for the last 7 days
            </span>
            <span className="@[540px]/card:hidden">Last 7 days</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
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
                  }}
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  fill="url(#fillRevenue)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Section: Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <IconReceipt className="size-5 text-primary" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest transactions</CardDescription>
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
            <ScrollArea className="h-[300px]">
              {recentSales.transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                  <IconReceipt className="size-8 mb-2 opacity-50" />
                  <p>No recent transactions</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentSales.transactions.slice(0, 8).map((tx) => (
                    <div
                      key={tx.transaction_id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/admin/sales?receipt=${tx.receipt_no}&view=true`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <IconReceipt className="size-5 text-primary" />
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
                        <p className="font-medium font-mono text-sm">
                          {formatCurrency(tx.total_amount)}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-xs"
                        >
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

        {/* System Status & Quick Actions */}
        <div className="flex flex-col gap-4">
          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconClock className="size-5 text-muted-foreground" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <span className="relative flex size-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-3 bg-emerald-500"></span>
                </span>
                <div>
                  <p className="font-medium">All Systems Operational</p>
                  <p className="text-sm text-muted-foreground">
                    Database connected • Real-time sync active
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => router.push("/admin/pos")}
              >
                <IconCash className="size-5" />
                <span className="text-xs">New Sale</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => router.push("/admin/inventory")}
              >
                <IconPackage className="size-5" />
                <span className="text-xs">Add Product</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => router.push("/admin/sales")}
              >
                <IconReceipt className="size-5" />
                <span className="text-xs">View Sales</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => router.push("/admin/sales/financial")}
              >
                <IconChartBar className="size-5" />
                <span className="text-xs">Reports</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
