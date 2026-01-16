"use client";

import { useState, useTransition, useMemo } from "react";
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
  Truck,
  Building2,
  Receipt,
  Image as ImageIcon,
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
import {
  getDeliveryHistory,
  type DeliveryHistoryResult,
  type DeliveryDateRange,
  type DeliveryRecord,
} from "@/actions/inventory";

interface DeliveriesClientProps {
  initialData: DeliveryHistoryResult;
}

/**
 * DeliveriesClient - Supplier deliveries history table
 * Shows all RESTOCK movements with supplier details
 */
export function DeliveriesClient({ initialData }: DeliveriesClientProps) {
  const [data, setData] = useState<DeliveryHistoryResult>(initialData);
  const [selectedRange, setSelectedRange] = useState<DeliveryDateRange>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const filteredDeliveries = useMemo(() => {
    if (!searchQuery.trim()) return data.deliveries;
    const query = searchQuery.toLowerCase();
    return data.deliveries.filter((d) => {
      if (d.product_name.toLowerCase().includes(query)) return true;
      if (d.supplier_name?.toLowerCase().includes(query)) return true;
      if (d.reference?.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [data.deliveries, searchQuery]);

  const handleRangeChange = (range: DeliveryDateRange) => {
    setSelectedRange(range);
    setCurrentPage(1);
    startTransition(async () => {
      const newData = await getDeliveryHistory(range, 1, pageSize);
      setData(newData);
    });
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    startTransition(async () => {
      const newData = await getDeliveryHistory(selectedRange, newPage, pageSize);
      setData(newData);
    });
  };

  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Date",
      "Time",
      "Product",
      "Supplier",
      "Quantity",
      "Unit Cost (PHP)",
      "Total Cost (PHP)",
      "Reference",
      "Notes",
      "Processed By",
    ];
    
    const rows = data.deliveries.map((d) => {
      const dt = new Date(d.created_at);
      const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      const timeStr = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
      
      return [
        d.id,
        dateStr,
        timeStr,
        `"${d.product_name}"`,
        d.supplier_name ? `"${d.supplier_name}"` : "",
        d.quantity,
        d.cost_price ? d.cost_price.toFixed(2) : "",
        d.total_cost ? d.total_cost.toFixed(2) : "",
        d.reference ? `"${d.reference}"` : "",
        d.reason ? `"${d.reason}"` : "",
        d.user_name ? `"${d.user_name}"` : "",
      ];
    });

    const BOM = "\uFEFF";
    const csvContent = BOM + [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supplier-deliveries-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  const hasActiveFilters = !!searchQuery || selectedRange !== "all";

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedRange("all");
    setCurrentPage(1);
    startTransition(async () => {
      const newData = await getDeliveryHistory("all", 1, pageSize);
      setData(newData);
    });
  };

  const totalPages = Math.ceil(data.totalCount / pageSize);

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Table Toolbar - Single Row */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search product, supplier, or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 w-full"
          />
        </div>

        {/* Date Range Filter */}
        <Select value={selectedRange} onValueChange={(value) => handleRangeChange(value as DeliveryDateRange)}>
          <SelectTrigger className="h-10 w-[140px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 days</SelectItem>
            <SelectItem value="month">Last 30 days</SelectItem>
            <SelectItem value="quarter">Last 3 months</SelectItem>
            <SelectItem value="year">Last 12 months</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={resetFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}

        <div className="h-8 w-px bg-border mx-1" />

        {/* KPI Chips */}
        <div className="flex items-center gap-2 h-10 px-3 rounded-md bg-muted/30 border border-border/40">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{data.totalCount.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">Deliveries</span>
        </div>

        <div className="flex items-center gap-1.5 h-10 px-3 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50">
          <Package className="size-3.5 text-blue-600" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{data.totalUnits.toLocaleString()}</span>
          <span className="text-xs text-blue-600/70">units</span>
        </div>

        <div className="flex items-center gap-1.5 h-10 px-3 rounded-md bg-teal-50 dark:bg-teal-900/20 border border-teal-200/50 dark:border-teal-800/50">
          <Building2 className="size-3.5 text-teal-600" />
          <span className="text-sm font-medium text-teal-700 dark:text-teal-400">{data.supplierCount}</span>
          <span className="text-xs text-teal-600/70">suppliers</span>
        </div>

        <div className="h-8 w-px bg-border mx-1" />

        {/* Total Cost */}
        <div className="flex items-center gap-2 h-10 px-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/50">
          <span className="text-sm font-medium font-mono text-amber-700 dark:text-amber-400">
            {formatCurrency(data.totalCost)}
          </span>
        </div>

        <div className="flex-1" />

        {/* Export CSV */}
        <Button variant="outline" onClick={handleExportCSV} className="h-10 gap-1.5">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Table Container */}
      <div className="flex-1 min-h-0 rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 bg-muted/30">Date</TableHead>
                <TableHead className="h-10 bg-muted/30">Product</TableHead>
                <TableHead className="h-10 bg-muted/30">Supplier</TableHead>
                <TableHead className="h-10 bg-muted/30 text-right">Qty</TableHead>
                <TableHead className="h-10 bg-muted/30 text-right hidden md:table-cell">Unit Cost</TableHead>
                <TableHead className="h-10 bg-muted/30 text-right">Total Cost</TableHead>
                <TableHead className="h-10 bg-muted/30 hidden lg:table-cell">Reference</TableHead>
                <TableHead className="h-10 bg-muted/30 hidden xl:table-cell">By</TableHead>
                <TableHead className="h-10 bg-muted/30 w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
                      <Truck className="h-8 w-8 opacity-50" />
                      <p>No deliveries found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell className="py-2 text-xs sm:text-sm">{formatDate(delivery.created_at)}</TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded bg-muted flex items-center justify-center shrink-0">
                          <Package className="size-3.5 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium truncate max-w-[160px]">{delivery.product_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      {delivery.supplier_name ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate max-w-[120px]">{delivery.supplier_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Badge variant="secondary" className="font-mono">
                        +{delivery.quantity}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-right font-mono text-sm hidden md:table-cell">
                      {delivery.cost_price ? formatCurrency(delivery.cost_price) : "—"}
                    </TableCell>
                    <TableCell className="py-2 text-right font-mono text-sm font-medium">
                      {delivery.total_cost ? formatCurrency(delivery.total_cost) : "—"}
                    </TableCell>
                    <TableCell className="py-2 hidden lg:table-cell">
                      {delivery.reference ? (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{delivery.reference.substring(0, 15)}{delivery.reference.length > 15 ? "..." : ""}</code>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 hidden xl:table-cell">
                      <span className="text-xs text-muted-foreground">{delivery.user_name ?? "—"}</span>
                    </TableCell>
                    <TableCell className="py-2">
                      <DeliveryDetailDialog delivery={delivery} formatCurrency={formatCurrency} formatDate={formatDate} />
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
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Showing <span className="font-medium text-foreground">{data.totalCount > 0 ? ((currentPage - 1) * pageSize + 1).toLocaleString() : 0}</span> to{" "}
              <span className="font-medium text-foreground">{Math.min(currentPage * pageSize, data.totalCount).toLocaleString()}</span> of{" "}
              <span className="font-medium text-foreground">{data.totalCount.toLocaleString()}</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs">Rows</span>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
                  startTransition(async () => {
                    const newData = await getDeliveryHistory(selectedRange, 1, Number(value));
                    setData(newData);
                  });
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 50].map((size) => (
                    <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePageChange(1)} disabled={currentPage === 1 || isPending}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || isPending}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm">Page {currentPage} of {totalPages || 1}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0 || isPending}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages || totalPages === 0 || isPending}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Detail Dialog Component
function DeliveryDetailDialog({
  delivery,
  formatCurrency,
  formatDate,
}: {
  delivery: DeliveryRecord;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Receipt className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="size-5 text-primary" />
            Delivery #{delivery.id}
          </DialogTitle>
          <DialogDescription>{formatDate(delivery.created_at)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Product */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="size-10 rounded-lg bg-card flex items-center justify-center border">
              <Package className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{delivery.product_name}</p>
              <p className="text-sm text-muted-foreground">Product ID: {delivery.product_id}</p>
            </div>
          </div>

          {/* Supplier */}
          {delivery.supplier_name && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Supplier</span>
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <span className="font-medium">{delivery.supplier_name}</span>
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Quantity Received</span>
            <Badge className="bg-emerald-100 text-emerald-800">+{delivery.quantity} units</Badge>
          </div>

          {/* Cost */}
          {delivery.cost_price && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Unit Cost</span>
                <span className="font-mono">{formatCurrency(delivery.cost_price)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Cost</span>
                <span className="font-mono font-medium text-primary">{formatCurrency(delivery.total_cost ?? 0)}</span>
              </div>
            </>
          )}

          {/* Reference */}
          {delivery.reference && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Reference</span>
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{delivery.reference}</code>
            </div>
          )}

          {/* Notes */}
          {delivery.reason && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Notes</span>
              <p className="text-sm p-2 rounded-md bg-muted/50">{delivery.reason}</p>
            </div>
          )}

          {/* Receipt Image */}
          {delivery.receipt_image_url && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <ImageIcon className="size-3.5" />
                Receipt Image
              </span>
              <img
                src={delivery.receipt_image_url}
                alt="Receipt"
                className="w-full rounded-lg border max-h-48 object-contain bg-muted"
              />
            </div>
          )}

          {/* Processed By */}
          {delivery.user_name && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span>Processed by</span>
              <span>{delivery.user_name}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
