"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  flexRender,
} from "@tanstack/react-table";
import {
  Activity,
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Snowflake,
  Zap,
  Search,
  Filter,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTablePagination } from "@/components/data-table-pagination";
import {
  type VelocityReportResult,
  type VelocityItem,
} from "@/actions/reports";
import { Progress } from "@/components/ui/progress";

// Helper function for normal weight peso sign
function formatPeso(amount: number): React.ReactNode {
  return (
    <>
      <span className="font-normal">₱</span>
      {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
    </>
  );
}

// Design system CompactCard with trend support
interface CompactCardProps {
  label: string;
  value: string | React.ReactNode;
  icon: React.ElementType;
  trend?: { value: number; label: string };
  variant?: "default" | "success" | "warning" | "danger";
}

function CompactCard({ label, value, icon: Icon, trend, variant = "default" }: CompactCardProps) {
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
              <span>{trend.value >= 0 ? "+" : ""}{trend.value}%</span>
            </div>
          )}
        </div>
        <p className={`text-2xl font-bold font-mono tabular-nums mt-2 ${variantStyles[variant]}`}>
          {value}
        </p>
        {trend && (
          <p className="text-xs text-muted-foreground mt-1">{trend.label}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface VelocityReportClientProps {
  data: VelocityReportResult;
}

// Design system colors from AGENTS.md
// Success/Stock: #2EAFC5 (Teal), Warning: #F1782F (Orange), Danger: #AC0F16 (Red)
const statusConfig: Record<
  VelocityItem["status"],
  { label: string; color: string; icon: React.ElementType; badgeClass: string; order: number }
> = {
  dead_stock: {
    label: "Dead Stock",
    color: "text-[#AC0F16]",
    icon: Snowflake,
    badgeClass: "bg-red-50 text-[#AC0F16] border-red-200",
    order: 0,
  },
  slow_mover: {
    label: "Slow Mover",
    color: "text-[#F1782F]",
    icon: TrendingDown,
    badgeClass: "bg-[#fef3eb] text-[#F1782F] border-[#F1782F]/30",
    order: 1,
  },
  moderate: {
    label: "Moderate",
    color: "text-blue-600",
    icon: Activity,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    order: 2,
  },
  fast_mover: {
    label: "Fast Mover",
    color: "text-[#2EAFC5]",
    icon: Zap,
    badgeClass: "bg-[#e6f7fa] text-[#2EAFC5] border-[#2EAFC5]/30",
    order: 3,
  },
};

export function VelocityReportClient({ data }: VelocityReportClientProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Get unique categories
  const categories = useMemo(
    () => Array.from(new Set(data.items.map((i) => i.category))).sort(),
    [data.items]
  );

  // Filter items by status and category
  const filteredData = useMemo(() => {
    return data.items.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      return matchesStatus && matchesCategory;
    });
  }, [data.items, statusFilter, categoryFilter]);

  // Define columns for Tanstack Table
  const columns: ColumnDef<VelocityItem>[] = useMemo(
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
              {row.original.category}
              {row.original.barcode && ` • ${row.original.barcode}`}
            </p>
          </div>
        ),
        filterFn: (row, _, value) => {
          const product = row.original;
          const searchLower = value.toLowerCase();
          return (
            product.product_name.toLowerCase().includes(searchLower) ||
            product.category.toLowerCase().includes(searchLower) ||
            (product.barcode?.toLowerCase().includes(searchLower) ?? false)
          );
        },
        size: 200,
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
        size: 130,
      },
      {
        accessorKey: "current_stock",
        header: () => (
          <div className="text-right font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
            Stock
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">{row.original.current_stock.toLocaleString()}</div>
        ),
        size: 80,
      },
      {
        accessorKey: "units_sold_30d",
        header: () => (
          <div className="text-right font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
            Sold (30d)
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">{row.original.units_sold_30d.toLocaleString()}</div>
        ),
        size: 90,
      },
      {
        accessorKey: "daily_velocity",
        header: () => (
          <div className="text-right font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
            Velocity
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">{row.original.daily_velocity}/day</div>
        ),
        size: 90,
      },
      {
        accessorKey: "days_of_supply",
        header: ({ column }) => (
          <div className="text-right">
            <SortableHeader column={column} className="justify-end">
              Days Left
            </SortableHeader>
          </div>
        ),
        cell: ({ row }) => {
          const days = row.original.days_of_supply;
          return (
            <div className="text-right font-mono tabular-nums">
              {days >= 999 ? (
                <span className="text-[#AC0F16]">∞</span>
              ) : (
                <span
                  className={
                    days > 90 ? "text-[#AC0F16]" : days > 30 ? "text-[#F1782F]" : ""
                  }
                >
                  {days}d
                </span>
              )}
            </div>
          );
        },
        size: 100,
      },
      {
        accessorKey: "capital_tied",
        header: ({ column }) => (
          <div className="text-left">
            <SortableHeader column={column} className="justify-start">
              Capital
            </SortableHeader>
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-left font-mono tabular-nums">
            {formatPeso(row.original.capital_tied)}
          </div>
        ),
        size: 120,
      },
      {
        accessorKey: "last_sale_date",
        header: () => (
          <div className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide print:hidden">
            Last Sale
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground print:hidden">
            {row.original.last_sale_date
              ? format(new Date(row.original.last_sale_date), "MMM d")
              : "Never"}
          </div>
        ),
        size: 90,
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _, value) => {
      const product = row.original;
      const searchLower = value.toLowerCase();
      return (
        product.product_name.toLowerCase().includes(searchLower) ||
        product.category.toLowerCase().includes(searchLower) ||
        (product.barcode?.toLowerCase().includes(searchLower) ?? false)
      );
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  // Print table data - ALL rows for print preview
  const printTableData = useMemo(() => {
    const headers = ["Product", "Category", "Status", "Stock", "Sold (30d)", "Velocity", "Days Left", "Capital"];
    const rows = filteredData.map(item => [
      item.product_name,
      item.category,
      statusConfig[item.status].label,
      item.current_stock.toLocaleString(),
      item.units_sold_30d.toLocaleString(),
      `${item.daily_velocity}/day`,
      item.days_of_supply >= 999 ? "∞" : `${item.days_of_supply}d`,
      `₱${item.capital_tied.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    ]);
    return { headers, rows };
  }, [filteredData]);

  // Excel export configuration
  const excelExport = {
    filename: "inventory_velocity_report",
    sheetName: "Velocity Report",
    getData: async () => ({
      columns: [
        { header: "Product", key: "product_name", width: 30 },
        { header: "Category", key: "category", width: 15 },
        { header: "Barcode", key: "barcode", width: 15 },
        { header: "Status", key: "status", width: 12 },
        { header: "Current Stock", key: "current_stock", width: 12 },
        { header: "Units Sold (30d)", key: "units_sold_30d", width: 15 },
        { header: "Daily Velocity", key: "daily_velocity", width: 12 },
        { header: "Days of Supply", key: "days_of_supply", width: 12 },
        { header: "Cost Price (₱)", key: "cost_price", width: 12 },
        { header: "Retail Price (₱)", key: "retail_price", width: 12 },
        { header: "Capital Tied (₱)", key: "capital_tied", width: 14 },
        { header: "Last Sale", key: "last_sale_date", width: 12 },
      ],
      rows: filteredData.map((item) => ({
        product_name: item.product_name,
        category: item.category,
        barcode: item.barcode || "",
        status: statusConfig[item.status].label,
        current_stock: item.current_stock,
        units_sold_30d: item.units_sold_30d,
        daily_velocity: item.daily_velocity,
        days_of_supply: item.days_of_supply >= 999 ? "∞" : item.days_of_supply,
        cost_price: item.cost_price,
        retail_price: item.retail_price,
        capital_tied: item.capital_tied,
        last_sale_date: item.last_sale_date ? format(new Date(item.last_sale_date), "yyyy-MM-dd") : "Never",
      })),
    }),
  };

  return (
    <ReportShell
      title="Inventory Velocity Report"
      description="Identify Dead Stock (0 sales in 30 days) vs Fast Movers. Critical for Dynamic ROP optimization and capital efficiency."
      icon={Activity}
      generatedBy="Admin"
      excelExport={excelExport}
      printTableData={printTableData}
    >
      {/* Filters - Screen Only */}
      <div className="flex flex-col sm:flex-row gap-3 print-hidden" data-print-hidden="true">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, categories..."
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
            <SelectItem value="dead_stock">Dead Stock</SelectItem>
            <SelectItem value="slow_mover">Slow Mover</SelectItem>
            <SelectItem value="moderate">Moderate</SelectItem>
            <SelectItem value="fast_mover">Fast Mover</SelectItem>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CompactCard
          label="Dead Stock Items"
          value={data.summary.dead_stock_count.toLocaleString()}
          icon={Snowflake}
          variant="danger"
        />
        <CompactCard
          label="Dead Stock Capital"
          value={formatPeso(data.summary.dead_stock_capital)}
          icon={DollarSign}
          variant="danger"
        />
        <CompactCard
          label="Slow Movers"
          value={data.summary.slow_mover_count.toLocaleString()}
          icon={TrendingDown}
          variant="warning"
        />
        <CompactCard
          label="Fast Movers"
          value={data.summary.fast_mover_count.toLocaleString()}
          icon={Zap}
          variant="success"
        />
      </div>

      {/* Capital Analysis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Capital Efficiency Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-[#f5f3ef] dark:bg-muted/30 rounded-lg p-4 border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Capital Tied in Inventory</p>
                <p className="text-2xl font-bold font-mono text-foreground tabular-nums">
                  {formatPeso(data.summary.total_capital_tied)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">At-Risk Capital (Dead + Slow)</p>
                <p className="text-2xl font-bold font-mono text-[#AC0F16] tabular-nums">
                  {formatPeso(data.summary.dead_stock_capital + data.summary.slow_mover_capital)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">At-Risk Percentage</p>
                <div className="flex items-center gap-3">
                  <Progress
                    value={
                      data.summary.total_capital_tied > 0
                        ? ((data.summary.dead_stock_capital + data.summary.slow_mover_capital) /
                            data.summary.total_capital_tied) *
                          100
                        : 0
                    }
                    className="flex-1 h-3 bg-stone-200"
                    indicatorClassName="bg-[#AC0F16]"
                  />
                  <span className="text-lg font-mono font-bold tabular-nums">
                    {data.summary.total_capital_tied > 0
                      ? Math.round(
                          ((data.summary.dead_stock_capital + data.summary.slow_mover_capital) /
                            data.summary.total_capital_tied) *
                            100
                        )
                      : 0}
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Table with Tanstack */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Product Velocity Details</CardTitle>
          <CardDescription>{table.getFilteredRowModel().rows.length} products</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-card overflow-hidden print:border-gray-300">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50 print:bg-gray-100">
                      {headerGroup.headers.map((header) => (
                        <TableHead 
                          key={header.id} 
                          className="h-11"
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
          </div>

          {/* Pagination */}
          <div className="mt-4 print-hidden" data-print-hidden="true">
            <DataTablePagination table={table} />
          </div>
        </CardContent>
      </Card>

      {/* Recommendations - Screen Only */}
      <div className="print-hidden" data-print-hidden="true">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-[#F1782F]/10 border border-[#F1782F]/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-[#F1782F] mt-0.5" />
                <div className="space-y-2">
                  <p className="font-medium text-[#F1782F]">Action Items for Dead Stock</p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Consider running promotions or bundling dead stock items</li>
                    <li>Review pricing strategy for slow-moving products</li>
                    <li>Adjust reorder levels to prevent overstocking</li>
                    <li>
                      Capital tied in dead stock:{" "}
                      <strong className="font-mono">
                        {formatPeso(data.summary.dead_stock_capital)}
                      </strong>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ReportShell>
  );
}
