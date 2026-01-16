"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { format, subDays, startOfMonth, differenceInDays } from "date-fns";
import { DateRange } from "react-day-picker";
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
  TrendingDown,
  Calendar,
  XCircle,
  FileText,
  Loader2,
  Banknote,
  Smartphone,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ReportShell,
} from "@/components/reports/report-shell";
import { SortableHeader } from "@/components/ui/sortable-header";
import { DataTablePagination } from "@/components/data-table-pagination";
import { DateRangePickerWithPresets } from "@/components/ui/date-range-picker-with-presets";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { getZReadHistory, type ZReadHistoryResult, type ZReadRecord } from "@/actions/reports";
import { cn } from "@/lib/utils";

// Chart type toggle state
type ChartType = "sales" | "profit" | "payment";

interface ZReadReportClientProps {
  initialData: ZReadHistoryResult;
}

// Helper: Capitalize first letter of each word
function capitalizeWords(str: string | null): string {
  if (!str) return "Unknown";
  return str
    .split(/[\s_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Helper: Format peso with medium weight (returns JSX)
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

// Helper: Format peso as string (for subtitles etc.)
function formatPesoString(amount: number, decimals: number = 2): string {
  const formatted = amount.toLocaleString(undefined, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
  return `₱${formatted}`;
}

// ============================================================================
// Data bar component for visual value representation
// ============================================================================

function DataBar({ value, max, color = "#2EAFC5" }: { value: number; max: number; color?: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div 
      className="absolute inset-0 opacity-15 rounded-sm"
      style={{ 
        background: `linear-gradient(to right, ${color} ${percentage}%, transparent ${percentage}%)`,
      }}
    />
  );
}

// ============================================================================
// Compact Summary Card
// ============================================================================

interface CompactCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  variant?: "default" | "success";
  trend?: { value: number; label: string };
}

function CompactCard({ label, value, subtitle, icon: Icon, variant = "default", trend }: CompactCardProps) {
  const bgClass = variant === "success" ? "bg-[#2EAFC5]/5 border-[#2EAFC5]/20" : "bg-card border-stone-200/80";
  const valueClass = variant === "success" ? "text-[#2EAFC5]" : "text-foreground";
  const iconClass = variant === "success" ? "bg-[#2EAFC5]/10 text-[#2EAFC5]" : "bg-stone-100 text-stone-600";

  return (
    <Card className={cn("border shadow-sm h-full", bgClass)}>
      <CardContent className="p-3 py-4 h-full flex flex-col">
        <div className="flex items-start gap-2 top-2">
          <div className={cn("p-1.5 rounded-lg", iconClass)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-muted-foreground uppercase tracking-wider font-medium">
              {label}
            </p>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <p className={cn("text-base font-bold text-[3.5vh] tabular-nums font-mono", valueClass)}>
                {value}
              </p>
              {trend && trend.value !== 0 && (
                <Badge className={cn(
                  "text-[13px] h-4 gap-0.5 px-1",
                  trend.value > 0 
                    ? "bg-[#2EAFC5]/10 text-[#2EAFC5] hover:bg-[#2EAFC5]/20" 
                    : "bg-[#AC0F16]/10 text-[#AC0F16] hover:bg-[#AC0F16]/20"
                )}>
                  {trend.value > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {Math.abs(trend.value)}%
                </Badge>
              )}
            </div>
            {subtitle && <p className="text-[12px] text-muted-foreground">{subtitle}</p>}
            {trend && <p className="text-[11px] text-muted-foreground">{trend.label}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Large Summary Card (for Sales & Profit)
// ============================================================================

interface LargeCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
}

function LargeCard({ label, value, subtitle, icon: Icon, trend }: LargeCardProps) {
  return (
    <Card className="border shadow-sm h-full bg-[#2EAFC5]/5 border-[#2EAFC5]/20">
      <CardContent className="p-4 h-full flex flex-col justify-center">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-[#2EAFC5]/10 shrink-0">
            <Icon className="h-5 w-5 text-[#2EAFC5]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
              {label}
            </p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-2xl font-bold tabular-nums font-mono text-[#2EAFC5]">
                {value}
              </p>
              {trend && trend.value !== 0 && (
                <Badge className={cn(
                  "text-[10px] h-5 gap-0.5 px-1.5",
                  trend.value > 0 
                    ? "bg-[#2EAFC5]/10 text-[#2EAFC5] hover:bg-[#2EAFC5]/20" 
                    : "bg-[#AC0F16]/10 text-[#AC0F16] hover:bg-[#AC0F16]/20"
                )}>
                  {trend.value > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(trend.value)}%
                </Badge>
              )}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            {trend && <p className="text-[10px] text-muted-foreground">{trend.label}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ZReadReportClient({ initialData }: ZReadReportClientProps) {
  // Initialize date range to "This Month" (1st of month to today)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return {
      from: startOfMonth(today),
      to: today,
    };
  });
  
  const [data, setData] = useState<ZReadHistoryResult>(initialData);
  const [isPending, startTransition] = useTransition();
  const [activeChart, setActiveChart] = useState<ChartType>("sales");
  
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);

  // Handle date range change - fetch new data
  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    setDateRange(newRange);
    
    if (newRange?.from && newRange?.to) {
      startTransition(async () => {
        const newData = await getZReadHistory({ from: newRange.from!, to: newRange.to! });
        setData(newData);
      });
    }
  }, []);

  // Sort records by date (newest first)
  const sortedRecords = useMemo(() => {
    return [...data.records].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [data.records]);

  // Calculate derived values and trends
  const stats = useMemo(() => {
    const records = sortedRecords;
    const totalDays = data.summary.total_days;
    
    const today = new Date();
    const currentMonthStart = startOfMonth(today);
    const daysIntoMonth = differenceInDays(today, currentMonthStart) + 1;
    const periodDays = Math.min(daysIntoMonth, 14);
    
    const currentPeriodRecords = records.filter(r => {
      const date = new Date(r.date);
      return date >= subDays(today, periodDays);
    });
    
    const previousPeriodRecords = records.filter(r => {
      const date = new Date(r.date);
      const periodStart = subDays(today, periodDays * 2);
      const periodEnd = subDays(today, periodDays);
      return date >= periodStart && date < periodEnd;
    });
    
    const currentSales = currentPeriodRecords.reduce((sum, r) => sum + r.gross_sales, 0);
    const previousSales = previousPeriodRecords.reduce((sum, r) => sum + r.gross_sales, 0);
    
    const currentProfit = currentPeriodRecords.reduce((sum, r) => sum + r.gross_profit, 0);
    const previousProfit = previousPeriodRecords.reduce((sum, r) => sum + r.gross_profit, 0);
    
    const currentTxn = currentPeriodRecords.reduce((sum, r) => sum + r.transaction_count, 0);
    const previousTxn = previousPeriodRecords.reduce((sum, r) => sum + r.transaction_count, 0);
    
    const salesTrend = previousSales > 0 
      ? Math.round(((currentSales - previousSales) / previousSales) * 100)
      : 0;
    
    const profitTrend = previousProfit > 0
      ? Math.round(((currentProfit - previousProfit) / previousProfit) * 100)
      : 0;
    
    const txnTrend = previousTxn > 0
      ? Math.round(((currentTxn - previousTxn) / previousTxn) * 100)
      : 0;
    
    const avgTransactionsPerDay = totalDays > 0 ? Math.round(data.summary.total_transactions / totalDays) : 0;
    const avgProfitPerDay = totalDays > 0 ? data.summary.total_profit / totalDays : 0;
    
    const maxGrossSales = Math.max(...records.map(r => r.gross_sales), 1);
    const totalVoids = records.reduce((sum, r) => sum + r.void_count, 0);
    const hasVoids = totalVoids > 0;
    
    return {
      avgTransactionsPerDay,
      avgProfitPerDay,
      salesTrend,
      profitTrend,
      txnTrend,
      maxGrossSales,
      hasVoids,
      totalVoids,
      periodDays,
    };
  }, [sortedRecords, data.summary]);

  // Chart data - transform records for visualization (ascending date order for charts)
  const chartData = useMemo(() => {
    return [...sortedRecords]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((r) => ({
        date: format(new Date(r.date), "MMM d"),
        sales: r.gross_sales,
        profit: r.gross_profit,
        cash: r.cash_sales,
        gcash: r.gcash_sales,
      }));
  }, [sortedRecords]);

  const printSummary = [
    { label: "Days Tracked", value: data.summary.total_days.toLocaleString() },
    { label: "Total Transactions", value: data.summary.total_transactions.toLocaleString() },
    { label: "Total Gross Sales", value: `₱${data.summary.total_gross_sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
    { label: "Total Profit", value: `₱${data.summary.total_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
  ];

  // Define columns - Following Inventory table golden standard (LEFT-aligned)
  const columns: ColumnDef<ZReadRecord>[] = useMemo(() => {
    const baseColumns: ColumnDef<ZReadRecord>[] = [
      {
        accessorKey: "date",
        header: ({ column }) => (
          <SortableHeader column={column}>
            Date
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="font-medium text-foreground whitespace-nowrap">
            {format(new Date(row.original.date), "EEE, MMM d, yyyy")}
          </div>
        ),
      },
      {
        accessorKey: "transaction_count",
        header: () => (
          <span className="uppercase text-[11px] font-semibold tracking-wider text-muted-foreground">
            Txn
          </span>
        ),
        cell: ({ row }) => (
          <div className="font-mono tabular-nums text-sm">
            {row.original.transaction_count.toLocaleString()}
          </div>
        ),
      },
      {
        accessorKey: "gross_sales",
        header: ({ column }) => (
          <SortableHeader column={column}>
            Gross Sales
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="relative font-mono tabular-nums font-medium text-sm py-1 px-2 -mx-2">
            <DataBar 
              value={row.original.gross_sales} 
              max={stats.maxGrossSales} 
              color="#2EAFC5"
            />
            <span className="relative z-10">
              {formatPeso(row.original.gross_sales)}
            </span>
          </div>
        ),
      },
    ];
    
    // Only include Voids column if there are any voids
    if (stats.hasVoids) {
      baseColumns.push({
        accessorKey: "void_amount",
        header: () => (
          <span className="uppercase text-[11px] font-semibold tracking-wider text-muted-foreground">
            Voids
          </span>
        ),
        cell: ({ row }) =>
          row.original.void_count > 0 ? (
            <Badge variant="outline" className="bg-[#AC0F16]/10 text-[#AC0F16] border-[#AC0F16]/30 font-mono text-xs font-bold">
              <XCircle className="h-3 w-3 mr-1" />
              {row.original.void_count} (₱{row.original.void_amount.toLocaleString()})
            </Badge>
          ) : (
            <span className="text-stone-300 text-xs">—</span>
          ),
      });
    }
    
    // Continue with remaining columns - ALL LEFT-ALIGNED
    baseColumns.push(
      {
        accessorKey: "gross_profit",
        header: ({ column }) => (
          <SortableHeader column={column}>
            Profit
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="font-mono tabular-nums text-[#2EAFC5] font-medium text-sm">
            {formatPeso(row.original.gross_profit)}
          </div>
        ),
      },
      {
        accessorKey: "cash_sales",
        header: () => (
          <span className="uppercase text-[11px] font-semibold tracking-wider text-muted-foreground">
            Cash
          </span>
        ),
        cell: ({ row }) => (
          <div className="font-mono tabular-nums text-sm">
            {formatPeso(row.original.cash_sales)}
          </div>
        ),
      },
      {
        accessorKey: "gcash_sales",
        header: () => (
          <span className="uppercase text-[11px] font-semibold tracking-wider text-muted-foreground">
            GCash
          </span>
        ),
        cell: ({ row }) => (
          <div className="font-mono tabular-nums text-sm">
            {formatPeso(row.original.gcash_sales)}
          </div>
        ),
      },
      {
        accessorKey: "closed_by",
        header: () => (
          <span className="uppercase text-[11px] font-semibold tracking-wider text-muted-foreground">
            Closed By
          </span>
        ),
        cell: ({ row }) => {
          const name = capitalizeWords(row.original.closed_by);
          const displayName = name.length > 12 ? name.slice(0, 12) + "." : name;
          return (
            <span className="text-sm text-muted-foreground" title={name}>
              {displayName}
            </span>
          );
        },
      }
    );
    
    return baseColumns;
  }, [stats.maxGrossSales, stats.hasVoids]);

  const table = useReactTable({
    data: sortedRecords,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  const excelExport = {
    filename: "daily_sales_log",
    sheetName: "Daily Sales Log",
    getData: async () => ({
      columns: [
        { header: "Date", key: "date", width: 15 },
        { header: "Transactions", key: "transaction_count", width: 14 },
        { header: "Gross Sales (₱)", key: "gross_sales", width: 16 },
        { header: "COGS (₱)", key: "total_cost", width: 14 },
        { header: "Gross Profit (₱)", key: "gross_profit", width: 16 },
        { header: "Cash Sales (₱)", key: "cash_sales", width: 15 },
        { header: "GCash Sales (₱)", key: "gcash_sales", width: 15 },
        ...(stats.hasVoids ? [
          { header: "Void Count", key: "void_count", width: 12 },
          { header: "Void Amount (₱)", key: "void_amount", width: 14 },
        ] : []),
        { header: "Closed By", key: "closed_by", width: 15 },
      ],
      rows: sortedRecords.map((r) => ({
        date: format(new Date(r.date), "yyyy-MM-dd"),
        transaction_count: r.transaction_count,
        gross_sales: r.gross_sales,
        total_cost: r.total_cost,
        gross_profit: r.gross_profit,
        cash_sales: r.cash_sales,
        gcash_sales: r.gcash_sales,
        ...(stats.hasVoids ? {
          void_count: r.void_count,
          void_amount: r.void_amount,
        } : {}),
        closed_by: r.closed_by || "",
      })),
    }),
  };

  const trendLabel = `vs previous ${stats.periodDays} days`;

  // Build date range for ReportShell
  const shellDateRange = dateRange?.from && dateRange?.to 
    ? { from: dateRange.from, to: dateRange.to }
    : undefined;

  // Build print table data with ALL rows (not just paginated)
  const printTableData = useMemo(() => {
    const headers = [
      "Date",
      "Transactions",
      "Gross Sales",
      ...(stats.hasVoids ? ["Voids"] : []),
      "Profit",
      "Cash",
      "GCash",
      "Closed By",
    ];
    
    const rows = sortedRecords.map(r => [
      format(new Date(r.date), "EEE, MMM d, yyyy"),
      r.transaction_count.toLocaleString(),
      `₱${r.gross_sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      ...(stats.hasVoids ? [r.void_count > 0 ? `${r.void_count} (₱${r.void_amount.toLocaleString()})` : "—"] : []),
      `₱${r.gross_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `₱${r.cash_sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `₱${r.gcash_sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      capitalizeWords(r.closed_by),
    ]);
    
    return { headers, rows };
  }, [sortedRecords, stats.hasVoids]);

  return (
    <ReportShell
      title="Daily Sales Log"
      description="Daily closure reports with gross sales, payment breakdown, and transaction totals"
      icon={Receipt}
      generatedBy="Admin"
      dateRange={shellDateRange}
      excelExport={excelExport}
      printSummary={printSummary}
      toolbarContent={
        <DateRangePickerWithPresets
          date={dateRange}
          onDateChange={handleDateRangeChange}
          align="end"
        />
      }
      printTableData={printTableData}
    >
      {/* Summary Cards - Days/Txn small, Sales/Profit large */}
      <LoadingOverlay isLoading={isPending}>
        <div className="grid grid-cols-12 gap-3">
          {/* Small Cards */}
          <div className="col-span-2">
            <CompactCard
              label="Days"
              value={data.summary.total_days.toString()}
              subtitle={`${stats.avgTransactionsPerDay} txn/day`}
              icon={Calendar}
            />
          </div>
          <div className="col-span-2">
            <CompactCard
              label="Transactions"
              value={data.summary.total_transactions.toLocaleString()}
              icon={Receipt}
              trend={stats.txnTrend !== 0 ? { value: stats.txnTrend, label: trendLabel } : undefined}
            />
          </div>
          {/* Large Cards - Using formatPeso for non-bold peso sign */}
          <div className="col-span-4">
            <LargeCard
              label="Gross Sales"
              value={formatPeso(data.summary.total_gross_sales)}
              subtitle={`${formatPesoString(data.summary.avg_daily_sales, 0)}/day avg`}
              icon={DollarSign}
              trend={stats.salesTrend !== 0 ? { value: stats.salesTrend, label: trendLabel } : undefined}
            />
          </div>
          <div className="col-span-4">
            <LargeCard
              label="Profit"
              value={formatPeso(data.summary.total_profit)}
              subtitle={`${formatPesoString(stats.avgProfitPerDay, 0)}/day avg`}
              icon={TrendingUp}
              trend={stats.profitTrend !== 0 ? { value: stats.profitTrend, label: trendLabel } : undefined}
            />
          </div>
        </div>
      </LoadingOverlay>

      {/* Sales Trends Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Sales Trends</CardTitle>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              <button
                onClick={() => setActiveChart("sales")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  activeChart === "sales"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <DollarSign className="h-3.5 w-3.5 inline mr-1" />
                Sales
              </button>
              <button
                onClick={() => setActiveChart("profit")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  activeChart === "profit"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <TrendingUp className="h-3.5 w-3.5 inline mr-1" />
                Profit
              </button>
              <button
                onClick={() => setActiveChart("payment")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  activeChart === "payment"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Banknote className="h-3.5 w-3.5 inline mr-1" />
                Payment Methods
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {activeChart === "sales" ? (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2EAFC5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2EAFC5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#78716c" />
                  <YAxis 
                    tick={{ fontSize: 11 }} 
                    stroke="#78716c"
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e5e5",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`₱${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "Sales"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    name="Gross Sales"
                    stroke="#2EAFC5"
                    fill="url(#salesGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              ) : activeChart === "profit" ? (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#78716c" />
                  <YAxis 
                    tick={{ fontSize: 11 }} 
                    stroke="#78716c"
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e5e5",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`₱${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "Profit"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Gross Profit"
                    stroke="#22c55e"
                    fill="url(#profitGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#78716c" />
                  <YAxis 
                    tick={{ fontSize: 11 }} 
                    stroke="#78716c"
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e5e5",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`₱${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`]}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="cash" name="Cash" fill="#2EAFC5" radius={[2, 2, 0, 0]} stackId="payment" />
                  <Bar dataKey="gcash" name="GCash" fill="#AC0F16" radius={[2, 2, 0, 0]} stackId="payment" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Daily Records Table - Separate Card */}
      <LoadingOverlay isLoading={isPending}>
        <Card className="border-stone-200/80 bg-card pb-0 shadow-sm">
        <CardHeader className="py-0 px-4 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Daily Closure Records</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sortedRecords.length} days of history • Data bars show relative sales volume
                {!stats.hasVoids && ' • No voids recorded'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pb-0 rounded-lg pt-0 top-10 translate-y-[-5vh]">
          <div className="overflow-x-auto rounded-lg border border-stone-200/80">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
                    {headerGroup.headers.map((header) => (
                      <TableHead 
                        key={header.id} 
                        className="h-10 text-muted-foreground px-4"
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
                        <FileText className="h-8 w-8 text-muted-foreground/50" />
                        <p>No sales records found for this period.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-muted/30"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-4 py-2.5">
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
          <div className="px-3 mt-3 pb-0 border-t top-0 translate-y-2.5 border-stone-100" data-print-hidden="true">
            <DataTablePagination table={table} />
          </div>
        </CardContent>
      </Card>
      </LoadingOverlay>
    </ReportShell>
  );
}
