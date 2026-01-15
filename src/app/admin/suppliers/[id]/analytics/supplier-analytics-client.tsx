"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building2,
  TrendingUp,
  TrendingDown,
  Package,
  Undo2,
  DollarSign,
  Truck,
  Calendar,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { type SingleSupplierAnalyticsResult } from "@/actions/reports";

interface SupplierAnalyticsClientProps {
  data: SingleSupplierAnalyticsResult;
}

// Helper: Format peso
function formatPeso(amount: number) {
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Status badge config
const statusConfig = {
  excellent: { label: "Excellent", icon: CheckCircle2, badgeClass: "bg-[#e6f7fa] text-[#2EAFC5] border-[#2EAFC5]/30" },
  good: { label: "Good", icon: CheckCircle2, badgeClass: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  warning: { label: "Warning", icon: AlertTriangle, badgeClass: "bg-[#fef3eb] text-[#F1782F] border-[#F1782F]/30" },
  critical: { label: "Critical", icon: XCircle, badgeClass: "bg-red-50 text-[#AC0F16] border-red-200" },
};

export function SupplierAnalyticsClient({ data }: SupplierAnalyticsClientProps) {
  const [chartTab, setChartTab] = useState<"deliveries" | "returns" | "cost">("deliveries");
  const { supplier, stats, deliveryTrend, returnTrend, costTrend, recentDeliveries, recentReturns, topProducts } = data;
  const statusInfo = statusConfig[stats.status];
  const StatusIcon = statusInfo.icon;

  // Combine trends for dual-axis chart
  const combinedTrend = deliveryTrend.map((d) => {
    const returnPoint = returnTrend.find((r) => r.date === d.date);
    const costPoint = costTrend.find((c) => c.date === d.date);
    return {
      date: d.date,
      deliveryUnits: d.units,
      deliveryValue: d.value,
      returnUnits: returnPoint?.units || 0,
      returnValue: returnPoint?.value || 0,
      avgCost: costPoint?.avgCost || 0,
    };
  });

  // Fill in any return dates not in deliveries
  for (const r of returnTrend) {
    if (!combinedTrend.find((c) => c.date === r.date)) {
      const costPoint = costTrend.find((c) => c.date === r.date);
      combinedTrend.push({
        date: r.date,
        deliveryUnits: 0,
        deliveryValue: 0,
        returnUnits: r.units,
        returnValue: r.value,
        avgCost: costPoint?.avgCost || 0,
      });
    }
  }

  combinedTrend.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/admin/suppliers/${supplier.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#2d1b1a] flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-[#AC0F16]" />
                {supplier.name} Analytics
              </h1>
              <Badge variant="outline" className={statusInfo.badgeClass}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Performance analytics for the past 12 months
            </p>
          </div>
        </div>
        <Link href={`/admin/suppliers/${supplier.id}`}>
          <Button variant="outline">
            <Building2 className="h-4 w-4 mr-2" />
            View Details
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Deliveries</p>
                <p className="text-2xl font-bold text-[#2d1b1a]">{stats.total_deliveries}</p>
                <p className="text-sm text-muted-foreground">{stats.total_units_delivered.toLocaleString()} units</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-[#e6f7fa] flex items-center justify-center">
                <Truck className="h-5 w-5 text-[#2EAFC5]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Delivery Value</p>
                <p className="text-2xl font-bold text-[#2d1b1a]">{formatPeso(stats.total_delivery_value)}</p>
                <p className="text-sm text-muted-foreground">Avg {formatPeso(stats.avg_delivery_size * (stats.total_delivery_value / stats.total_units_delivered || 0))}/batch</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Returns</p>
                <p className="text-2xl font-bold text-[#2d1b1a]">{stats.total_returns}</p>
                <p className="text-sm text-muted-foreground">{stats.total_units_returned.toLocaleString()} units</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-[#fef3eb] flex items-center justify-center">
                <Undo2 className="h-5 w-5 text-[#F1782F]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Return Rate</p>
                <p className="text-2xl font-bold text-[#2d1b1a]">{stats.return_rate.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">{formatPeso(stats.total_return_value)} returned</p>
              </div>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                stats.return_rate <= 5 ? "bg-emerald-50" : stats.return_rate <= 10 ? "bg-[#fef3eb]" : "bg-red-50"
              }`}>
                {stats.return_rate <= 5 ? (
                  <TrendingDown className="h-5 w-5 text-emerald-600" />
                ) : (
                  <TrendingUp className={`h-5 w-5 ${stats.return_rate <= 10 ? "text-[#F1782F]" : "text-[#AC0F16]"}`} />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#2EAFC5]" />
                Performance Trends
              </CardTitle>
              <CardDescription>Monthly delivery and return trends</CardDescription>
            </div>
            <Tabs value={chartTab} onValueChange={(v) => setChartTab(v as typeof chartTab)}>
              <TabsList className="h-8">
                <TabsTrigger value="deliveries" className="text-xs px-3">Deliveries</TabsTrigger>
                <TabsTrigger value="returns" className="text-xs px-3">Returns</TabsTrigger>
                <TabsTrigger value="cost" className="text-xs px-3">Cost Trend</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartTab === "deliveries" ? (
                <AreaChart data={combinedTrend}>
                  <defs>
                    <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2EAFC5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2EAFC5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" fontSize={12} tickMargin={8} />
                  <YAxis fontSize={12} tickMargin={8} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}
                    formatter={(value: number) => [value.toLocaleString(), ""]}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="deliveryUnits"
                    name="Units Delivered"
                    stroke="#2EAFC5"
                    fill="url(#deliveryGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              ) : chartTab === "returns" ? (
                <BarChart data={combinedTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" fontSize={12} tickMargin={8} />
                  <YAxis fontSize={12} tickMargin={8} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}
                    formatter={(value: number) => [value.toLocaleString(), ""]}
                  />
                  <Legend />
                  <Bar dataKey="returnUnits" name="Units Returned" fill="#F1782F" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={combinedTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" fontSize={12} tickMargin={8} />
                  <YAxis fontSize={12} tickMargin={8} tickFormatter={(v) => `₱${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}
                    formatter={(value: number) => [formatPeso(value), "Avg Cost"]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avgCost"
                    name="Avg Cost/Unit"
                    stroke="#AC0F16"
                    strokeWidth={2}
                    dot={{ fill: "#AC0F16", strokeWidth: 2 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-[#2EAFC5]" />
              Top Products by Value
            </CardTitle>
            <CardDescription>Most supplied products from this supplier</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No deliveries in this period
                    </TableCell>
                  </TableRow>
                ) : (
                  topProducts.map((product) => (
                    <TableRow key={product.product_id}>
                      <TableCell className="font-medium">
                        <div>
                          <p className="text-sm">{product.product_name}</p>
                          <p className="text-xs text-muted-foreground">{product.delivery_count} deliveries</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {product.total_units.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPeso(product.total_value)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Deliveries */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4 text-[#2EAFC5]" />
              Recent Deliveries
            </CardTitle>
            <CardDescription>Latest batch deliveries from this supplier</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDeliveries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No recent deliveries
                    </TableCell>
                  </TableRow>
                ) : (
                  recentDeliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{d.product_name}</p>
                          {d.batch_number && (
                            <p className="text-xs text-muted-foreground">Batch: {d.batch_number}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {d.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {format(new Date(d.received_date), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Recent Returns */}
      {recentReturns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Undo2 className="h-4 w-4 text-[#F1782F]" />
              Recent Returns
            </CardTitle>
            <CardDescription>Products returned to this supplier</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentReturns.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">{r.product_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {r.reason || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {r.quantity.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(new Date(r.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
