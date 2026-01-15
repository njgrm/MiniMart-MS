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
  CalendarClock,
  AlertTriangle,
  AlertCircle,
  DollarSign,
  Search,
  Filter,
  XCircle,
  Timer,
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
import { type ExpiringReportResult, type ExpiringItem } from "@/actions/reports";
import Link from "next/link";

interface ExpiringReportClientProps {
  data: ExpiringReportResult;
}

// Design system colors from AGENTS.md
// Expired: #AC0F16 (Red), Critical: #AC0F16 (Red), Warning: #F1782F (Orange), Caution: #2EAFC5 (Teal)
const urgencyConfig: Record<
  ExpiringItem["urgency"],
  { label: string; color: string; icon: React.ElementType; badgeClass: string; progressColor: string; order: number }
> = {
  expired: {
    label: "Expired",
    color: "text-[#AC0F16]",
    icon: XCircle,
    badgeClass: "bg-red-50 text-[#AC0F16] border-red-200",
    progressColor: "bg-[#AC0F16]",
    order: 0,
  },
  critical: {
    label: "Critical (≤7d)",
    color: "text-[#AC0F16]",
    icon: AlertCircle,
    badgeClass: "bg-red-50 text-[#AC0F16] border-red-200",
    progressColor: "bg-[#AC0F16]",
    order: 1,
  },
  warning: {
    label: "Warning (≤14d)",
    color: "text-[#F1782F]",
    icon: AlertTriangle,
    badgeClass: "bg-[#fef3eb] text-[#F1782F] border-[#F1782F]/30",
    progressColor: "bg-[#F1782F]",
    order: 2,
  },
  caution: {
    label: "Caution (≤30d)",
    color: "text-[#2EAFC5]",
    icon: Timer,
    badgeClass: "bg-[#e6f7fa] text-[#2EAFC5] border-[#2EAFC5]/30",
    progressColor: "bg-[#2EAFC5]",
    order: 3,
  },
};

