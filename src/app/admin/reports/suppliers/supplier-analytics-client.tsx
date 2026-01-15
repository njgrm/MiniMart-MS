"use client";

import { useState, useMemo, useTransition } from "react";
import { format, subDays, subMonths } from "date-fns";
import { DateRange } from "react-day-picker";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  SortingState,
  flexRender,
} from "@tanstack/react-table";
import {
  Building2,
  Package,
  Undo2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Search,
  ExternalLink,
  DollarSign,
  BarChart3,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  ReportShell,
  SortableHeader,
} from "@/components/reports/report-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTablePagination } from "@/components/data-table-pagination";
import { DateRangePickerWithPresets } from "@/components/ui/date-range-picker-with-presets";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  getSupplierAnalytics,
  type SupplierAnalyticsResult,
  type SupplierAnalyticsItem,
} from "@/actions/reports";
import {
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
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

// Helper function for normal weight peso sign
function formatPeso(amount: number): React.ReactNode {
  return (
    <>
      <span className="font-normal">₱</span>
      {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </>
  );
}

// Design system CompactCard with trend support
interface CompactCardProps {
  label: string;
  value: string | React.ReactNode;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
  variant?: "default" | "success" | "warning" | "danger";
}

function CompactCard({ label, value, subtitle, icon: Icon, trend, variant = "default" }: CompactCardProps) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-[#2EAFC5]",
    warning: "text-[#F1782F]",
    danger: "text-[#AC0F16]",
  };

  return (
    <Card className="bg-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${variantStyles[variant]}`} />
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs ${trend.value >= 0 ? "text-[#2EAFC5]" : "text-[#AC0F16]"}`}>
              {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{trend.value >= 0 ? "+" : ""}{trend.value.toFixed(1)}%</span>
            </div>
          )}
        </div>
        <p className={`text-2xl font-bold font-mono tabular-nums mt-2 ${variantStyles[variant]}`}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// Status configuration
const statusConfig: Record<
  SupplierAnalyticsItem["status"],
  { label: string; color: string; icon: React.ElementType; badgeClass: string }
> = {
  excellent: {
    label: "Excellent",
    color: "text-[#2EAFC5]",
    icon: CheckCircle2,
    badgeClass: "bg-[#e6f7fa] text-[#2EAFC5] border-[#2EAFC5]/30",
  },
  good: {
    label: "Good",
    color: "text-blue-600",
    icon: CheckCircle2,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  warning: {
    label: "Warning",
    color: "text-[#F1782F]",
    icon: AlertTriangle,
    badgeClass: "bg-[#fef3eb] text-[#F1782F] border-[#F1782F]/30",
  },
  critical: {
    label: "Critical",
    color: "text-[#AC0F16]",
    icon: AlertTriangle,
    badgeClass: "bg-red-50 text-[#AC0F16] border-red-200",
  },
};

interface SupplierAnalyticsClientProps {
  initialData: SupplierAnalyticsResult;
}

export function SupplierAnalyticsClient({ initialData }: SupplierAnalyticsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<SupplierAnalyticsResult>(initialData);
  const [searchQuery, setSearchQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "total_delivery_value", desc: true }]);
  const [activeChart, setActiveChart] = useState<"deliveries" | "returns" | "cost">("deliveries");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 12),
    to: new Date(),
  });

  const handleDateChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      startTransition(async () => {
        const result = await getSupplierAnalytics({ from: range.from!, to: range.to! });
        setData(result);
      });
    }
  };

  // Filter suppliers by search
  const filteredSuppliers = useMemo(() => {
    if (!searchQuery) return data.suppliers;
    const query = searchQuery.toLowerCase();
    return data.suppliers.filter((s) =>
      s.supplier_name.toLowerCase().includes(query)
    );
  }, [data.suppliers, searchQuery]);

  // Column definitions for supplier table
  const columns: ColumnDef<SupplierAnalyticsItem>[] = useMemo(() => [
    {
      accessorKey: "supplier_name",
      header: ({ column }) => <SortableHeader column={column}>Supplier</SortableHeader>,
      cell: ({ row }) => (
        <Link
          href={`/admin/suppliers/${row.original.supplier_id}`}
          className="font-medium text-foreground hover:text-[#AC0F16] hover:underline flex items-center gap-1"
        >
          {row.original.supplier_name}
          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50" />
        </Link>
      ),
    },
    {
      accessorKey: "total_deliveries",
      header: ({ column }) => <SortableHeader column={column} className="justify-center">Deliveries</SortableHeader>,
      cell: ({ row }) => (
        <div className="text-center font-mono text-sm">
          {row.original.total_deliveries}
        </div>
      ),
    },
    {
      accessorKey: "total_delivery_value",
      header: ({ column }) => <SortableHeader column={column} className="justify-end">Delivery Value</SortableHeader>,
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm">
          {formatPeso(row.original.total_delivery_value)}
        </div>
      ),
    },
    {
      accessorKey: "total_returns",
      header: ({ column }) => <SortableHeader column={column} className="justify-center">Returns</SortableHeader>,
      cell: ({ row }) => (
        <div className={cn(
          "text-center font-mono text-sm",
          row.original.total_returns > 0 && "text-[#F1782F]"
        )}>
          {row.original.total_returns}
        </div>
      ),
    },
    {
      accessorKey: "return_rate",
      header: ({ column }) => <SortableHeader column={column} className="justify-center">Return Rate</SortableHeader>,
      cell: ({ row }) => {
        const rate = row.original.return_rate;
        return (
          <div className="flex items-center gap-2 justify-center">
            <Progress 
              value={Math.min(rate * 5, 100)} 
              className="w-16 h-2"
            />
            <span className={cn(
              "font-mono text-sm",
              rate > 10 ? "text-[#AC0F16]" :
              rate > 5 ? "text-[#F1782F]" :
              "text-[#2EAFC5]"
            )}>
              {rate.toFixed(1)}%
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const config = statusConfig[row.original.status];
        const StatusIcon = config.icon;
        return (
          <Badge variant="outline" className={cn("text-xs", config.badgeClass)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "last_delivery_date",
      header: ({ column }) => <SortableHeader column={column}>Last Delivery</SortableHeader>,
      cell: ({ row }) => (
        row.original.last_delivery_date ? (
          <span className="text-sm font-mono">
            {format(new Date(row.original.last_delivery_date), "MMM d, yyyy")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )
      ),
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.last_delivery_date;
        const b = rowB.original.last_delivery_date;
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        return new Date(a).getTime() - new Date(b).getTime();
      },
    },
  ], []);

  const table = useReactTable({
    data: filteredSuppliers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  // Chart data based on active selection
  const chartData = useMemo(() => {
    if (activeChart === "deliveries") {
      return data.deliveryTrend.map((d) => ({
        date: format(new Date(d.date + "-01"), "MMM yy"),
        deliveries: d.deliveries,
        value: d.value,
      }));
    } else if (activeChart === "returns") {
      return data.returnTrend.map((r) => ({
        date: format(new Date(r.date + "-01"), "MMM yy"),
        returns: r.returns,
        value: r.value,
      }));
    } else {
      return data.costTrend.map((c) => ({
        date: format(new Date(c.date + "-01"), "MMM yy"),
        avgCost: c.avgCost,
      }));
    }
  }, [data, activeChart]);

  // Excel export configuration
  const excelExport = {
    filename: "supplier_analytics_report",
    sheetName: "Supplier Analytics",
    getData: async () => ({
      columns: [
        { header: "Supplier", key: "supplier_name", width: 30 },
        { header: "Deliveries", key: "total_deliveries", width: 12 },
        { header: "Delivery Value", key: "total_delivery_value", width: 15 },
        { header: "Returns", key: "total_returns", width: 10 },
        { header: "Return Value", key: "total_return_value", width: 15 },
        { header: "Return Rate %", key: "return_rate", width: 12 },
        { header: "Avg Delivery Size", key: "avg_delivery_size", width: 15 },
        { header: "Status", key: "status", width: 12 },
        { header: "Last Delivery", key: "last_delivery_date", width: 15 },
      ],
      rows: filteredSuppliers.map((s) => ({
        supplier_name: s.supplier_name,
        total_deliveries: s.total_deliveries,
        total_delivery_value: s.total_delivery_value,
        total_returns: s.total_returns,
        total_return_value: s.total_return_value,
        return_rate: s.return_rate.toFixed(2),
        avg_delivery_size: Math.round(s.avg_delivery_size),
        status: s.status,
        last_delivery_date: s.last_delivery_date ? format(new Date(s.last_delivery_date), "yyyy-MM-dd") : "",
      })),
    }),
  };

  // Print table data
  const printTableData = useMemo(() => {
    const headers = ["Supplier", "Deliveries", "Value", "Returns", "Return Rate", "Status"];
    const rows = filteredSuppliers.map(s => [
      s.supplier_name,
      s.total_deliveries.toString(),
      `₱${s.total_delivery_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      s.total_returns.toString(),
      `${s.return_rate.toFixed(1)}%`,
      statusConfig[s.status].label,
    ]);
    return { headers, rows };
  }, [filteredSuppliers]);

  // Print summary
  const printSummary = [
    { label: "Total Suppliers", value: data.summary.total_suppliers.toString() },
    { label: "Total Deliveries", value: data.summary.total_deliveries.toLocaleString() },
    { label: "Total Delivery Value", value: `₱${data.summary.total_delivery_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
    { label: "Overall Return Rate", value: `${data.summary.overall_return_rate.toFixed(1)}%` },
  ];

  return (
    <ReportShell
      title="Supplier Analytics"
      description="Analyze supplier performance, deliveries, and return rates."
      icon={Building2}
      dateRange={dateRange?.from && dateRange?.to ? { from: dateRange.from, to: dateRange.to } : undefined}
      generatedBy="Admin"
      excelExport={excelExport}
      printSummary={printSummary}
      printTableData={printTableData}
      toolbarFilters={
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-[150px] max-w-[300px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
      }
      toolbarContent={
        <DateRangePickerWithPresets
          date={dateRange}
          onDateChange={handleDateChange}
          align="end"
        />
      }
    >
      {/* Summary Cards */}
      <LoadingOverlay isLoading={isPending}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <CompactCard
            label="Active Suppliers"
            value={data.summary.total_suppliers.toString()}
            subtitle={`${data.summary.suppliers_with_high_returns} with high return rates`}
            icon={Building2}
            variant={data.summary.suppliers_with_high_returns > 0 ? "warning" : "success"}
          />
          <CompactCard
            label="Total Deliveries"
            value={data.summary.total_deliveries.toLocaleString()}
            subtitle={`Avg ${formatPeso(data.summary.avg_delivery_value)}/delivery`}
            icon={Package}
            variant="success"
          />
          <CompactCard
            label="Total Delivery Value"
            value={formatPeso(data.summary.total_delivery_value)}
            subtitle="All supplier transactions"
            icon={DollarSign}
          />
          <CompactCard
            label="Total Returns"
            value={data.summary.total_returns.toLocaleString()}
            subtitle={`${data.summary.overall_return_rate.toFixed(1)}% return rate`}
            icon={Undo2}
            variant={data.summary.overall_return_rate > 5 ? "danger" : data.summary.overall_return_rate > 2 ? "warning" : "default"}
          />
        </div>
      </LoadingOverlay>

      {/* Charts Section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Trends Over Time</CardTitle>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              <button
                onClick={() => setActiveChart("deliveries")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  activeChart === "deliveries"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Package className="h-3.5 w-3.5 inline mr-1" />
                Deliveries
              </button>
              <button
                onClick={() => setActiveChart("returns")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  activeChart === "returns"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Undo2 className="h-3.5 w-3.5 inline mr-1" />
                Returns
              </button>
              <button
                onClick={() => setActiveChart("cost")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  activeChart === "cost"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <TrendingUp className="h-3.5 w-3.5 inline mr-1" />
                Avg Cost
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {activeChart === "deliveries" ? (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2EAFC5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2EAFC5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#78716c" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#78716c" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e5e5",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="deliveries"
                    name="Deliveries"
                    stroke="#2EAFC5"
                    fill="url(#deliveryGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              ) : activeChart === "returns" ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#78716c" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#78716c" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e5e5",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar 
                    dataKey="returns" 
                    name="Returns"
                    fill="#F1782F" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#78716c" />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    stroke="#78716c"
                    tickFormatter={(v) => `₱${v.toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e5e5",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`₱${value.toFixed(2)}`, "Avg Cost"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgCost"
                    name="Avg Cost/Unit"
                    stroke="#AC0F16"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Supplier Table */}
      <LoadingOverlay isLoading={isPending}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Supplier Performance</CardTitle>
            <CardDescription>
              {filteredSuppliers.length} suppliers found • Sorted by delivery value
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-card overflow-hidden print:border-gray-300">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="bg-muted/50 print:bg-gray-100 hover:bg-muted/50">
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide h-10">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Building2 className="h-8 w-8 text-muted-foreground/50" />
                          <p>No suppliers found for this period.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} className="group">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4">
              <DataTablePagination table={table} />
            </div>
          </CardContent>
        </Card>
      </LoadingOverlay>
    </ReportShell>
  );
}
