"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Package,
  CheckCircle,
  XCircle,
  Building2,
  Receipt,
  Eye,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  getOrderHistory,
  type OrderHistoryResult,
  type OrderHistoryDateRange,
  type OrderHistoryStatusFilter,
  type HistoricalOrder,
} from "@/actions/orders";

interface OrderHistoryClientProps {
  initialData: OrderHistoryResult;
}

/**
 * OrderHistoryClient - Table-based layout matching Sales History
 * Shows completed and cancelled vendor orders
 */
export function OrderHistoryClient({ initialData }: OrderHistoryClientProps) {
  const router = useRouter();
  const [data, setData] = useState<OrderHistoryResult>(initialData);
  const [selectedRange, setSelectedRange] = useState<OrderHistoryDateRange>("all");
  const [selectedStatus, setSelectedStatus] = useState<OrderHistoryStatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedOrder, setSelectedOrder] = useState<HistoricalOrder | null>(null);

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

  // Filter orders by search (order ID or customer name)
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return data.orders;
    
    const query = searchQuery.toLowerCase();
    return data.orders.filter((order) => {
      if (order.order_id.toString().includes(query)) return true;
      if (order.customer.name.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [data.orders, searchQuery]);

  // Handle date range change
  const handleRangeChange = (range: OrderHistoryDateRange) => {
    setSelectedRange(range);
    setCurrentPage(1);
    
    startTransition(async () => {
      const newData = await getOrderHistory(range, selectedStatus, 1, pageSize);
      setData(newData);
    });
  };

  // Handle status filter change
  const handleStatusChange = (status: OrderHistoryStatusFilter) => {
    setSelectedStatus(status);
    setCurrentPage(1);
    
    startTransition(async () => {
      const newData = await getOrderHistory(selectedRange, status, 1, pageSize);
      setData(newData);
    });
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    
    startTransition(async () => {
      const newData = await getOrderHistory(selectedRange, selectedStatus, newPage, pageSize);
      setData(newData);
    });
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
      "Order ID",
      "Date",
      "Time",
      "Customer Name",
      "Contact",
      "Items Count",
      "Item Details",
      "Total Amount (PHP)",
      "Status",
      "Transaction Receipt",
    ];
    
    const rows = data.orders.map((order) => {
      const d = new Date(order.order_date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const itemDetails = order.items.map(i => `${i.quantity}x ${i.product_name}`).join("; ");
      
      return [
        order.order_id,
        dateStr,
        timeStr,
        `"${order.customer.name}"`,
        order.customer.contact_details ? `"${order.customer.contact_details}"` : "",
        order.itemsCount,
        `"${itemDetails}"`,
        order.total_amount.toFixed(2),
        order.status,
        order.receipt_no || "",
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
    a.download = `vendor-order-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  // Check if filters are active
  const hasActiveFilters = !!searchQuery || selectedRange !== "all" || selectedStatus !== "all";

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedRange("all");
    setSelectedStatus("all");
    setCurrentPage(1);
    startTransition(async () => {
      const newData = await getOrderHistory("all", "all", 1, pageSize);
      setData(newData);
    });
  };

  // Pagination
  const totalPages = Math.ceil(data.totalCount / pageSize);

  // Status badge
  const getStatusBadge = (status: string) => {
    if (status === "COMPLETED") {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="size-3 mr-1" />
          Completed
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400">
        <XCircle className="size-3 mr-1" />
        Cancelled
      </Badge>
    );
  };

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Table Toolbar - Single Row (matching sales history) */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by order ID or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 w-full"
          />
        </div>

        {/* Date Range Filter */}
        <Select value={selectedRange} onValueChange={(value) => handleRangeChange(value as OrderHistoryDateRange)}>
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

        {/* Status Filter */}
        <Select value={selectedStatus} onValueChange={(value) => handleStatusChange(value as OrderHistoryStatusFilter)}>
          <SelectTrigger className="h-10 w-[140px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
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

        {/* Results Count */}
        <div className="flex items-center gap-2 h-10 px-3 rounded-md bg-muted/30 border border-border/40">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{data.totalCount.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">Orders</span>
        </div>

        {/* KPI Chips inline */}
        <div className="flex items-center gap-1.5 h-10 px-3 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/50">
          <CheckCircle className="size-3.5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{data.completedCount}</span>
        </div>

        <div className="flex items-center gap-1.5 h-10 px-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/50">
          <XCircle className="size-3.5 text-red-600" />
          <span className="text-sm font-medium text-red-700 dark:text-red-400">{data.cancelledCount}</span>
        </div>

        <div className="h-8 w-px bg-border mx-1" />

        {/* Revenue */}
        <div className="flex items-center gap-2 h-10 px-3 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/50">
          <span className="text-sm font-medium font-mono text-emerald-700 dark:text-emerald-400">
            {formatCurrency(data.totalRevenue)}
          </span>
        </div>

        <div className="flex-1" />

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
                <TableHead className="h-10 bg-muted/30">Order #</TableHead>
                <TableHead className="h-10 bg-muted/30">Date</TableHead>
                <TableHead className="h-10 bg-muted/30">Customer</TableHead>
                <TableHead className="h-10 bg-muted/30 hidden md:table-cell">Items</TableHead>
                <TableHead className="h-10 bg-muted/30">Total</TableHead>
                <TableHead className="h-10 bg-muted/30">Status</TableHead>
                <TableHead className="h-10 bg-muted/30 hidden lg:table-cell">Transaction</TableHead>
                <TableHead className="h-10 bg-muted/30">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
                      <Package className="h-8 w-8 opacity-50" />
                      <p>No orders found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.order_id}>
                    <TableCell className="py-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        #{order.order_id}
                      </code>
                    </TableCell>
                    <TableCell className="py-2 font-medium text-xs sm:text-sm">
                      {formatDate(order.order_date)}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Building2 className="size-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{order.customer.name}</span>
                          {order.customer.contact_details && (
                            <span className="text-xs text-muted-foreground">
                              {order.customer.contact_details}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 hidden md:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-sm">
                          {order.itemsCount} item{order.itemsCount !== 1 ? "s" : ""}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {order.items.slice(0, 1).map((item, i) => (
                            <div key={i}>
                              {item.quantity}x {item.product_name.substring(0, 18)}{item.product_name.length > 18 ? "..." : ""}
                            </div>
                          ))}
                          {order.items.length > 1 && (
                            <div>+{order.items.length - 1} more</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 font-medium font-mono text-xs sm:text-sm">
                      {formatCurrency(order.total_amount)}
                    </TableCell>
                    <TableCell className="py-2">
                      {getStatusBadge(order.status)}
                    </TableCell>
                    <TableCell className="py-2 hidden lg:table-cell">
                      {order.receipt_no ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {order.receipt_no.substring(0, 8)}...
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View details</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Package className="size-5" />
                              Order #{order.order_id}
                            </DialogTitle>
                            <DialogDescription>
                              {formatDate(order.order_date)}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            {/* Customer Info */}
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Building2 className="size-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{order.customer.name}</p>
                                {order.customer.contact_details && (
                                  <p className="text-sm text-muted-foreground">
                                    {order.customer.contact_details}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Status */}
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Status</span>
                              {getStatusBadge(order.status)}
                            </div>

                            {/* Transaction Link */}
                            {order.receipt_no && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Transaction</span>
                                <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                  {order.receipt_no.substring(0, 8)}
                                </code>
                              </div>
                            )}

                            <Separator />

                            {/* Items */}
                            <div>
                              <h4 className="text-sm font-medium mb-2">Order Items</h4>
                              <ScrollArea className="h-[200px]">
                                <div className="space-y-2">
                                  {order.items.map((item, index) => (
                                    <div
                                      key={index}
                                      className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-xs">
                                          {item.quantity}x
                                        </Badge>
                                        <span className="text-sm">{item.product_name}</span>
                                      </div>
                                      <span className="font-mono text-sm">
                                        {formatCurrency(item.price * item.quantity)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>

                            <Separator />

                            {/* Total */}
                            <div className="flex items-center justify-between">
                              <span className="font-medium">Total Amount</span>
                              <span className="font-mono text-lg font-bold text-primary">
                                {formatCurrency(order.total_amount)}
                              </span>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="shrink-0">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-2">
          {/* Left: Showing info + Rows per page */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Showing <span className="font-medium text-foreground">{data.totalCount > 0 ? ((currentPage - 1) * pageSize + 1).toLocaleString() : 0}</span> to{" "}
              <span className="font-medium text-foreground">{Math.min(currentPage * pageSize, data.totalCount).toLocaleString()}</span> of{" "}
              <span className="font-medium text-foreground">{data.totalCount.toLocaleString()}</span> orders
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs">Rows per page</span>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
                  startTransition(async () => {
                    const newData = await getOrderHistory(selectedRange, selectedStatus, 1, Number(value));
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
    </div>
  );
}
