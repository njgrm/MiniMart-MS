"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  X,
  Upload,
  Download,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Calendar,
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
import { TransactionSheet } from "@/components/sales/transaction-sheet";
import { ImportSalesDialog } from "@/components/sales/import-sales-dialog";
import {
  getSalesHistory,
  type SalesHistoryResult,
  type DateRange,
} from "@/actions/sales";

interface SalesHistoryClientProps {
  initialData: SalesHistoryResult;
}

/**
 * SalesHistoryClient - Pixel-Perfect Match to Inventory Page
 * Features:
 * - Fixed height container (h-[calc(100vh-theme(spacing.16))])
 * - Header/Toolbar fixed at top
 * - Table wrapper with overflow-y-auto
 * - Pagination fixed at bottom
 * - Search by receipt # AND date string
 */
export function SalesHistoryClient({ initialData }: SalesHistoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SalesHistoryResult>(initialData);
  const [selectedRange, setSelectedRange] = useState<DateRange>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Check for auto-open receipt from URL params
  const receiptParam = searchParams.get("receipt");
  const viewParam = searchParams.get("view");

  useEffect(() => {
    // If receipt param exists and view=true, find and open that transaction
    if (receiptParam && viewParam === "true") {
      // Clear the URL params after handling
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
      // Search by payment method
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

  // Format date for export (no commas, Excel-friendly)
  const formatDateForExport = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  // Export to CSV (Excel-compatible)
  const handleExportCSV = () => {
    const headers = ["Date", "Receipt #", "Items", "Total Amount", "Cost", "Profit", "Payment", "Status"];
    const rows = data.transactions.map((tx) => {
      const cost = tx.items.reduce((sum, item) => sum + (item.cost_at_sale * item.quantity), 0);
      const profit = tx.total_amount - cost;
      return [
        formatDateForExport(tx.created_at),
        tx.receipt_no.substring(0, 8),
        tx.itemsCount,
        tx.total_amount.toFixed(2),
        cost.toFixed(2),
        profit.toFixed(2),
        tx.payment_method || "N/A",
        tx.status,
      ];
    });

    // Add BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const csvContent = BOM + [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  // Payment method badge
  const getPaymentMethodBadge = (method: string | null) => {
    if (!method) return null;
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

  return (
    <div className="h-[calc(100vh-theme(spacing.40))] flex flex-col gap-3 overflow-hidden">
      {/* Toolbar - Fixed at Top (Mobile Responsive) */}
      <div className="flex flex-col gap-2 shrink-0">
        {/* Row 1: Search & Date Filter */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search receipt # or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 w-full"
            />
          </div>

          {/* Date Range Filter */}
          <Select value={selectedRange} onValueChange={(value) => handleRangeChange(value as DateRange)}>
            <SelectTrigger className="h-10 w-[120px] sm:w-[140px]">
              <Calendar className="h-4 w-4 mr-2 hidden sm:block" />
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
              className="h-10 w-10 shrink-0"
              onClick={resetFilters}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Reset filters</span>
            </Button>
          )}
        </div>

        {/* Row 2: KPI Stats & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* KPI Stats - Horizontal scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <div className="flex items-center gap-1.5 h-9 px-2 sm:px-3 rounded-md bg-card dark:bg-muted/30 border border-border shadow-warm-sm shrink-0">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{data.totalCount}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">Sales</span>
            </div>

            <div className="flex items-center gap-1.5 h-9 px-2 sm:px-3 rounded-md bg-emerald-500 dark:bg-emerald-500/40 border border-emerald-500 text-white dark:text-emerald-500 shadow-warm-sm shrink-0">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">₱{(data.totalRevenue / 1000).toFixed(1)}k</span>
              <span className="text-xs opacity-90 hidden sm:inline">Revenue</span>
            </div>

            <div className="flex items-center gap-1.5 h-9 px-2 sm:px-3 rounded-md bg-accent dark:bg-accent/20 border border-accent text-white dark:text-accent shadow-warm-sm shrink-0">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">₱{(data.totalProfit / 1000).toFixed(1)}k</span>
              <span className="text-xs opacity-90 hidden sm:inline">Profit</span>
            </div>

            <div className="flex items-center gap-1.5 h-9 px-2 sm:px-3 rounded-md bg-secondary dark:bg-secondary/20 border border-secondary text-white dark:text-secondary shadow-warm-sm shrink-0">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm font-medium">₱{(data.totalCost / 1000).toFixed(1)}k</span>
              <span className="text-xs opacity-90 hidden sm:inline">COGS</span>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Import/Export Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(true)}
              className="h-9 gap-1.5"
              size="sm"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="h-9 gap-1.5"
              size="sm"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Table Container - Fixed Height with Internal Scroll */}
      <div className="flex-1 min-h-0 rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
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
                          {/* PRE-ORDER badge if transaction originated from an order */}
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

      {/* Pagination Footer - Fixed at Bottom */}
      <div className="shrink-0">
        {totalPages > 1 ? (
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, data.totalCount)} of {data.totalCount} transactions
            </p>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isPending}
              >
                Previous
              </Button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  if (pageNum > totalPages) return null;
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      disabled={isPending}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isPending}
              >
                Next
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-2">
            <p className="text-sm text-muted-foreground">
              Showing {data.totalCount} transaction{data.totalCount !== 1 ? "s" : ""}
            </p>
          </div>
        )}
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
