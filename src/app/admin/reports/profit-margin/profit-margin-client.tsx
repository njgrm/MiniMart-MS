"use client";

import { useState, useMemo } from "react";
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
  SortableHeader,
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
        header: () => (
          <div className="text-right font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
            Cost
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">
            ₱{row.original.cost_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
        size: 100,
      },
      {
        accessorKey: "retail_price",
        header: () => (
          <div className="text-right font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
            Retail
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">
            ₱{row.original.retail_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
        accessorKey: "total_profit_30d",
        header: ({ column }) => (
          <div className="text-right">
            <SortableHeader column={column} className="justify-end">
              Profit (30d)
            </SortableHeader>
          </div>
        ),
        cell: ({ row }) => {
          const profit = row.original.total_profit_30d;
          return (
            <div
              className={`text-right font-mono tabular-nums font-medium ${
                profit < 0 ? "text-[#AC0F16]" : "text-[#2EAFC5]"
              }`}
            >
              ₱{profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
    const headers = ["Product", "Category", "Cost", "Retail", "Margin %", "Status", "Sold (30d)", "Profit (30d)"];
    const rows = filteredData.map(item => [
      item.product_name,
      item.category,
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
        { header: "Retail Price (₱)", key: "retail_price", width: 14 },
        { header: "Margin Amount (₱)", key: "margin_amount", width: 14 },
        { header: "Margin %", key: "margin_percent", width: 10 },
        { header: "Status", key: "status", width: 12 },
        { header: "Units Sold (30d)", key: "units_sold_30d", width: 15 },
        { header: "Profit (30d) (₱)", key: "total_profit_30d", width: 14 },
      ],
      rows: filteredData.map((item) => ({
        product_name: item.product_name,
        category: item.category,
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
      description="Compare cost vs retail price, identify low-margin products needing repricing. Sorted by margin % (lowest first)."
      icon={TrendingUp}
      generatedBy="Admin"
      excelExport={excelExport}
      printTableData={printTableData}
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
          value={data.summary.negative_margin_count.toLocaleString()}
          icon={AlertCircle}
          variant="danger"
        />
        <ReportSummaryCard
          label="Low Margin (<10%)"
          value={data.summary.low_margin_count.toLocaleString()}
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

      {/* Detailed Table */}
      <ReportSection
        title="Product Margin Details"
        description={`${table.getFilteredRowModel().rows.length} products`}
      >
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
      </ReportSection>
    </ReportShell>
  );
}
