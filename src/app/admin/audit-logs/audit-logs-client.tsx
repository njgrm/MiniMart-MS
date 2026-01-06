"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
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
  Package,
  PackagePlus,
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
  Eye,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
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
  POS: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800",
  ORDERS: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  AUTH: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
};

// Helper to extract impact summary from metadata
function getImpactSummary(log: AuditLogEntry): { text: string; icon: typeof Plus; color: string } | null {
  const metadata = log.metadata as Record<string, unknown> | null;
  if (!metadata) return null;

  // Stock changes
  if (log.action === "RESTOCK" || log.action === "ADJUST_STOCK") {
    const qty = metadata.quantity as number;
    const oldStock = metadata.old_stock as number | undefined;
    const newStock = metadata.new_stock as number | undefined;
    
    if (qty !== undefined) {
      const isPositive = qty > 0;
      return {
        text: `${isPositive ? "+" : ""}${qty} units`,
        icon: isPositive ? ArrowUp : ArrowDown,
        color: isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
      };
    }
    
    if (oldStock !== undefined && newStock !== undefined) {
      const diff = newStock - oldStock;
      return {
        text: `${diff > 0 ? "+" : ""}${diff} units`,
        icon: diff > 0 ? TrendingUp : TrendingDown,
        color: diff > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
      };
    }
  }

  // Price changes
  if (log.action === "UPDATE" && metadata.changed_fields) {
    const changedFields = metadata.changed_fields as string[];
    const newValues = metadata.new_values as Record<string, unknown> | undefined;
    const oldValues = metadata.old_values as Record<string, unknown> | undefined;
    
    if (changedFields.includes("retail_price") && oldValues && newValues) {
      const oldPrice = oldValues.retail_price as number;
      const newPrice = newValues.retail_price as number;
      return {
        text: `₱${oldPrice} → ₱${newPrice}`,
        icon: DollarSign,
        color: newPrice > oldPrice ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400",
      };
    }
    
    // Field count for generic updates
    return {
      text: `${changedFields.length} field${changedFields.length > 1 ? "s" : ""} changed`,
      icon: Pencil,
      color: "text-blue-600 dark:text-blue-400",
    };
  }

  // Create actions
  if (log.action === "CREATE") {
    return {
      text: "New entry",
      icon: Plus,
      color: "text-green-600 dark:text-green-400",
    };
  }

  // Delete/Archive actions
  if (log.action === "DELETE" || log.action === "ARCHIVE") {
    return {
      text: "Removed",
      icon: Trash2,
      color: "text-red-600 dark:text-red-400",
    };
  }

  // Restore
  if (log.action === "RESTORE") {
    return {
      text: "Restored",
      icon: RotateCcw,
      color: "text-purple-600 dark:text-purple-400",
    };
  }

  return null;
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

  const fetchLogs = (newPage: number, newPageSize: number = pageSize) => {
    startTransition(async () => {
      const result = await getAuditLogs(
        {
          search: search || undefined,
          action: actionFilter !== "all" ? actionFilter : undefined,
          entityType: entityTypeFilter !== "all" ? entityTypeFilter : undefined,
          module: moduleFilter !== "all" ? moduleFilter : undefined,
        },
        newPage,
        newPageSize
      );
      setLogs(result.logs);
      setTotal(result.total);
      setPages(result.pages);
    });
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
  const hasActiveFilters = !!search || actionFilter !== "all" || entityTypeFilter !== "all" || moduleFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setActionFilter("all");
    setEntityTypeFilter("all");
    setModuleFilter("all");
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
            {modules.map((mod) => (
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
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 bg-muted/30 w-[140px] text-xs">Timestamp</TableHead>
                  <TableHead className="h-9 bg-muted/30 w-[100px] text-xs">User</TableHead>
                  <TableHead className="h-9 bg-muted/30 w-[90px] text-xs">Module</TableHead>
                  <TableHead className="h-9 bg-muted/30 w-[100px] text-xs">Action</TableHead>
                  <TableHead className="h-9 bg-muted/30 w-[180px] text-xs">Target</TableHead>
                  <TableHead className="h-9 bg-muted/30 text-xs">Impact</TableHead>
                  <TableHead className="h-9 bg-muted/30 w-[60px] text-xs text-center">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
                        <FileText className="h-8 w-8 opacity-50" />
                        <p>No audit logs found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const actionConfig = ACTION_CONFIG[log.action];
                    const ActionIcon = actionConfig?.icon || FileText;
                    const isHighRisk = actionConfig?.isHighRisk || false;
                    const impact = getImpactSummary(log);
                    const ImpactIcon = impact?.icon || Minus;

                    return (
                      <TableRow
                        key={log.id}
                        className={cn(
                          "group",
                          isHighRisk && "bg-orange-50/50 dark:bg-orange-950/10"
                        )}
                      >
                        {/* Timestamp */}
                        <TableCell className="py-2">
                          <div className="text-sm font-medium">
                            {format(new Date(log.created_at), "MMM d, h:mm a")}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {format(new Date(log.created_at), "yyyy")}
                          </div>
                        </TableCell>

                        {/* User */}
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {log.username.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium truncate max-w-[60px]">
                              {log.username}
                            </span>
                          </div>
                        </TableCell>

                        {/* Module */}
                        <TableCell className="py-2">
                          {log.module ? (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[10px] font-medium px-1.5 py-0",
                                MODULE_COLORS[log.module] || "bg-muted"
                              )}
                            >
                              {log.module}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Action */}
                        <TableCell className="py-2">
                          <Badge className={cn("gap-1 text-[10px] px-1.5 py-0", actionConfig?.color)}>
                            <ActionIcon className="h-3 w-3" />
                            {actionConfig?.label || log.action}
                          </Badge>
                        </TableCell>

                        {/* Target */}
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm font-medium truncate max-w-[140px] cursor-help">
                                  {log.entity_name}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>{log.entity_name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {log.entity_type}
                            {log.entity_id && ` #${log.entity_id}`}
                          </span>
                        </TableCell>

                        {/* Impact */}
                        <TableCell className="py-2">
                          {impact ? (
                            <div className={cn("flex items-center gap-1.5 text-sm", impact.color)}>
                              <ImpactIcon className="h-3.5 w-3.5" />
                              <span className="font-medium">{impact.text}</span>
                            </div>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-sm text-muted-foreground line-clamp-1 cursor-help max-w-[200px]">
                                  {log.details}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-sm">
                                <p className="text-sm">{log.details}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleViewLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View details</span>
                          </Button>
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
