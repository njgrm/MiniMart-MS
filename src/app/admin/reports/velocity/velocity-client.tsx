"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
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
  AlertTriangle,
  Snowflake,
  Zap,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ReportShell,
  ReportSummaryCard,
  ReportSection,
} from "@/components/reports/report-shell";
import { DataTablePagination } from "@/components/data-table-pagination";
import {
  type VelocityReportResult,
  type VelocityItem,
} from "@/actions/reports";
import { Progress } from "@/components/ui/progress";

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
        header: "Product",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.product_name}</p>
            <p className="text-xs text-muted-foreground">
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
      },
      {
        accessorKey: "status",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="-ml-3 h-8 hover:bg-transparent"
            >
              Status
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="ml-2 h-4 w-4" />
              ) : (
                <ArrowUpDown className="ml-2 h-4 w-4" />
              )}
            </Button>
          );
        },
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
      },
      {
        accessorKey: "current_stock",
        header: () => <div className="text-right">Stock</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono">{row.original.current_stock}</div>
        ),
      },
      {
        accessorKey: "units_sold_30d",
        header: () => <div className="text-right">Sold (30d)</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono">{row.original.units_sold_30d}</div>
        ),
      },
      {
        accessorKey: "daily_velocity",
        header: () => <div className="text-right">Velocity</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono">{row.original.daily_velocity}/day</div>
        ),
      },
      {
        accessorKey: "days_of_supply",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="-ml-3 h-8 hover:bg-transparent"
            >
              <span className="text-right">Days Left</span>
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="ml-2 h-4 w-4" />
              ) : (
                <ArrowUpDown className="ml-2 h-4 w-4" />
              )}
            </Button>
          );
        },
        cell: ({ row }) => {
          const days = row.original.days_of_supply;
          return (
            <div className="text-right font-mono">
              {days >= 999 ? (
                <span className="text-red-600">∞</span>
              ) : (
                <span
                  className={
                    days > 90 ? "text-red-600" : days > 30 ? "text-orange-600" : ""
                  }
                >
                  {days}d
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "capital_tied",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="-ml-3 h-8 hover:bg-transparent"
            >
              <span className="text-right">Capital</span>
              {column.getIsSorted() === "asc" ? (
                <ArrowUp className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown className="ml-2 h-4 w-4" />
              ) : (
                <ArrowUpDown className="ml-2 h-4 w-4" />
              )}
            </Button>
          );
        },
        cell: ({ row }) => (
          <div className="text-right font-mono">
            ₱{row.original.capital_tied.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "last_sale_date",
        header: "Last Sale",
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground print:hidden">
            {row.original.last_sale_date
              ? format(new Date(row.original.last_sale_date), "MMM d")
              : "Never"}
          </div>
        ),
        meta: { className: "print:hidden" },
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
        { header: "Cost Price", key: "cost_price", width: 12 },
        { header: "Retail Price", key: "retail_price", width: 12 },
        { header: "Capital Tied", key: "capital_tied", width: 12 },
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
      generatedBy="Admin"
      excelExport={excelExport}
    >
      {/* Filters - Screen Only */}
      <div className="flex flex-col sm:flex-row gap-3 print-hidden" data-print-hidden="true">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, categories..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
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
        <ReportSummaryCard
          label="Dead Stock Items"
          value={data.summary.dead_stock_count}
          icon={Snowflake}
          variant="danger"
        />
        <ReportSummaryCard
          label="Dead Stock Capital"
          value={`₱${data.summary.dead_stock_capital.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          variant="danger"
        />
        <ReportSummaryCard
          label="Slow Movers"
          value={data.summary.slow_mover_count}
          icon={TrendingDown}
          variant="warning"
        />
        <ReportSummaryCard
          label="Fast Movers"
          value={data.summary.fast_mover_count}
          icon={Zap}
          variant="success"
        />
      </div>

      {/* Capital Analysis */}
      <ReportSection title="Capital Efficiency Analysis">
        <div className="bg-card rounded-lg p-4 border print:border-gray-300 print:bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Capital Tied in Inventory</p>
              <p className="text-2xl font-bold font-mono text-foreground tabular-nums">
                ₱{data.summary.total_capital_tied.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">At-Risk Capital (Dead + Slow)</p>
              <p className="text-2xl font-bold font-mono text-red-600">
                ₱{(data.summary.dead_stock_capital + data.summary.slow_mover_capital).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                  className="flex-1 h-3"
                />
                <span className="text-lg font-mono font-bold">
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
      </ReportSection>

      {/* Detailed Table with Tanstack */}
      <ReportSection
        title="Product Velocity Details"
        description={`${table.getFilteredRowModel().rows.length} products`}
      >
        <div className="rounded-lg border bg-card overflow-hidden print:border-gray-300">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50 print:bg-gray-100">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="h-10">
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
                    No products match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="print:text-sm bg-background hover:bg-muted/30"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
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
        <div className="mt-4 print-hidden" data-print-hidden="true">
          <DataTablePagination table={table} />
        </div>
      </ReportSection>

      {/* Recommendations - Screen Only */}
      <div className="print-hidden" data-print-hidden="true">
        <ReportSection title="Recommendations">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-amber-800">Action Items for Dead Stock</p>
                <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
                  <li>Consider running promotions or bundling dead stock items</li>
                  <li>Review pricing strategy for slow-moving products</li>
                  <li>Adjust reorder levels to prevent overstocking</li>
                  <li>
                    Capital tied in dead stock:{" "}
                    <strong>
                      ₱{data.summary.dead_stock_capital.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </strong>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </ReportSection>
      </div>
    </ReportShell>
  );
}