export function ExpiringReportClient({ data }: ExpiringReportClientProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "days_until_expiry", desc: false },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Get unique categories
  const categories = useMemo(
    () => Array.from(new Set(data.items.map((i) => i.category))).sort(),
    [data.items]
  );

  // Filter items
  const filteredData = useMemo(() => {
    return data.items.filter((item) => {
      const matchesUrgency = urgencyFilter === "all" || item.urgency === urgencyFilter;
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      return matchesUrgency && matchesCategory;
    });
  }, [data.items, urgencyFilter, categoryFilter]);

  // Define columns for Tanstack Table
  const columns: ColumnDef<ExpiringItem>[] = useMemo(
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
              href={`/admin/inventory/${row.original.product_id}/batches`}
              className="font-medium text-foreground hover:text-primary hover:underline block truncate"
              title={row.original.product_name}
            >
              {row.original.product_name}
            </Link>
            <p className="text-xs text-muted-foreground truncate">
              {row.original.category}
              {row.original.batch_number && ` • Batch: ${row.original.batch_number}`}
            </p>
          </div>
        ),
        filterFn: (row, _, value) => {
          const item = row.original;
          const searchLower = value.toLowerCase();
          return (
            item.product_name.toLowerCase().includes(searchLower) ||
            item.category.toLowerCase().includes(searchLower) ||
            (item.barcode?.toLowerCase().includes(searchLower) ?? false) ||
            (item.batch_number?.toLowerCase().includes(searchLower) ?? false)
          );
        },
        size: 200,
      },
      {
        accessorKey: "urgency",
        header: ({ column }) => (
          <SortableHeader column={column}>
            Status
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const config = urgencyConfig[row.original.urgency];
          const StatusIcon = config.icon;
          return (
            <Badge variant="outline" className={config.badgeClass}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
          );
        },
        sortingFn: (rowA, rowB) => {
          return urgencyConfig[rowA.original.urgency].order - urgencyConfig[rowB.original.urgency].order;
        },
        size: 140,
      },
      {
        accessorKey: "expiry_date",
        header: () => (
          <div className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
            Expiry Date
          </div>
        ),
        cell: ({ row }) => (
          <div className="font-mono tabular-nums text-sm">
            {format(new Date(row.original.expiry_date), "MMM d, yyyy")}
          </div>
        ),
        size: 110,
      },
      {
        accessorKey: "days_until_expiry",
        header: ({ column }) => (
          <SortableHeader column={column}>
            Days Left
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const days = row.original.days_until_expiry;
          const config = urgencyConfig[row.original.urgency];
          const progressValue = days <= 0 ? 100 : Math.max(0, Math.min(100, ((30 - days) / 30) * 100));
          
          return (
            <div className="flex items-center gap-2 min-w-[100px]">
              <div className="flex-1">
                <Progress 
                  value={progressValue} 
                  className="h-2 bg-stone-200"
                  indicatorClassName={config.progressColor}
                />
              </div>
              <span className={`font-mono tabular-nums text-sm font-medium min-w-[55px] text-right ${config.color}`}>
                {days <= 0 ? "EXPIRED" : `${days}d`}
              </span>
            </div>
          );
        },
        size: 160,
      },
      {
        accessorKey: "quantity",
        header: () => (
          <div className="text-right font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
            Qty
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums">{row.original.quantity.toLocaleString()}</div>
        ),
        size: 70,
      },
      {
        accessorKey: "value_at_risk",
        header: ({ column }) => (
          <div className="text-right">
            <SortableHeader column={column} className="justify-end">
              Value at Risk
            </SortableHeader>
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-[#AC0F16] font-medium">
            ₱{row.original.value_at_risk.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        ),
        size: 130,
      },
      {
        accessorKey: "supplier_name",
        header: () => (
          <div className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide print:hidden">
            Supplier
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground max-w-[120px] truncate print:hidden">
            {row.original.supplier_name || "—"}
          </div>
        ),
        size: 120,
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
        (item.barcode?.toLowerCase().includes(searchLower) ?? false) ||
        (item.batch_number?.toLowerCase().includes(searchLower) ?? false)
      );
    },
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  // Print table data - ALL rows for print preview
  const printTableData = useMemo(() => {
    const headers = ["Product", "Category", "Status", "Expiry Date", "Days Left", "Qty", "Value at Risk"];
    const rows = filteredData.map(item => [
      item.product_name,
      item.category,
      urgencyConfig[item.urgency].label,
      format(new Date(item.expiry_date), "MMM d, yyyy"),
      item.days_until_expiry <= 0 ? "EXPIRED" : `${item.days_until_expiry}d`,
      item.quantity.toLocaleString(),
      `₱${item.value_at_risk.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    ]);
    return { headers, rows };
  }, [filteredData]);

  // Excel export configuration
  const excelExport = {
    filename: "expiry_tracker_report",
    sheetName: "Expiry Tracker",
    getData: async () => ({
      columns: [
        { header: "Product", key: "product_name", width: 30 },
        { header: "Category", key: "category", width: 15 },
        { header: "Barcode", key: "barcode", width: 15 },
        { header: "Batch #", key: "batch_number", width: 15 },
        { header: "Status", key: "urgency", width: 15 },
        { header: "Expiry Date", key: "expiry_date", width: 12 },
        { header: "Days Left", key: "days_until_expiry", width: 10 },
        { header: "Quantity", key: "quantity", width: 10 },
        { header: "Cost/Unit (₱)", key: "cost_price", width: 12 },
        { header: "Value at Risk (₱)", key: "value_at_risk", width: 15 },
        { header: "Supplier", key: "supplier_name", width: 20 },
      ],
      rows: filteredData.map((item) => ({
        product_name: item.product_name,
        category: item.category,
        barcode: item.barcode || "",
        batch_number: item.batch_number || "",
        urgency: urgencyConfig[item.urgency].label,
        expiry_date: format(new Date(item.expiry_date), "yyyy-MM-dd"),
        days_until_expiry: item.days_until_expiry,
        quantity: item.quantity,
        cost_price: item.cost_price,
        value_at_risk: item.value_at_risk,
        supplier_name: item.supplier_name || "",
      })),
    }),
  };

  return (
    <ReportShell
      title="Expiry Tracker"
      description="Products expiring within 30 days. FEFO (First Expired, First Out) compliance monitoring."
      icon={CalendarClock}
      generatedBy="Admin"
      excelExport={excelExport}
      printTableData={printTableData}
    >
      {/* Filters - Screen Only */}
      <div className="flex flex-col sm:flex-row gap-3 print-hidden" data-print-hidden="true">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, batches..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Urgency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="critical">Critical (≤7d)</SelectItem>
            <SelectItem value="warning">Warning (≤14d)</SelectItem>
            <SelectItem value="caution">Caution (≤30d)</SelectItem>
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
          label="Expired"
          value={data.summary.expired_count.toLocaleString()}
          icon={XCircle}
          variant="danger"
        />
        <ReportSummaryCard
          label="Critical (≤7 days)"
          value={data.summary.critical_count.toLocaleString()}
          icon={AlertCircle}
          variant="danger"
        />
        <ReportSummaryCard
          label="Warning (≤14 days)"
          value={data.summary.warning_count.toLocaleString()}
          icon={AlertTriangle}
          variant="warning"
        />
        <ReportSummaryCard
          label="Total Value at Risk"
          value={`₱${data.summary.total_value_at_risk.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          variant="danger"
        />
      </div>

      {/* Urgency Breakdown */}
      <ReportSection title="Urgency Breakdown">
        <div className="bg-[#f5f3ef] dark:bg-muted/30 rounded-lg p-4 border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <XCircle className="h-5 w-5 text-[#AC0F16]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expired</p>
                <p className="text-xl font-bold font-mono text-[#AC0F16] tabular-nums">
                  {data.summary.expired_count.toLocaleString()} batches
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertCircle className="h-5 w-5 text-[#AC0F16]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Within 7 Days</p>
                <p className="text-xl font-bold font-mono text-[#AC0F16] tabular-nums">
                  {data.summary.critical_count.toLocaleString()} batches
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#F1782F]/10">
                <AlertTriangle className="h-5 w-5 text-[#F1782F]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Within 14 Days</p>
                <p className="text-xl font-bold font-mono text-[#F1782F] tabular-nums">
                  {data.summary.warning_count.toLocaleString()} batches
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#2EAFC5]/10">
                <Timer className="h-5 w-5 text-[#2EAFC5]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Within 30 Days</p>
                <p className="text-xl font-bold font-mono text-[#2EAFC5] tabular-nums">
                  {data.summary.caution_count.toLocaleString()} batches
                </p>
              </div>
            </div>
          </div>
        </div>
      </ReportSection>

      {/* Alert for critical items */}
      {(data.summary.expired_count > 0 || data.summary.critical_count > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 print-hidden" data-print-hidden="true">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-[#AC0F16] mt-0.5" />
            <div>
              <p className="font-medium text-[#AC0F16]">Immediate Action Required</p>
              <p className="text-sm text-red-700 mt-1">
                {data.summary.expired_count > 0 && (
                  <span>
                    <strong>{data.summary.expired_count}</strong> batch(es) have already expired.{" "}
                  </span>
                )}
                {data.summary.critical_count > 0 && (
                  <span>
                    <strong>{data.summary.critical_count}</strong> batch(es) will expire within 7 days.
                  </span>
                )}
                {" "}Consider running promotions, bundling, or returning to supplier.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Table */}
      <ReportSection
        title="Expiring Batches"
        description={`${table.getFilteredRowModel().rows.length} batches`}
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
                        <p>No expiring products found within 30 days.</p>
                        <p className="text-xs">Your inventory is in good shape!</p>
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

      {/* FEFO Recommendations */}
      <div className="print-hidden" data-print-hidden="true">
        <ReportSection title="FEFO Compliance Tips">
          <div className="bg-[#2EAFC5]/5 border border-[#2EAFC5]/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CalendarClock className="h-5 w-5 text-[#2EAFC5] mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-[#2EAFC5]">First Expired, First Out (FEFO)</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Always sell items with nearest expiry date first</li>
                  <li>Run promotions on items expiring within 14 days</li>
                  <li>Consider return-to-supplier for items nearing expiry</li>
                  <li>Monitor this report weekly to prevent wastage</li>
                </ul>
              </div>
            </div>
          </div>
        </ReportSection>
      </div>
    </ReportShell>
  );
}
