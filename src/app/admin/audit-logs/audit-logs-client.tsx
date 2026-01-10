"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  Search,
  X,
  RefreshCw,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  PackagePlus,
  Package,
  ClipboardEdit,
  Upload,
  XCircle,
  AlertTriangle,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { cn } from "@/lib/utils";
import { getAuditLogs, type AuditLogEntry } from "@/actions/audit";
import { LogDetailsModal } from "@/components/audit/log-details-modal";
import { AuditAction } from "@prisma/client";

interface AuditLogsClientProps {
  initialLogs: AuditLogEntry[];
  initialTotal: number;
  initialPages: number;
  entityTypes: string[];
  usernames: string[];
  modules: string[];
}

// Action badge configuration with high-risk highlighting
const ACTION_CONFIG: Record<AuditAction, { label: string; icon: typeof Plus; color: string; isHighRisk?: boolean }> = {
  CREATE: { label: "Created", icon: Plus, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  UPDATE: { label: "Updated", icon: Pencil, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  DELETE: { label: "Deleted", icon: Trash2, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  ARCHIVE: { label: "Archived", icon: Archive, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  RESTORE: { label: "Restored", icon: RotateCcw, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  ADJUST_STOCK: { label: "Adjusted", icon: AlertTriangle, color: "bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 ring-1 ring-orange-400/50", isHighRisk: true },
  RESTOCK: { label: "Restocked", icon: PackagePlus, color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  BULK_IMPORT: { label: "Imported", icon: Upload, color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
  ORDER_CANCEL: { label: "Cancelled", icon: XCircle, color: "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300 ring-1 ring-red-400/50", isHighRisk: true },
  EDIT_EXPIRY: { label: "Expiry", icon: Calendar, color: "bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 ring-1 ring-orange-400/50", isHighRisk: true },
  EDIT_BATCH: { label: "Batch", icon: ClipboardEdit, color: "bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 ring-1 ring-orange-400/50", isHighRisk: true },
};

// Module badge colors
const MODULE_COLORS: Record<string, string> = {
  INVENTORY: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  CATALOG: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  PRODUCTS: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  POS: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800",
  ORDERS: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  AUTH: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
};

// Helper: Format category enum to Title Case (e.g., CANNED_GOODS -> "Canned Goods")
function formatCategory(category: string | null | undefined): string {
  if (!category) return "";
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Helper: Get user initials for avatar
function getUserInitials(username: string): string {
  if (!username) return "?";
  const parts = username.split(/[\s_-]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return username.substring(0, 2).toUpperCase();
}

// Helper: Get reference from metadata (batch_id, sku, or reference)
function getReference(log: AuditLogEntry): string | null {
  const metadata = log.metadata as Record<string, unknown> | null;
  
  // For Restock/Adjust/Batch actions, show batch ID
  if (["RESTOCK", "ADJUST_STOCK", "EDIT_BATCH", "EDIT_EXPIRY"].includes(log.action)) {
    const batchId = metadata?.batch_id as number | undefined;
    if (batchId) return `Batch #${batchId}`;
  }
  
  // For product actions, show SKU if available
  const sku = metadata?.sku as string | undefined;
  if (sku) return sku;
  
  // Fallback to reference field
  const ref = metadata?.reference as string | undefined;
  if (ref) return ref;
  
  return null;
}

// Helper to render compact "diff" visualization for scanning (not reading)
function DiffSummary({ log }: { log: AuditLogEntry }): React.ReactNode {
  const metadata = log.metadata as Record<string, unknown> | null;
  
  // RESTOCK: Show +qty with expiry badge
  // Metadata fields: quantity_added, new_stock_level, supplier_name, expiry_date
  if (log.action === "RESTOCK") {
    const qty = (metadata?.quantity_added ?? metadata?.quantity) as number | undefined;
    const expiry = metadata?.expiry_date as string | undefined;
    const isNearExpiry = expiry ? (new Date(expiry).getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000 : false;
    
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-base font-bold text-green-600 dark:text-green-400">
          +{qty?.toLocaleString() ?? 0}
        </span>
        {expiry && (
          <Badge variant="outline" className={cn(
            "text-[10px] gap-1 shrink-0",
            isNearExpiry && "border-amber-400 text-amber-600 dark:text-amber-400"
          )}>
            {isNearExpiry && <AlertTriangle className="h-2.5 w-2.5" />}
            Exp {format(new Date(expiry), "MMM d")}
          </Badge>
        )}
      </div>
    );
  }
  
  // ADJUST_STOCK: Show ±diff
  // Metadata fields: previous_stock, new_stock, quantity_change, movement_type, reason
  if (log.action === "ADJUST_STOCK") {
    // Try quantity_change first (pre-computed), then calculate from previous/new
    let diff = metadata?.quantity_change as number | undefined;
    if (diff === undefined) {
      const oldStock = (metadata?.previous_stock ?? metadata?.old_stock) as number | undefined;
      const newStock = metadata?.new_stock as number | undefined;
      if (oldStock !== undefined && newStock !== undefined) {
        diff = newStock - oldStock;
      }
    }
    
    if (diff !== undefined) {
      const isPositive = diff > 0;
      return (
        <span className={cn(
          "text-base font-bold",
          isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
        )}>
          {isPositive ? "+" : ""}{diff.toLocaleString()}
        </span>
      );
    }
  }
  
  // EDIT_BATCH: Show qty diff
  // Metadata fields: old_quantity, new_quantity, quantity_change, batch_id, reason
  if (log.action === "EDIT_BATCH") {
    // Try quantity_change first (pre-computed), then calculate
    let diff = metadata?.quantity_change as number | undefined;
    if (diff === undefined) {
      const oldQty = metadata?.old_quantity as number | undefined;
      const newQty = metadata?.new_quantity as number | undefined;
      if (oldQty !== undefined && newQty !== undefined) {
        diff = newQty - oldQty;
      }
    }
    
    if (diff !== undefined) {
      const isPositive = diff > 0;
      return (
        <div className="flex items-center justify-end gap-1.5">
          <span className={cn(
            "text-base font-bold",
            isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}>
            {isPositive ? "+" : ""}{diff.toLocaleString()}
          </span>
          <span className="text-[10px] text-muted-foreground">batch</span>
        </div>
      );
    }
  }
  
  // EDIT_EXPIRY: Show date transition
  if (log.action === "EDIT_EXPIRY") {
    const oldExpiry = metadata?.old_expiry as string | undefined;
    const newExpiry = metadata?.new_expiry as string | undefined;
    const isNearExpiry = newExpiry ? (new Date(newExpiry).getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000 : false;
    
    return (
      <div className="flex items-center gap-1.5 text-sm">
        {oldExpiry && <span className="text-muted-foreground">{format(new Date(oldExpiry), "MMM d")}</span>}
        <span className="text-muted-foreground">➝</span>
        <span className={cn("font-semibold", isNearExpiry && "text-amber-600 dark:text-amber-400")}>
          {newExpiry ? format(new Date(newExpiry), "MMM d") : "—"}
        </span>
      </div>
    );
  }
  
  // UPDATE with price change
  if (log.action === "UPDATE" && metadata?.changed_fields) {
    const changedFields = metadata.changed_fields as string[];
    const newValues = metadata.new_values as Record<string, unknown> | undefined;
    const oldValues = metadata.old_values as Record<string, unknown> | undefined;
    
    if (changedFields.includes("retail_price") && oldValues && newValues) {
      const oldPrice = Number(oldValues.retail_price);
      const newPrice = Number(newValues.retail_price);
      return (
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground font-mono">{oldPrice.toFixed(2)}</span>
          <span className="text-muted-foreground">➝</span>
          <span className="font-bold font-mono">{newPrice.toFixed(2)}</span>
          {changedFields.length > 1 && (
            <Badge variant="outline" className="text-[9px] ml-1">+{changedFields.length - 1}</Badge>
          )}
        </div>
      );
    }
    
    // Generic field count
    return (
      <Badge variant="outline" className="text-[10px]">
        {changedFields.length} field{changedFields.length > 1 ? "s" : ""}
      </Badge>
    );
  }
  
  // CREATE
  if (log.action === "CREATE") {
    return <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">new</Badge>;
  }
  
  // DELETE / ARCHIVE
  if (log.action === "DELETE" || log.action === "ARCHIVE") {
    return <Badge variant="outline" className="text-[10px] text-red-600 border-red-200">removed</Badge>;
  }
  
  // RESTORE
  if (log.action === "RESTORE") {
    return <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-200">restored</Badge>;
  }
  
  // ORDER_CANCEL
  if (log.action === "ORDER_CANCEL") {
    return <Badge variant="outline" className="text-[10px] text-red-600 border-red-200">cancelled</Badge>;
  }
  
  // BULK_IMPORT
  if (log.action === "BULK_IMPORT") {
    const count = metadata?.count as number | undefined;
    return (
      <Badge variant="outline" className="text-[10px]">
        {count?.toLocaleString() ?? "—"} items
      </Badge>
    );
  }
  
  // Fallback
  return <span className="text-xs text-muted-foreground truncate max-w-[150px]">{log.details}</span>;
}

export function AuditLogsClient({
  initialLogs,
  initialTotal,
  initialPages,
  entityTypes,
  modules,
}: AuditLogsClientProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [pages, setPages] = useState(initialPages);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isPending, startTransition] = useTransition();

  // Modal state
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const fetchLogs = (newPage: number, newPageSize: number = pageSize, newDateRange: DateRange | undefined = dateRange) => {
    startTransition(async () => {
      const result = await getAuditLogs(
        {
          search: search || undefined,
          action: actionFilter !== "all" ? actionFilter : undefined,
          entityType: entityTypeFilter !== "all" ? entityTypeFilter : undefined,
          module: moduleFilter !== "all" ? moduleFilter : undefined,
          startDate: newDateRange?.from,
          endDate: newDateRange?.to,
        },
        newPage,
        newPageSize
      );
      setLogs(result.logs);
      setTotal(result.total);
      setPages(result.pages);
    });
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setPage(1);
    fetchLogs(1, pageSize, range);
  };

  const handleSearch = () => {
    setPage(1);
    fetchLogs(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchLogs(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    fetchLogs(1, newSize);
  };

  const handleViewLog = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setModalOpen(true);
  };

  // Check if filters are active
  const hasActiveFilters = !!search || actionFilter !== "all" || entityTypeFilter !== "all" || moduleFilter !== "all" || !!dateRange;

  const resetFilters = () => {
    setSearch("");
    setActionFilter("all");
    setEntityTypeFilter("all");
    setModuleFilter("all");
    setDateRange(undefined);
    setPage(1);
    startTransition(async () => {
      const result = await getAuditLogs({}, 1, pageSize);
      setLogs(result.logs);
      setTotal(result.total);
      setPages(result.pages);
    });
  };

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Table Toolbar - Single Row */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9 h-9 w-full"
          />
        </div>

        {/* Module Filter */}
        <Select value={moduleFilter} onValueChange={(v) => {
          setModuleFilter(v);
          setPage(1);
          startTransition(async () => {
            const result = await getAuditLogs(
              {
                search: search || undefined,
                action: actionFilter !== "all" ? actionFilter : undefined,
                entityType: entityTypeFilter !== "all" ? entityTypeFilter : undefined,
                module: v !== "all" ? v : undefined,
                startDate: dateRange?.from,
                endDate: dateRange?.to,
              },
              1,
              pageSize
            );
            setLogs(result.logs);
            setTotal(result.total);
            setPages(result.pages);
          });
        }}>
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="All Modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {/* Hardcoded module options - some may not have data yet */}
            {["INVENTORY", "CATALOG", "POS", "ORDERS", "AUTH"].map((mod) => (
              <SelectItem key={mod} value={mod}>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", MODULE_COLORS[mod]?.split(" ")[0] || "bg-gray-400")} />
                  {mod}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Action Filter */}
        <Select value={actionFilter} onValueChange={(v) => {
          setActionFilter(v as AuditAction | "all");
          setPage(1);
          startTransition(async () => {
            const result = await getAuditLogs(
              {
                search: search || undefined,
                action: v !== "all" ? (v as AuditAction) : undefined,
                entityType: entityTypeFilter !== "all" ? entityTypeFilter : undefined,
                module: moduleFilter !== "all" ? moduleFilter : undefined,
                startDate: dateRange?.from,
                endDate: dateRange?.to,
              },
              1,
              pageSize
            );
            setLogs(result.logs);
            setTotal(result.total);
            setPages(result.pages);
          });
        }}>
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {Object.keys(ACTION_CONFIG).map((action) => (
              <SelectItem key={action} value={action}>
                {ACTION_CONFIG[action as AuditAction].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Entity Type Filter */}
        <Select value={entityTypeFilter} onValueChange={(v) => {
          setEntityTypeFilter(v);
          setPage(1);
          startTransition(async () => {
            const result = await getAuditLogs(
              {
                search: search || undefined,
                action: actionFilter !== "all" ? actionFilter : undefined,
                entityType: v !== "all" ? v : undefined,
                module: moduleFilter !== "all" ? moduleFilter : undefined,
                startDate: dateRange?.from,
                endDate: dateRange?.to,
              },
              1,
              pageSize
            );
            setLogs(result.logs);
            setTotal(result.total);
            setPages(result.pages);
          });
        }}>
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {entityTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range Filter */}
        <DateRangePicker
          date={dateRange}
          onDateChange={handleDateRangeChange}
          className="w-auto"
        />

        {/* Reset Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={resetFilters}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Reset filters</span>
          </Button>
        )}

        {/* Separator */}
        <div className="h-7 w-px bg-border mx-1" />

        {/* Results Count */}
        <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-muted/30 border border-border/40">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{total}</span>
          <span className="text-xs text-muted-foreground">entries</span>
        </div>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchLogs(page)}
          className="h-9 gap-1.5"
          disabled={isPending}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Table Container with Internal Scroll */}
      <TooltipProvider>
        <div className="flex-1 min-h-0 rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <Table className="w-full">
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="h-10 bg-muted/30 w-[120px] text-xs font-semibold uppercase tracking-wide">When</TableHead>
                  <TableHead className="h-10 bg-muted/30 w-[120px] text-xs font-semibold uppercase tracking-wide">Who</TableHead>
                  <TableHead className="h-10 bg-muted/30 w-[100px] text-xs font-semibold uppercase tracking-wide">Action</TableHead>
                  <TableHead className="h-10 bg-muted/30 text-xs font-semibold uppercase tracking-wide">Target</TableHead>
                  <TableHead className="h-10 bg-muted/30 w-[160px] text-xs font-semibold uppercase tracking-wide">Change</TableHead>
                  <TableHead className="h-10 bg-muted/30 w-[100px] text-xs font-semibold uppercase tracking-wide">Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground py-8">
                        <FileText className="h-10 w-10 opacity-50" />
                        <p className="text-sm">No audit logs found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const actionConfig = ACTION_CONFIG[log.action];
                    const ActionIcon = actionConfig?.icon || FileText;
                    const isHighRisk = actionConfig?.isHighRisk || false;
                    const reference = getReference(log);

                    return (
                      <TableRow
                        key={log.id}
                        className={cn(
                          "group cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50",
                          isHighRisk && "bg-orange-50/50 dark:bg-orange-950/10"
                        )}
                        onClick={() => handleViewLog(log)}
                      >
                        {/* When */}
                        <TableCell className="py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">
                              {format(new Date(log.created_at), "MMM d")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), "h:mm a")}
                            </span>
                          </div>
                        </TableCell>

                        {/* Who - Avatar + Name */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
                                {getUserInitials(log.username)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground truncate">
                              {log.username}
                            </span>
                          </div>
                        </TableCell>

                        {/* Action Badge */}
                        <TableCell className="py-3">
                          <Badge className={cn("gap-1 text-[10px] px-2 py-0.5 font-medium", actionConfig?.color)}>
                            <ActionIcon className="h-3 w-3" />
                            {actionConfig?.label || log.action}
                          </Badge>
                        </TableCell>

                        {/* Target (Product w/ Image) - Flexible width */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            {/* Product Thumbnail or Fallback */}
                            <div className="h-9 w-9 rounded-md bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center">
                              {log.product_image ? (
                                <img 
                                  src={log.product_image} 
                                  alt={log.entity_name} 
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package className="h-4 w-4 text-muted-foreground/50" />
                              )}
                            </div>
                            
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium text-foreground truncate">
                                {log.entity_name}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {log.product_category && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                                    {formatCategory(log.product_category)}
                                  </span>
                                )}
                                <span className="text-[10px] text-muted-foreground">
                                  #{log.entity_id}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Change - Diff visualization (next to Target for easy scanning) */}
                        <TableCell className="py-3">
                            <DiffSummary log={log} />
                        </TableCell>

                        {/* Reference (moved to end) */}
                        <TableCell className="py-3">
                          {reference ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded truncate max-w-[90px] inline-block">
                                  {reference}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{reference}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </TooltipProvider>

      {/* Pagination Footer - Matching Inventory/Sales Style */}
      <div className="shrink-0">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-2">
          {/* Left: Showing info + Rows per page */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Showing{" "}
              <span className="font-medium text-foreground">
                {total > 0 ? (page - 1) * pageSize + 1 : 0}
              </span>{" "}
              to{" "}
              <span className="font-medium text-foreground">
                {Math.min(page * pageSize, total)}
              </span>{" "}
              of <span className="font-medium text-foreground">{total}</span> entries
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs">Rows per page</span>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => handlePageSizeChange(Number(value))}
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
              disabled={page === 1 || isPending}
            >
              <ChevronsLeft className="h-4 w-4" />
              <span className="sr-only">First page</span>
            </Button>

            {/* Previous Page */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || isPending}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Previous page</span>
            </Button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {(() => {
                const pageNumbers: (number | "ellipsis")[] = [];
                const maxVisiblePages = 5;

                if (pages <= maxVisiblePages + 2) {
                  for (let i = 1; i <= pages; i++) {
                    pageNumbers.push(i);
                  }
                } else {
                  pageNumbers.push(1);

                  if (page > 3) {
                    pageNumbers.push("ellipsis");
                  }

                  const startPage = Math.max(2, page - 1);
                  const endPage = Math.min(pages - 1, page + 1);

                  for (let i = startPage; i <= endPage; i++) {
                    if (!pageNumbers.includes(i)) {
                      pageNumbers.push(i);
                    }
                  }

                  if (page < pages - 2) {
                    pageNumbers.push("ellipsis");
                  }

                  if (!pageNumbers.includes(pages)) {
                    pageNumbers.push(pages);
                  }
                }

                return pageNumbers.map((p, idx) =>
                  p === "ellipsis" ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={p}
                      variant={page === p ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePageChange(p)}
                      disabled={isPending}
                    >
                      {p}
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
              onClick={() => handlePageChange(page + 1)}
              disabled={page === pages || pages === 0 || isPending}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Next page</span>
            </Button>

            {/* Last Page */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(pages)}
              disabled={page === pages || pages === 0 || isPending}
            >
              <ChevronsRight className="h-4 w-4" />
              <span className="sr-only">Last page</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Log Details Modal */}
      <LogDetailsModal
        log={selectedLog}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
