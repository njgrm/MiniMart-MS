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
  Percent,
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
import {
  ReportShell,
  ReportSummaryCard,
  ReportSection,
  SortableHeader,
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
        header: () => (
          <div className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
            Category
          </div>
        ),
        cell: ({ row }) => (
          <div className="font-medium text-foreground">{row.original.category}</div>
        ),
        size: 180,
      },
      {
        accessorKey: "product_count",
        header: () => (
          <div className="text-center font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
            Products
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-center font-mono tabular-nums">{row.original.product_count.toLocaleString()}</div>
        ),
        size: 90,
      },
      {
        accessorKey: "units_sold_30d",
        header: ({ column }) => (
          <div className="text-right">
            <SortableHeader column={column} className="justify-end">
              Units Sold
            </SortableHeader>
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">{row.original.units_sold_30d.toLocaleString()}</div>
        ),
        size: 110,
      },
      {
        accessorKey: "revenue_30d",
        header: ({ column }) => (
          <div className="text-right">
            <SortableHeader column={column} className="justify-end">
              Revenue (30d)
            </SortableHeader>
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums font-medium">
            ₱{row.original.revenue_30d.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
        size: 140,
      },
      {
        accessorKey: "revenue_share",
        header: () => (
          <div className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
            Revenue Share
          </div>
        ),
        cell: ({ row }) => {
          const share = row.original.revenue_share;
          return (
            <div className="flex items-center gap-3 min-w-[140px]">
              <Progress value={share} className="flex-1 h-2.5 bg-stone-200" indicatorClassName="bg-[#2EAFC5]" />
              <span className="font-mono tabular-nums text-sm w-14 text-right">{share.toFixed(1)}%</span>
            </div>
          );
        },
        size: 180,
      },
      {
        accessorKey: "profit_30d",
        header: ({ column }) => (
          <div className="text-right">
            <SortableHeader column={column} className="justify-end">
              Profit (30d)
            </SortableHeader>
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-[#2EAFC5] font-medium">
            ₱{row.original.profit_30d.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
        size: 130,
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
          return (
            <div
              className={`text-right font-mono tabular-nums font-medium ${
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
        size: 100,
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

  // Print table data - ALL rows for print preview
  const printTableData = useMemo(() => {
    const headers = ["Category", "Products", "Units Sold", "Revenue (30d)", "Revenue Share", "Profit (30d)", "Margin"];
    const rows = data.items.map(item => [
      item.category,
      item.product_count.toLocaleString(),
      item.units_sold_30d.toLocaleString(),
      `₱${item.revenue_30d.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `${item.revenue_share.toFixed(1)}%`,
      `₱${item.profit_30d.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `${item.margin_percent.toFixed(1)}%`,
    ]);
    return { headers, rows };
  }, [data.items]);

  // Excel export configuration
  const excelExport = {
    filename: "sales_by_category",
    sheetName: "Category Sales",
    getData: async () => ({
      columns: [
        { header: "Category", key: "category", width: 20 },
        { header: "Product Count", key: "product_count", width: 14 },
        { header: "Units Sold (30d)", key: "units_sold_30d", width: 15 },
        { header: "Revenue (30d) (₱)", key: "revenue_30d", width: 16 },
        { header: "Cost (30d) (₱)", key: "cost_30d", width: 14 },
        { header: "Profit (30d) (₱)", key: "profit_30d", width: 15 },
        { header: "Margin %", key: "margin_percent", width: 10 },
        { header: "Revenue Share %", key: "revenue_share", width: 14 },
      ],
      rows: data.items.map((item) => ({
        category: item.category,
        product_count: item.product_count,
        units_sold_30d: item.units_sold_30d,
        revenue_30d: item.revenue_30d,
        cost_30d: item.cost_30d,
        profit_30d: item.profit_30d,
        margin_percent: item.margin_percent / 100, // For percentage formatting
        revenue_share: item.revenue_share / 100, // For percentage formatting
      })),
    }),
  };

  // Find top performing category
  const topCategory = data.items.length > 0 ? data.items[0] : null;

  return (
    <ReportShell
      title="Sales by Category"
      description="Revenue breakdown by product category with trend analysis (Last 30 days)"
      icon={BarChart3}
      generatedBy="Admin"
      excelExport={excelExport}
      printTableData={printTableData}
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ReportSummaryCard
          label="Categories"
          value={data.summary.total_categories.toLocaleString()}
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
          <div className="bg-[#f5f3ef] dark:bg-muted/30 rounded-lg p-4 border">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                  <Progress value={topCategory.revenue_share} className="flex-1 h-3 bg-stone-200" indicatorClassName="bg-[#2EAFC5]" />
                  <span className="text-lg font-mono font-bold tabular-nums">{topCategory.revenue_share.toFixed(1)}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Profit</p>
                <p className="text-2xl font-bold font-mono text-[#2EAFC5] tabular-nums">
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
                        <p>No category data available.</p>
                        <p className="text-xs">Import sales data to see category analytics.</p>
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
