"use client";

import { useState, useMemo, useTransition } from "react";
import { subDays } from "date-fns";
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
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Search,
  Filter,
  Percent,
  AlertCircle,
  CheckCircle,
  Boxes,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ReportShell,
  SortableHeader,
} from "@/components/reports/report-shell";
import { DataTablePagination } from "@/components/data-table-pagination";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Progress } from "@/components/ui/progress";
import { getMarginAnalysis, type MarginReportResult, type MarginItem } from "@/actions/reports";
import { cn } from "@/lib/utils";

interface ProfitMarginClientProps {
  data: MarginReportResult;
}

// Helper: Format category names (SOFTDRINKS_CASE -> Softdrinks Case)
function formatCategoryName(name: string): string {
  return name
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Helper: Format peso with normal weight sign (returns JSX)
function formatPeso(amount: number, options?: { decimals?: number; className?: string }) {
  const decimals = options?.decimals ?? 2;
  const formatted = amount.toLocaleString(undefined, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
  return (
    <span className={options?.className}>
      <span className="font-normal">₱</span>{formatted}
    </span>
  );
}

// Compact Summary Card Component
interface CompactCardProps {
  label: string;
  value: string | number | React.ReactNode;
  subtitle?: string;
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
}

function CompactCard({ label, value, subtitle, icon: Icon, variant = "default" }: CompactCardProps) {
  const variantStyles = {
    default: { bg: "bg-card border-stone-200/80", iconBg: "bg-stone-100 text-stone-600", value: "text-foreground" },
    success: { bg: "bg-[#2EAFC5]/5 border-[#2EAFC5]/20", iconBg: "bg-[#2EAFC5]/10 text-[#2EAFC5]", value: "text-[#2EAFC5]" },
    warning: { bg: "bg-[#F1782F]/5 border-[#F1782F]/20", iconBg: "bg-[#F1782F]/10 text-[#F1782F]", value: "text-[#F1782F]" },
    danger: { bg: "bg-[#AC0F16]/5 border-[#AC0F16]/20", iconBg: "bg-[#AC0F16]/10 text-[#AC0F16]", value: "text-[#AC0F16]" },
  };
  const styles = variantStyles[variant];

  return (
    <Card className={cn("border shadow-sm h-full", styles.bg)}>
      <CardContent className="p-3 py-4 h-full flex flex-col">
        <div className="flex items-start gap-2">
          <div className={cn("p-1.5 rounded-lg", styles.iconBg)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
              {label}
            </p>
            <p className={cn("text-xl font-bold tabular-nums font-mono", styles.value)}>
              {value}
            </p>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Design system colors from AGENTS.md
// Success: #2EAFC5 (Teal), Warning: #F1782F (Orange), Danger: #AC0F16 (Red)
const statusConfig: Record<
  MarginItem["status"],
  { label: string; icon: React.ElementType; badgeClass: string; order: number }
> = {
  negative: {
    label: "Negative",
    icon: AlertCircle,
    badgeClass: "bg-red-50 text-[#AC0F16] border-red-200",
    order: 0,
  },
  low: {
    label: "Low",
    icon: AlertTriangle,
    badgeClass: "bg-[#fef3eb] text-[#F1782F] border-[#F1782F]/30",
    order: 1,
  },
  moderate: {
    label: "Moderate",
    icon: TrendingUp,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    order: 2,
  },
  healthy: {
    label: "Healthy",
    icon: CheckCircle,
    badgeClass: "bg-[#e6f7fa] text-[#2EAFC5] border-[#2EAFC5]/30",
    order: 3,
  },
};

export function ProfitMarginClient({ data: initialData }: ProfitMarginClientProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<MarginReportResult>(initialData);
  // Default sort: margin_percent ascending to show problems first
  const [sorting, setSorting] = useState<SortingState>([
    { id: "margin_percent", desc: false },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const handleDateChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      startTransition(async () => {
        const result = await getMarginAnalysis({ from: range.from!, to: range.to! });
        setData(result);
      });
    }
  };

  // Get unique categories
  const categories = useMemo(
    () => Array.from(new Set(data.items.map((i) => i.category))).sort(),
    [data.items]
  );

  // Filter items
  const filteredData = useMemo(() => {
    return data.items.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      return matchesStatus && matchesCategory;
    });
  }, [data.items, statusFilter, categoryFilter]);

  // Define columns for Tanstack Table
  const columns: ColumnDef<MarginItem>[] = useMemo(
    () => [
      {
        accessorKey: "product_name",
        header: () => (
          <div className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
            Product
          </div>
        ),
        cell: ({ row }) => (
          <div className="max-w-[200px]">
            <Link 
              href={`/admin/inventory/${row.original.product_id}`}
              className="font-medium text-foreground hover:text-primary hover:underline block truncate"
              title={row.original.product_name}
            >
              {row.original.product_name}
            </Link>
            <p className="text-xs text-muted-foreground truncate">
              {formatCategoryName(row.original.category)}
              {row.original.barcode && ` • ${row.original.barcode}`}
            </p>
          </div>
        ),
        filterFn: (row, _, value) => {
          const item = row.original;
          const searchLower = value.toLowerCase();
          return (
            item.product_name.toLowerCase().includes(searchLower) ||
            item.category.toLowerCase().includes(searchLower) ||
            (item.barcode?.toLowerCase().includes(searchLower) ?? false)
          );
        },
        size: 200,
      },
      {
        accessorKey: "cost_price",
        header: ({ column }) => (
          <SortableHeader column={column}>
            <DollarSign className="h-3.5 w-3.5" />
            Cost
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="font-mono tabular-nums text-sm">
            {formatPeso(row.original.cost_price)}
          </div>
        ),
        size: 100,
      },
      {
        accessorKey: "retail_price",
        header: ({ column }) => (
          <SortableHeader column={column}>
            <DollarSign className="h-3.5 w-3.5" />
            Price
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="font-mono tabular-nums text-sm">
            {formatPeso(row.original.retail_price)}
          </div>
        ),
        size: 100,
      },
      {
        accessorKey: "margin_percent",
        header: ({ column }) => (
          <SortableHeader column={column}>
            <Percent className="h-3.5 w-3.5" />
            Margin
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const margin = row.original.margin_percent;
          // Determine indicator color based on margin
          const indicatorColor = margin < 0
            ? "bg-[#AC0F16]"
            : margin < 10
            ? "bg-[#F1782F]"
            : margin < 25
            ? "bg-blue-500"
            : "bg-[#2EAFC5]";
          return (
            <div className="flex items-center gap-2">
              <Progress
                value={Math.max(0, Math.min(100, margin))}
                className="w-16 h-2 bg-stone-200"
                indicatorClassName={indicatorColor}
              />
              <span
                className={`font-mono tabular-nums font-medium ${
                  margin < 0
                    ? "text-[#AC0F16]"
                    : margin < 10
                    ? "text-[#F1782F]"
                    : margin < 25
                    ? "text-blue-600"
                    : "text-[#2EAFC5]"
                }`}
              >
                {margin.toFixed(1)}%
              </span>
            </div>
          );
        },
        size: 140,
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <SortableHeader column={column}>
            Status
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const config = statusConfig[row.original.status];
          const StatusIcon = config.icon;
          return (
            <Badge variant="outline" className={config.badgeClass}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
          );
        },
        sortingFn: (rowA, rowB) => {
          return statusConfig[rowA.original.status].order - statusConfig[rowB.original.status].order;
        },
        size: 120,
      },
      {
        accessorKey: "units_sold_30d",
        header: () => (
          <span className="uppercase text-[11px] font-semibold tracking-wider text-foreground">
            Sold
          </span>
        ),
        cell: ({ row }) => (
          <div className="font-mono tabular-nums text-sm">{row.original.units_sold_30d.toLocaleString()}</div>
        ),
        size: 90,
      },
      {
        accessorKey: "total_profit_30d",
        header: ({ column }) => (
          <SortableHeader column={column}>
            Profit
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const profit = row.original.total_profit_30d;
          return (
            <div className={cn("font-mono tabular-nums font-medium text-sm", profit < 0 ? "text-[#AC0F16]" : "text-[#2EAFC5]")}>
              {formatPeso(profit)}
            </div>
          );
        },
        size: 130,
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _, value) => {
      const item = row.original;
      const searchLower = value.toLowerCase();
      return (
        item.product_name.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower) ||
        (item.barcode?.toLowerCase().includes(searchLower) ?? false)
      );
    },
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  // Print table data - ALL rows for print preview
  const printTableData = useMemo(() => {
    const headers = ["Product", "Category", "Cost", "Price", "Margin %", "Status", "Sold", "Profit"];
    const rows = filteredData.map(item => [
      item.product_name,
      formatCategoryName(item.category),
      `₱${item.cost_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `₱${item.retail_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `${item.margin_percent.toFixed(1)}%`,
      statusConfig[item.status].label,
      item.units_sold_30d.toLocaleString(),
      `₱${item.total_profit_30d.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    ]);
    return { headers, rows };
  }, [filteredData]);

  // Excel export configuration
  const excelExport = {
    filename: "profit_margin_analysis",
    sheetName: "Margin Analysis",
    getData: async () => ({
      columns: [
        { header: "Product", key: "product_name", width: 30 },
        { header: "Category", key: "category", width: 15 },
        { header: "Barcode", key: "barcode", width: 15 },
        { header: "Cost Price (₱)", key: "cost_price", width: 14 },
        { header: "Price (₱)", key: "retail_price", width: 14 },
        { header: "Margin Amount (₱)", key: "margin_amount", width: 14 },
        { header: "Margin %", key: "margin_percent", width: 10 },
        { header: "Status", key: "status", width: 12 },
        { header: "Units Sold", key: "units_sold_30d", width: 15 },
        { header: "Profit (₱)", key: "total_profit_30d", width: 14 },
      ],
      rows: filteredData.map((item) => ({
        product_name: item.product_name,
        category: formatCategoryName(item.category),
        barcode: item.barcode || "",
        cost_price: item.cost_price,
        retail_price: item.retail_price,
        margin_amount: item.margin_amount,
        margin_percent: item.margin_percent / 100, // For percentage formatting
        status: statusConfig[item.status].label,
        units_sold_30d: item.units_sold_30d,
        total_profit_30d: item.total_profit_30d,
      })),
    }),
  };

  return (
    <ReportShell
      title="Profit Margin Analysis"
      description="Compare cost vs retail price, identify low-margin products needing repricing."
      icon={TrendingUp}
      generatedBy="Admin"
      excelExport={excelExport}
      printTableData={printTableData}
      toolbarContent={
        <DateRangePicker
          date={dateRange}
          onDateChange={handleDateChange}
          align="end"
        />
      }
    >
      {/* Filters - Screen Only */}
      <div className="flex flex-col sm:flex-row gap-3 print-hidden" data-print-hidden="true">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 py-2.25"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="negative">Negative</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="moderate">Moderate</SelectItem>
            <SelectItem value="healthy">Healthy</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <LoadingOverlay isLoading={isPending}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <CompactCard
            label="Negative Margin"
            value={data.summary.negative_margin_count.toLocaleString()}
            subtitle="Products selling below cost"
            icon={AlertCircle}
            variant="danger"
          />
          <CompactCard
            label="Low Margin"
            value={data.summary.low_margin_count.toLocaleString()}
            subtitle="Products with <10% margin"
            icon={AlertTriangle}
            variant="warning"
          />
          <CompactCard
            label="Avg Margin"
            value={`${data.summary.avg_margin_percent}%`}
            subtitle="Across all products"
            icon={Percent}
          />
          <CompactCard
            label="Total Profit"
            value={formatPeso(data.summary.total_potential_profit)}
            subtitle="From sold products"
            icon={DollarSign}
            variant="success"
          />
        </div>
      </LoadingOverlay>

      {/* Alert for problematic margins */}
      {(data.summary.negative_margin_count > 0 || data.summary.low_margin_count > 0) && (
        <div className="bg-[#F1782F]/10 border border-[#F1782F]/30 rounded-lg p-4 print-hidden" data-print-hidden="true">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[#F1782F] mt-0.5" />
            <div>
              <p className="font-medium text-[#F1782F]">Pricing Issues Detected</p>
              <p className="text-sm text-muted-foreground mt-1">
                {data.summary.negative_margin_count > 0 && (
                  <span>
                    <strong>{data.summary.negative_margin_count}</strong> products are selling below cost.{" "}
                  </span>
                )}
                {data.summary.low_margin_count > 0 && (
                  <span>
                    <strong>{data.summary.low_margin_count}</strong> products have margins below 10%.
                  </span>
                )}
                {" "}Review pricing to improve profitability.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Table - Card Wrapper */}
      <LoadingOverlay isLoading={isPending}>
        <Card className="border-stone-200/80 bg-card shadow-sm">
          <CardHeader className="py-0 px-6 border-b pb-0 mb-0 border-stone-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold pb-0 mb-0">Product Margin Details</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5 pb-0 mb-0">
                  {table.getFilteredRowModel().rows.length} products • Sorted by margin % (lowest first)
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pb-0 translate-y-[-6.5vh]">
            <div className="overflow-x-auto border border-stone-200/80 rounded-lg">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50 print:bg-gray-100">
                    {headerGroup.headers.map((header) => (
                      <TableHead 
                        key={header.id} 
                        className="h-10 px-4"
                        style={{ width: header.column.getSize() }}
                      >
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
                        <Boxes className="h-8 w-8 text-muted-foreground/50" />
                        <p>No products match your filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="print:text-sm hover:bg-muted/30"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell 
                          key={cell.id}
                          className="px-4 py-2.5"
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-stone-100 print-hidden" data-print-hidden="true">
            <DataTablePagination table={table} />
          </div>
          </CardContent>
        </Card>
      </LoadingOverlay>
    </ReportShell>
  );
}
