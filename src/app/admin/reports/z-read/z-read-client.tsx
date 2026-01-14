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
  flexRender,
} from "@tanstack/react-table";
import {
  Receipt,
  DollarSign,
  TrendingUp,
  Calendar,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CreditCard,
  Banknote,
  XCircle,
  User,
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
import { Button } from "@/components/ui/button";
import {
  ReportShell,
  ReportSummaryCard,
  ReportSection,
} from "@/components/reports/report-shell";
import { DataTablePagination } from "@/components/data-table-pagination";
import { type ZReadHistoryResult, type ZReadRecord } from "@/actions/reports";

interface ZReadReportClientProps {
  data: ZReadHistoryResult;
}

export function ZReadReportClient({ data }: ZReadReportClientProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);

  // Define columns for Tanstack Table
  const columns: ColumnDef<ZReadRecord>[] = useMemo(
    () => [
      {
        accessorKey: "date",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8 hover:bg-transparent"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Date
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
          <div className="font-medium text-foreground">
            {format(new Date(row.original.date), "EEE, MMM d, yyyy")}
          </div>
        ),
      },
      {
        accessorKey: "transaction_count",
        header: () => <div className="text-right">Transactions</div>,
        cell: ({ row }) => (
          <div className="text-right font-mono">{row.original.transaction_count}</div>
        ),
      },
      {
        accessorKey: "gross_sales",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8 hover:bg-transparent"
          >
            <span className="text-right">Gross Sales</span>
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
            ₱{row.original.gross_sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "void_amount",
        header: () => <div className="text-right">Voids</div>,
        cell: ({ row }) =>
          row.original.void_count > 0 ? (
            <div className="text-right">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                <XCircle className="h-3 w-3 mr-1" />
                {row.original.void_count} (₱{row.original.void_amount.toLocaleString()})
              </Badge>
            </div>
          ) : (
            <div className="text-right text-muted-foreground">—</div>
          ),
      },
      {
        accessorKey: "gross_profit",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8 hover:bg-transparent"
          >
            <span className="text-right">Net Profit</span>
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
            ₱{row.original.gross_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "cash_sales",
        header: () => (
          <div className="text-right flex items-center justify-end gap-1">
            <Banknote className="h-4 w-4" />
            Cash
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            ₱{row.original.cash_sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "gcash_sales",
        header: () => (
          <div className="text-right flex items-center justify-end gap-1">
            <CreditCard className="h-4 w-4" />
            GCash
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            ₱{row.original.gcash_sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "closed_by",
        header: () => (
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            Closed By
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {row.original.closed_by || "—"}
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: data.records,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 15 },
    },
  });

  // Excel export configuration
  const excelExport = {
    filename: "z_read_history",
    sheetName: "Z-Read History",
    getData: async () => ({
      columns: [
        { header: "Date", key: "date", width: 15 },
        { header: "Transactions", key: "transaction_count", width: 12 },
        { header: "Gross Sales", key: "gross_sales", width: 15 },
        { header: "COGS", key: "total_cost", width: 15 },
        { header: "Gross Profit", key: "gross_profit", width: 15 },
        { header: "Cash Sales", key: "cash_sales", width: 15 },
        { header: "GCash Sales", key: "gcash_sales", width: 15 },
        { header: "Void Count", key: "void_count", width: 10 },
        { header: "Void Amount", key: "void_amount", width: 12 },
        { header: "Closed By", key: "closed_by", width: 15 },
      ],
      rows: data.records.map((r) => ({
        date: format(new Date(r.date), "yyyy-MM-dd"),
        transaction_count: r.transaction_count,
        gross_sales: r.gross_sales,
        total_cost: r.total_cost,
        gross_profit: r.gross_profit,
        cash_sales: r.cash_sales,
        gcash_sales: r.gcash_sales,
        void_count: r.void_count,
        void_amount: r.void_amount,
        closed_by: r.closed_by || "",
      })),
    }),
  };

  const handlePrintLedger = () => {
    window.print();
  };

  return (
    <ReportShell
      title="Z-Read History"
      description="Daily closure reports with gross sales, payment breakdown, and void transactions"
      generatedBy="Admin"
      excelExport={excelExport}
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ReportSummaryCard
          label="Days Tracked"
          value={data.summary.total_days}
          icon={Calendar}
        />
        <ReportSummaryCard
          label="Total Transactions"
          value={data.summary.total_transactions.toLocaleString()}
          icon={Receipt}
        />
        <ReportSummaryCard
          label="Total Gross Sales"
          value={`₱${data.summary.total_gross_sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          variant="success"
        />
        <ReportSummaryCard
          label="Total Profit"
          value={`₱${data.summary.total_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          variant="success"
        />
      </div>

      {/* Average Daily Stats */}
      <ReportSection title="Average Daily Performance">
        <div className="bg-card rounded-lg p-4 border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Avg Daily Sales</p>
              <p className="text-2xl font-bold font-mono text-foreground tabular-nums">
                ₱{data.summary.avg_daily_sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Avg Transactions/Day</p>
              <p className="text-2xl font-bold font-mono text-foreground tabular-nums">
                {data.summary.total_days > 0
                  ? Math.round(data.summary.total_transactions / data.summary.total_days)
                  : 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Avg Profit/Day</p>
              <p className="text-2xl font-bold font-mono text-[#2EAFC5]">
                ₱{(data.summary.total_days > 0
                  ? data.summary.total_profit / data.summary.total_days
                  : 0
                ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </ReportSection>

      {/* Print Official Ledger Button */}
      <div className="flex justify-end print-hidden" data-print-hidden="true">
        <Button onClick={handlePrintLedger} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Official Ledger
        </Button>
      </div>

      {/* Daily Records Table */}
      <ReportSection
        title="Daily Closure Records"
        description={`${data.records.length} days of history`}
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
                    No Z-Read records found.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="print:text-sm bg-card/50 hover:bg-muted/30"
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
