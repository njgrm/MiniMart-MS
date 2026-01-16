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
  RotateCcw,
  AlertTriangle,
  ArrowDownLeft,
  Wrench,
  Eye,
  Building2,
  Truck,
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
  getReturnsHistory,
  type ReturnsHistoryResult,
  type ReturnDateRange,
  type ReturnTypeFilter,
  type ReturnRecord,
} from "@/actions/inventory";

interface ReturnsClientProps {
  initialData: ReturnsHistoryResult;
}

/**
 * ReturnsClient - Returns & damages history table
 * Shows all RETURN, DAMAGE, and ADJUSTMENT (negative) movements
 */
export function ReturnsClient({ initialData }: ReturnsClientProps) {
  const [data, setData] = useState<ReturnsHistoryResult>(initialData);
  const [selectedRange, setSelectedRange] = useState<ReturnDateRange>("all");
  const [selectedType, setSelectedType] = useState<ReturnTypeFilter>("all");
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

  const filteredReturns = useMemo(() => {
    if (!searchQuery.trim()) return data.returns;
    const query = searchQuery.toLowerCase();
    return data.returns.filter((r) => {
      if (r.product_name.toLowerCase().includes(query)) return true;
      if (r.reason?.toLowerCase().includes(query)) return true;
      if (r.reference?.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [data.returns, searchQuery]);

  const handleRangeChange = (range: ReturnDateRange) => {
    setSelectedRange(range);
    setCurrentPage(1);
    startTransition(async () => {
      const newData = await getReturnsHistory(range, selectedType, 1, pageSize);
      setData(newData);
    });
  };

  const handleTypeChange = (type: ReturnTypeFilter) => {
    setSelectedType(type);
    setCurrentPage(1);
    startTransition(async () => {
      const newData = await getReturnsHistory(selectedRange, type, 1, pageSize);
      setData(newData);
    });
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    startTransition(async () => {
      const newData = await getReturnsHistory(selectedRange, selectedType, newPage, pageSize);
      setData(newData);
    });
  };

  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Date",
      "Time",
      "Product",
      "Type",
      "Quantity",
      "Supplier",
      "Unit Cost (PHP)",
      "Estimated Loss (PHP)",
      "Reason",
      "Reference",
      "Processed By",
    ];
    
    const rows = data.returns.map((r) => {
      const dt = new Date(r.created_at);
      const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      const timeStr = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
      
      return [
        r.id,
        dateStr,
        timeStr,
        `"${r.product_name}"`,
        r.movement_type,
        r.quantity,
        r.supplier_name ? `"${r.supplier_name}"` : "",
        r.cost_price ? r.cost_price.toFixed(2) : "",
        r.estimated_loss ? r.estimated_loss.toFixed(2) : "",
        r.reason ? `"${r.reason.replace(/"/g, '""')}"` : "",
        r.reference ? `"${r.reference}"` : "",
        r.user_name ? `"${r.user_name}"` : "",
      ];
    });

    const BOM = "\uFEFF";
    const csvContent = BOM + [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `returns-damages-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  const hasActiveFilters = !!searchQuery || selectedRange !== "all" || selectedType !== "all";

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedRange("all");
    setSelectedType("all");
    setCurrentPage(1);
    startTransition(async () => {
      const newData = await getReturnsHistory("all", "all", 1, pageSize);
      setData(newData);
    });
  };

  const totalPages = Math.ceil(data.totalCount / pageSize);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "RETURN":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
            <RotateCcw className="size-3 mr-1" />
            Return
          </Badge>
        );
      case "SUPPLIER_RETURN":
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400">
            <Truck className="size-3 mr-1" />
            Supplier Return
          </Badge>
        );
      case "DAMAGE":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400">
            <AlertTriangle className="size-3 mr-1" />
            Damage
          </Badge>
        );
      case "ADJUSTMENT":
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">
            <Wrench className="size-3 mr-1" />
            Adjustment
          </Badge>
        );
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Table Toolbar - Single Row */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search product, reason, or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 w-full"
          />
        </div>

        {/* Date Range Filter */}
        <Select value={selectedRange} onValueChange={(value) => handleRangeChange(value as ReturnDateRange)}>
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

        {/* Type Filter */}
        <Select value={selectedType} onValueChange={(value) => handleTypeChange(value as ReturnTypeFilter)}>
          <SelectTrigger className="h-10 w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="RETURN">Customer Returns</SelectItem>
            <SelectItem value="SUPPLIER_RETURN">Supplier Returns</SelectItem>
            <SelectItem value="DAMAGE">Damages</SelectItem>
            <SelectItem value="ADJUSTMENT">Adjustments</SelectItem>
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
          <span className="text-xs text-muted-foreground">Records</span>
        </div>

        <div className="flex items-center gap-1.5 h-10 px-3 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50" title="Customer Returns">
          <RotateCcw className="size-3.5 text-blue-600" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{data.byType.returns}</span>
        </div>

        <div className="flex items-center gap-1.5 h-10 px-3 rounded-md bg-orange-50 dark:bg-orange-900/20 border border-orange-200/50 dark:border-orange-800/50" title="Supplier Returns">
          <Truck className="size-3.5 text-orange-600" />
          <span className="text-sm font-medium text-orange-700 dark:text-orange-400">{data.byType.supplierReturns}</span>
        </div>

        <div className="flex items-center gap-1.5 h-10 px-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/50" title="Damages">
          <AlertTriangle className="size-3.5 text-red-600" />
          <span className="text-sm font-medium text-red-700 dark:text-red-400">{data.byType.damages}</span>
        </div>

        <div className="flex items-center gap-1.5 h-10 px-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/50" title="Adjustments">
          <Wrench className="size-3.5 text-amber-600" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">{data.byType.adjustments}</span>
        </div>

        <div className="h-8 w-px bg-border mx-1" />

        {/* Estimated Loss */}
        <div className="flex items-center gap-2 h-10 px-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/50">
          <ArrowDownLeft className="size-3.5 text-red-600" />
          <span className="text-sm font-medium font-mono text-red-700 dark:text-red-400">
            {formatCurrency(data.estimatedLoss)}
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
                <TableHead className="h-10 bg-muted/30">Type</TableHead>
                <TableHead className="h-10 bg-muted/30 text-right">Qty</TableHead>
                <TableHead className="h-10 bg-muted/30 text-right hidden md:table-cell">Est. Loss</TableHead>
                <TableHead className="h-10 bg-muted/30 hidden lg:table-cell">Reason</TableHead>
                <TableHead className="h-10 bg-muted/30 hidden xl:table-cell">By</TableHead>
                <TableHead className="h-10 bg-muted/30 w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReturns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
                      <RotateCcw className="h-8 w-8 opacity-50" />
                      <p>No returns or damages found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredReturns.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="py-2 text-xs sm:text-sm">{formatDate(record.created_at)}</TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded bg-muted flex items-center justify-center shrink-0">
                          <Package className="size-3.5 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium truncate max-w-[160px]">{record.product_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">{getTypeBadge(record.movement_type)}</TableCell>
                    <TableCell className="py-2 text-right">
                      <Badge variant="destructive" className="font-mono bg-red-100 text-red-800 hover:bg-red-100">
                        -{record.quantity}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-right font-mono text-sm hidden md:table-cell">
                      {record.estimated_loss ? (
                        <span className="text-red-600">{formatCurrency(record.estimated_loss)}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="py-2 hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground truncate max-w-[180px] block">
                        {record.reason?.substring(0, 40)}{record.reason && record.reason.length > 40 ? "..." : ""} || "—"
                      </span>
                    </TableCell>
                    <TableCell className="py-2 hidden xl:table-cell">
                      <span className="text-xs text-muted-foreground">{record.user_name ?? "—"}</span>
                    </TableCell>
                    <TableCell className="py-2">
                      <ReturnDetailDialog record={record} formatCurrency={formatCurrency} formatDate={formatDate} getTypeBadge={getTypeBadge} />
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
                    const newData = await getReturnsHistory(selectedRange, selectedType, 1, Number(value));
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
function ReturnDetailDialog({
  record,
  formatCurrency,
  formatDate,
  getTypeBadge,
}: {
  record: ReturnRecord;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
  getTypeBadge: (type: string) => React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="size-5 text-primary" />
            Stock Movement #{record.id}
          </DialogTitle>
          <DialogDescription>{formatDate(record.created_at)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Product */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="size-10 rounded-lg bg-card flex items-center justify-center border">
              <Package className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{record.product_name}</p>
              <p className="text-sm text-muted-foreground">Product ID: {record.product_id}</p>
            </div>
          </div>

          {/* Type */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Movement Type</span>
            {getTypeBadge(record.movement_type)}
          </div>

          {/* Quantity */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Quantity Removed</span>
            <Badge variant="destructive" className="bg-red-100 text-red-800">-{record.quantity} units</Badge>
          </div>

          {/* Cost */}
          {record.cost_price && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Unit Cost</span>
              <span className="font-mono">{formatCurrency(record.cost_price)}</span>
            </div>
          )}

          {/* Estimated Loss */}
          {record.estimated_loss && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
              <span className="text-sm font-medium text-red-700 dark:text-red-400">Estimated Loss</span>
              <span className="font-mono font-bold text-red-700 dark:text-red-400">{formatCurrency(record.estimated_loss)}</span>
            </div>
          )}

          {/* Reference */}
          {record.reference && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Reference</span>
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{record.reference}</code>
            </div>
          )}

          {/* Reason */}
          {record.reason && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Reason</span>
              <p className="text-sm p-2 rounded-md bg-muted/50">{record.reason}</p>
            </div>
          )}

          {/* Processed By */}
          {record.user_name && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span>Processed by</span>
              <span>{record.user_name}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
