"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  X,
  Upload,
  Download,
  Receipt,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Database,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TransactionSheet } from "@/components/sales/transaction-sheet";
import { ImportSalesDialog } from "@/components/sales/import-sales-dialog";
import {
  getSalesHistory,
  type SalesHistoryResult,
  type DateRange,
} from "@/actions/sales";
import { backfillSalesAggregates, getAggregationStatus } from "@/actions/settings";

interface SalesHistoryClientProps {
  initialData: SalesHistoryResult;
}

/**
 * SalesHistoryClient - Table-based layout matching Inventory Page
 * Features:
 * - Single-row toolbar with search, filters, KPI chips, and actions
 * - Table with internal scroll
 * - Pagination at bottom
 */
export function SalesHistoryClient({ initialData }: SalesHistoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SalesHistoryResult>(initialData);
  const [selectedRange, setSelectedRange] = useState<DateRange>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Track which receipt to auto-open from URL params
  const [autoOpenReceipt, setAutoOpenReceipt] = useState<string | null>(null);

  // Check for auto-open receipt from URL params
  const receiptParam = searchParams.get("receipt");
  const viewParam = searchParams.get("view");

  useEffect(() => {
    if (receiptParam && viewParam === "true") {
      setAutoOpenReceipt(receiptParam);
      router.replace("/admin/sales", { scroll: false });
    }
  }, [receiptParam, viewParam, router]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  // Filter transactions by search (receipt # OR date string)
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return data.transactions;
    
    const query = searchQuery.toLowerCase();
    return data.transactions.filter((tx) => {
      // Search by receipt number
      if (tx.receipt_no.toLowerCase().includes(query)) return true;
      // Search by formatted date string (e.g., "Dec 15, 2025, 02:58 PM")
      const dateStr = formatDate(tx.created_at).toLowerCase();
      if (dateStr.includes(query)) return true;
      if (tx.payment_method?.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [data.transactions, searchQuery]);

  // Handle date range change
  const handleRangeChange = (range: DateRange) => {
    setSelectedRange(range);
    setCurrentPage(1);
    
    startTransition(async () => {
      const newData = await getSalesHistory(range, 1, pageSize);
      setData(newData);
    });
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    
    startTransition(async () => {
      const newData = await getSalesHistory(selectedRange, newPage, pageSize);
      setData(newData);
    });
  };

  // Handle import success
  const handleImportSuccess = () => {
    router.refresh();
    startTransition(async () => {
      const newData = await getSalesHistory(selectedRange, currentPage, pageSize);
      setData(newData);
    });
    toast.success("Sales history imported successfully");
  };

  // Format date for export
  const formatDateForExport = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  // Export to CSV with enhanced formatting
  const handleExportCSV = () => {
    const headers = [
      "Date",
      "Time",
      "Receipt No",
      "Items Count",
      "Item Details",
      "Total Amount (PHP)",
      "Cost (PHP)",
      "Profit (PHP)",
      "Profit Margin %",
      "Payment Method",
      "GCash Ref",
      "Status",
    ];
    
    const rows = data.transactions.map((tx) => {
      const d = new Date(tx.created_at);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const cost = tx.items.reduce((sum, item) => sum + (item.cost_at_sale * item.quantity), 0);
      const profit = tx.total_amount - cost;
      const margin = tx.total_amount > 0 ? ((profit / tx.total_amount) * 100).toFixed(1) : "0";
      const itemDetails = tx.items.map(i => `${i.quantity}x ${i.product_name}`).join("; ");
      
      return [
        dateStr,
        timeStr,
        tx.receipt_no.substring(0, 8),
        tx.itemsCount,
        `"${itemDetails}"`,
        tx.total_amount.toFixed(2),
        cost.toFixed(2),
        profit.toFixed(2),
        margin,
        tx.payment_method || "",
        tx.gcash_reference_no || "",
        tx.status,
      ];
    });

    const BOM = "\uFEFF";
    const csvContent = BOM + [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  // Handle analytics sync
  const handleSyncAnalytics = async () => {
    setIsSyncing(true);
    toast.info("Syncing analytics data...");
    
    try {
      const result = await backfillSalesAggregates();
      if (result.success) {
        toast.success(`Analytics synced: ${result.daysProcessed} days, ${result.recordsCreated.toLocaleString()} product records`);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to sync analytics");
      }
    } catch (error) {
      toast.error("Failed to sync analytics data");
    } finally {
      setIsSyncing(false);
    }
  };

  // Check if filters are active
  const hasActiveFilters = !!searchQuery || selectedRange !== "all";

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedRange("all");
    setCurrentPage(1);
    startTransition(async () => {
      const newData = await getSalesHistory("all", 1, pageSize);
      setData(newData);
    });
  };

  // Pagination
  const totalPages = Math.ceil(data.totalCount / pageSize);

  // Payment method badge
  const getPaymentMethodBadge = (method: string | null) => {
    if (!method) return <span className="text-muted-foreground text-xs">—</span>;
    return method === "CASH" ? (
      <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
        CASH
      </Badge>
    ) : (
      <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
        GCASH
      </Badge>
    );
  };

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Table Toolbar - Single Row (matching inventory) */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by receipt # or date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 w-full"
          />
        </div>

        {/* Date Range Filter */}
        <Select value={selectedRange} onValueChange={(value) => handleRangeChange(value as DateRange)}>
          <SelectTrigger className="h-10 w-[140px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 days</SelectItem>
            <SelectItem value="month">Last 30 days</SelectItem>
            <SelectItem value="year">Last 12 months</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={resetFilters}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Reset filters</span>
          </Button>
        )}

        {/* Separator */}
        <div className="h-8 w-px bg-border mx-1" />

        {/* Results Count Only */}
        <div className="flex items-center gap-2 h-10 px-3 rounded-md bg-muted/30 border border-border/40">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{data.totalCount.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">Sales</span>
        </div>

        {/* Separator */}
        <div className="h-8 w-px bg-border mx-1" />

        {/* Sync Analytics */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={handleSyncAnalytics}
                disabled={isSyncing}
                className="h-10 gap-1.5"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Sync Analytics</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Rebuild analytics aggregates from transaction data</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Import CSV */}
        <Button
          variant="outline"
          onClick={() => setIsImportDialogOpen(true)}
          className="h-10 gap-1.5"
        >
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>

        {/* Export CSV */}
        <Button
          variant="outline"
          onClick={handleExportCSV}
          className="h-10 gap-1.5"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Table Container with Internal Scroll */}
      <div className="flex-1 min-h-0 rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 bg-muted/30">Date</TableHead>
                <TableHead className="h-10 bg-muted/30 hidden sm:table-cell">Receipt #</TableHead>
                <TableHead className="h-10 bg-muted/30 hidden md:table-cell">Items</TableHead>
                <TableHead className="h-10 bg-muted/30">Total</TableHead>
                <TableHead className="h-10 bg-muted/30 hidden lg:table-cell">COGS</TableHead>
                <TableHead className="h-10 bg-muted/30 hidden md:table-cell">Profit</TableHead>
                <TableHead className="h-10 bg-muted/30">Payment</TableHead>
                <TableHead className="h-10 bg-muted/30 hidden sm:table-cell">Status</TableHead>
                <TableHead className="h-10 bg-muted/30">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
                      <Receipt className="h-8 w-8 opacity-50" />
                      <p>No transactions found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((transaction) => {
                  const cogs = transaction.items.reduce(
                    (sum, item) => sum + (item.cost_at_sale * item.quantity),
                    0
                  );
                  const profit = transaction.total_amount - cogs;

                  return (
                    <TableRow key={transaction.transaction_id}>
                      <TableCell className="py-2 font-medium text-xs sm:text-sm">
                        {formatDate(transaction.created_at)}
                      </TableCell>
                      <TableCell className="py-2 hidden sm:table-cell">
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {transaction.receipt_no.substring(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell className="py-2 hidden md:table-cell">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm">
                            {transaction.itemsCount} item{transaction.itemsCount !== 1 ? "s" : ""}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {transaction.items.slice(0, 1).map((item, i) => (
                              <div key={i}>
                                {item.quantity}x {item.product_name.substring(0, 18)}{item.product_name.length > 18 ? "..." : ""}
                              </div>
                            ))}
                            {transaction.items.length > 1 && (
                              <div>+{transaction.items.length - 1} more</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 font-medium font-mono text-xs sm:text-sm">
                        {formatCurrency(transaction.total_amount)}
                      </TableCell>
                      <TableCell className="py-2 font-mono text-sm text-muted-foreground hidden lg:table-cell">
                        {formatCurrency(cogs)}
                      </TableCell>
                      <TableCell className="py-2 hidden md:table-cell">
                        <span className={`font-medium font-mono text-sm ${profit >= 0 ? "text-emerald-700/90 dark:text-emerald-400/90" : "text-red-600/90 dark:text-red-400/90"}`}>
                          {formatCurrency(profit)}
                        </span>
                      </TableCell>
                      <TableCell className="py-2">
                        {getPaymentMethodBadge(transaction.payment_method)}
                      </TableCell>
                      <TableCell className="py-2 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={transaction.status === "COMPLETED" ? "default" : "destructive"}>
                            {transaction.status}
                          </Badge>
                          {transaction.order_id && (
                            <Badge variant="outline" className="text-[10px] bg-secondary/10 text-secondary border-secondary/30">
                              PRE-ORDER
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <TransactionSheet transaction={transaction} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination Footer - Matching Inventory DataTablePagination Style */}
      <div className="shrink-0">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-2">
          {/* Left: Showing info + Rows per page */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Showing <span className="font-medium text-foreground">{data.totalCount > 0 ? ((currentPage - 1) * pageSize + 1).toLocaleString() : 0}</span> to{" "}
              <span className="font-medium text-foreground">{Math.min(currentPage * pageSize, data.totalCount).toLocaleString()}</span> of{" "}
              <span className="font-medium text-foreground">{data.totalCount.toLocaleString()}</span> transactions
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs">Rows per page</span>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
                  startTransition(async () => {
                    const newData = await getSalesHistory(selectedRange, 1, Number(value));
                    setData(newData);
                  });
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 50].map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right: Page navigation */}
          <div className="flex items-center gap-1">
            {/* First Page */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1 || isPending}
            >
              <ChevronsLeft className="h-4 w-4" />
              <span className="sr-only">First page</span>
            </Button>

            {/* Previous Page */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Previous page</span>
            </Button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {(() => {
                const pages: (number | "ellipsis")[] = [];
                const maxVisiblePages = 5;

                if (totalPages <= maxVisiblePages + 2) {
                  for (let i = 1; i <= totalPages; i++) {
                    pages.push(i);
                  }
                } else {
                  pages.push(1);

                  if (currentPage > 3) {
                    pages.push("ellipsis");
                  }

                  const startPage = Math.max(2, currentPage - 1);
                  const endPage = Math.min(totalPages - 1, currentPage + 1);

                  for (let i = startPage; i <= endPage; i++) {
                    if (!pages.includes(i)) {
                      pages.push(i);
                    }
                  }

                  if (currentPage < totalPages - 2) {
                    pages.push("ellipsis");
                  }

                  if (!pages.includes(totalPages)) {
                    pages.push(totalPages);
                  }
                }

                return pages.map((page, idx) =>
                  page === "ellipsis" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-2 text-muted-foreground"
                    >
                      ...
                    </span>
                  ) : (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      className="h-8 min-w-8 px-2 text-xs"
                      onClick={() => handlePageChange(page)}
                      disabled={isPending}
                    >
                      {page.toLocaleString()}
                    </Button>
                  )
                );
              })()}
            </div>

            {/* Next Page */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0 || isPending}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Next page</span>
            </Button>

            {/* Last Page */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0 || isPending}
            >
              <ChevronsRight className="h-4 w-4" />
              <span className="sr-only">Last page</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Import Sales Dialog */}
      <ImportSalesDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
