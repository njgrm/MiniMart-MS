"use client";

import { useState, useMemo } from "react";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Percent,
  AlertCircle,
  CheckCircle,
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
import { Progress } from "@/components/ui/progress";
import { type MarginReportResult, type MarginItem } from "@/actions/reports";

interface ProfitMarginClientProps {
  data: MarginReportResult;
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

export function ProfitMarginClient({ data }: ProfitMarginClientProps) {
  // Default sort: margin_percent ascending to show problems first
  const [sorting, setSorting] = useState<SortingState>([
    { id: "margin_percent", desc: false },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

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
          const item = row.original;
          const searchLower = value.toLowerCase();
          return (
            item.product_name.toLowerCase().includes(searchLower) ||
            item.category.toLowerCase().includes(searchLower) ||
            (item.barcode?.toLowerCase().includes(searchLower) ?? false)
          );
        },
      },
      {
        accessorKey: "cost_price",
        header: () => <div className="text-right">Cost</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono">
            ₱{row.original.cost_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "retail_price",
        header: () => <div className="text-right">Retail</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono">
            ₱{row.original.retail_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "margin_percent",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8 hover:bg-transparent"
          >
            <Percent className="mr-1 h-4 w-4" />
            Margin
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const margin = row.original.margin_percent;
          const config = statusConfig[row.original.status];
          return (
            <div className="flex items-center gap-2">
              <Progress
                value={Math.max(0, Math.min(100, margin))}
                className="w-16 h-2"
              />
              <span
                className={`font-mono font-medium ${
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
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
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
      },
      {
        accessorKey: "units_sold_30d",
        header: () => <div className="text-right">Sold (30d)</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono">{row.original.units_sold_30d}</div>
        ),
      },
      {
        accessorKey: "total_profit_30d",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8 hover:bg-transparent"
          >
            <span className="text-right">Profit (30d)</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const profit = row.original.total_profit_30d;
          return (
            <div
              className={`text-right font-mono font-medium ${
                profit < 0 ? "text-[#AC0F16]" : "text-[#2EAFC5]"
              }`}
            >
              ₱{profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          );
        },
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

  // Excel export configuration
  const excelExport = {
    filename: "profit_margin_analysis",
    sheetName: "Margin Analysis",
    getData: async () => ({
      columns: [
        { header: "Product", key: "product_name", width: 30 },
        { header: "Category", key: "category", width: 15 },
        { header: "Barcode", key: "barcode", width: 15 },
        { header: "Cost Price", key: "cost_price", width: 12 },
        { header: "Retail Price", key: "retail_price", width: 12 },
        { header: "Margin Amount", key: "margin_amount", width: 12 },
        { header: "Margin %", key: "margin_percent", width: 10 },
        { header: "Status", key: "status", width: 12 },
        { header: "Units Sold (30d)", key: "units_sold_30d", width: 15 },
        { header: "Profit (30d)", key: "total_profit_30d", width: 12 },
      ],
      rows: filteredData.map((item) => ({
        product_name: item.product_name,
        category: item.category,
        barcode: item.barcode || "",
        cost_price: item.cost_price,
        retail_price: item.retail_price,
        margin_amount: item.margin_amount,
        margin_percent: item.margin_percent,
        status: statusConfig[item.status].label,
        units_sold_30d: item.units_sold_30d,
        total_profit_30d: item.total_profit_30d,
      })),
    }),
  };

  return (
    <ReportShell
      title="Profit Margin Analysis"
      description="Compare cost vs retail price, identify low-margin products needing repricing. Sorted by margin % (lowest first)."
      generatedBy="Admin"
      excelExport={excelExport}
    >
      {/* Filters - Screen Only */}
      <div className="flex flex-col sm:flex-row gap-3 print-hidden" data-print-hidden="true">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ReportSummaryCard
          label="Negative Margin"
          value={data.summary.negative_margin_count}
          icon={AlertCircle}
          variant="danger"
        />
        <ReportSummaryCard
          label="Low Margin (<10%)"
          value={data.summary.low_margin_count}
          icon={AlertTriangle}
          variant="warning"
        />
        <ReportSummaryCard
          label="Avg Margin"
          value={`${data.summary.avg_margin_percent}%`}
          icon={Percent}
        />
        <ReportSummaryCard
          label="Total Profit (30d)"
          value={`₱${data.summary.total_potential_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          variant="success"
        />
      </div>

      {/* Alert for problematic margins */}
      {(data.summary.negative_margin_count > 0 || data.summary.low_margin_count > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 print-hidden" data-print-hidden="true">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Pricing Issues Detected</p>
              <p className="text-sm text-amber-700 mt-1">
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

      {/* Detailed Table */}
      <ReportSection
        title="Product Margin Details"
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
    </ReportShell>
  );
}
