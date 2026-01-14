"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  ColumnDef,
  SortingState,
  flexRender,
} from "@tanstack/react-table";
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  Package,
  Percent,
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
import { Button } from "@/components/ui/button";
import {
  ReportShell,
  ReportSummaryCard,
  ReportSection,
} from "@/components/reports/report-shell";
import { DataTablePagination } from "@/components/data-table-pagination";
import { Progress } from "@/components/ui/progress";
import { type CategorySalesResult, type CategorySalesItem } from "@/actions/reports";

interface SalesCategoryClientProps {
  data: CategorySalesResult;
}

export function SalesCategoryClient({ data }: SalesCategoryClientProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "revenue_30d", desc: true },
  ]);

  // Define columns for Tanstack Table
  const columns: ColumnDef<CategorySalesItem>[] = useMemo(
    () => [
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <div className="font-medium text-foreground">{row.original.category}</div>
        ),
      },
      {
        accessorKey: "product_count",
        header: () => <div className="text-right">Products</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono">{row.original.product_count}</div>
        ),
      },
      {
        accessorKey: "units_sold_30d",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8 hover:bg-transparent"
          >
            <span className="text-right">Units Sold</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">{row.original.units_sold_30d.toLocaleString()}</div>
        ),
      },
      {
        accessorKey: "revenue_30d",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8 hover:bg-transparent"
          >
            <span className="text-right">Revenue (30d)</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono font-medium">
            ₱{row.original.revenue_30d.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "revenue_share",
        header: "Revenue Share",
        cell: ({ row }) => {
          const share = row.original.revenue_share;
          return (
            <div className="flex items-center gap-3 min-w-[140px]">
              <Progress value={share} className="flex-1 h-3" />
              <span className="font-mono text-sm w-12 text-right">{share.toFixed(1)}%</span>
            </div>
          );
        },
      },
      {
        accessorKey: "profit_30d",
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
        cell: ({ row }) => (
          <div className="text-right font-mono text-[#2EAFC5] font-medium">
            ₱{row.original.profit_30d.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
          return (
            <div
              className={`text-right font-mono font-medium ${
                margin < 10
                  ? "text-[#AC0F16]"
                  : margin < 20
                  ? "text-[#F1782F]"
                  : "text-[#2EAFC5]"
              }`}
            >
              {margin.toFixed(1)}%
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: data.items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  // Excel export configuration
  const excelExport = {
    filename: "sales_by_category",
    sheetName: "Category Sales",
    getData: async () => ({
      columns: [
        { header: "Category", key: "category", width: 20 },
        { header: "Product Count", key: "product_count", width: 12 },
        { header: "Units Sold (30d)", key: "units_sold_30d", width: 15 },
        { header: "Revenue (30d)", key: "revenue_30d", width: 15 },
        { header: "Cost (30d)", key: "cost_30d", width: 15 },
        { header: "Profit (30d)", key: "profit_30d", width: 15 },
        { header: "Margin %", key: "margin_percent", width: 10 },
        { header: "Revenue Share %", key: "revenue_share", width: 12 },
      ],
      rows: data.items.map((item) => ({
        category: item.category,
        product_count: item.product_count,
        units_sold_30d: item.units_sold_30d,
        revenue_30d: item.revenue_30d,
        cost_30d: item.cost_30d,
        profit_30d: item.profit_30d,
        margin_percent: item.margin_percent,
        revenue_share: item.revenue_share,
      })),
    }),
  };

  // Find top performing category
  const topCategory = data.items.length > 0 ? data.items[0] : null;

  return (
    <ReportShell
      title="Sales by Category"
      description="Revenue breakdown by product category with trend analysis (Last 30 days)"
      generatedBy="Admin"
      excelExport={excelExport}
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ReportSummaryCard
          label="Categories"
          value={data.summary.total_categories}
          icon={BarChart3}
        />
        <ReportSummaryCard
          label="Total Revenue"
          value={`₱${data.summary.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          variant="success"
        />
        <ReportSummaryCard
          label="Total Profit"
          value={`₱${data.summary.total_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          variant="success"
        />
        <ReportSummaryCard
          label="Avg Margin"
          value={`${data.summary.avg_margin}%`}
          icon={Percent}
        />
      </div>

      {/* Top Category Highlight */}
      {topCategory && (
        <ReportSection title="Top Performing Category">
          <div className="bg-card rounded-lg p-4 border">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Category</p>
                <p className="text-2xl font-bold text-foreground">{topCategory.category}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Revenue</p>
                <p className="text-2xl font-bold font-mono text-foreground tabular-nums">
                  ₱{topCategory.revenue_30d.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Revenue Share</p>
                <div className="flex items-center gap-3">
                  <Progress value={topCategory.revenue_share} className="flex-1 h-3" />
                  <span className="text-lg font-mono font-bold">{topCategory.revenue_share.toFixed(1)}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Profit</p>
                <p className="text-2xl font-bold font-mono text-[#2EAFC5]">
                  ₱{topCategory.profit_30d.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </ReportSection>
      )}

      {/* Category Table */}
      <ReportSection
        title="All Categories"
        description={`${data.items.length} categories`}
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
                    No category data available.
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
