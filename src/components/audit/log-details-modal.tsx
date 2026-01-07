"use client";

import { format } from "date-fns";
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  PackagePlus,
  ClipboardEdit,
  Upload,
  XCircle,
  AlertTriangle,
  Calendar,
  User,
  Clock,
  ArrowRight,
  Package,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AuditLogEntry } from "@/actions/audit";
import { AuditAction } from "@prisma/client";

interface LogDetailsModalProps {
  log: AuditLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Action configuration
const ACTION_CONFIG: Record<AuditAction, { label: string; icon: typeof Plus; color: string; bgColor: string }> = {
  CREATE: { label: "Created", icon: Plus, color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/30" },
  UPDATE: { label: "Updated", icon: Pencil, color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  DELETE: { label: "Deleted", icon: Trash2, color: "text-red-700 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30" },
  ARCHIVE: { label: "Archived", icon: Archive, color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  RESTORE: { label: "Restored", icon: RotateCcw, color: "text-purple-700 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  ADJUST_STOCK: { label: "Stock Adjusted", icon: AlertTriangle, color: "text-orange-700 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  RESTOCK: { label: "Restocked", icon: PackagePlus, color: "text-teal-700 dark:text-teal-400", bgColor: "bg-teal-100 dark:bg-teal-900/30" },
  BULK_IMPORT: { label: "Imported", icon: Upload, color: "text-indigo-700 dark:text-indigo-400", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
  ORDER_CANCEL: { label: "Order Cancelled", icon: XCircle, color: "text-red-700 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30" },
  EDIT_EXPIRY: { label: "Expiry Changed", icon: Calendar, color: "text-orange-700 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  EDIT_BATCH: { label: "Batch Edited", icon: ClipboardEdit, color: "text-orange-700 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
};

// Module colors
const MODULE_COLORS: Record<string, string> = {
  INVENTORY: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  CATALOG: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  POS: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  ORDERS: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  AUTH: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

// Field labels for human-readable display
const FIELD_LABELS: Record<string, string> = {
  product_name: "Product Name",
  retail_price: "Retail Price",
  wholesale_price: "Wholesale Price",
  cost_price: "Cost Price",
  category: "Category",
  barcode: "Barcode",
  current_stock: "Stock Level",
  reorder_level: "Reorder Level",
  expiry_date: "Expiry Date",
  quantity: "Quantity",
  supplier_name: "Supplier",
  reference: "Reference",
  status: "Status",
  total_amount: "Total Amount",
  image_url: "Product Image",
  supplier_ref: "Supplier Reference",
  batch_number: "Batch Number",
  notes: "Notes",
};

function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown, key?: string): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (key?.toLowerCase().includes("price") || key?.toLowerCase().includes("amount") || key?.toLowerCase().includes("cost")) {
      return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return value.toLocaleString();
  }
  if (typeof value === "string") {
    // Try to parse as date
    if (key?.toLowerCase().includes("date") || key?.toLowerCase().includes("expiry")) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return format(date, "MMM d, yyyy");
        }
      } catch {
        // Not a date
      }
    }
    return value;
  }
  return JSON.stringify(value);
}

export function LogDetailsModal({ log, open, onOpenChange }: LogDetailsModalProps) {
  if (!log) return null;

  const actionConfig = ACTION_CONFIG[log.action];
  const ActionIcon = actionConfig?.icon || Package;
  const metadata = log.metadata as Record<string, unknown> | null;
  
  // Check if this is an update with old/new values
  const hasOldNewValues = Boolean(metadata?.old_values && metadata?.new_values);
  const oldValues = (metadata?.old_values ?? {}) as Record<string, unknown>;
  const newValues = (metadata?.new_values ?? {}) as Record<string, unknown>;
  const changedFields: string[] = Array.isArray(metadata?.changed_fields) 
    ? (metadata.changed_fields as string[]) 
    : [];

  // For non-update actions, show all metadata as a snapshot
  const snapshotData = !hasOldNewValues ? metadata : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <div className={cn("p-1.5 rounded-md", actionConfig?.bgColor)}>
                  <ActionIcon className={cn("h-4 w-4", actionConfig?.color)} />
                </div>
                {actionConfig?.label || log.action}
              </DialogTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  {log.entity_name}
                </span>
                {log.entity_id && (
                  <span className="text-xs text-muted-foreground">
                    #{log.entity_id}
                  </span>
                )}
              </p>
            </div>
            {log.module && (
              <Badge className={cn("text-xs", MODULE_COLORS[log.module] || "bg-muted")}>
                {log.module}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Meta Info Bar */}
        <div className="px-6 py-3 bg-muted/30 border-b flex items-center gap-6 text-sm shrink-0">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="font-medium text-foreground">{log.username}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{log.entity_type}</span>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-6">
            {/* Summary / Details */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Summary</h4>
              <p className="text-sm">{log.details}</p>
            </div>

            <Separator />

            {/* Diff View for Updates */}
            {hasOldNewValues && changedFields.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Changes</h4>
                <div className="rounded-lg border overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-3 gap-4 px-4 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <div>Field</div>
                    <div>Previous</div>
                    <div>New</div>
                  </div>
                  {/* Rows */}
                  {changedFields.map((field) => {
                    const oldVal: unknown = oldValues[field];
                    const newVal: unknown = newValues[field];
                    const isHighRisk = ["expiry_date", "current_stock", "quantity", "cost_price"].includes(field);
                    
                    return (
                      <div
                        key={field}
                        className={cn(
                          "grid grid-cols-3 gap-4 px-4 py-3 border-b last:border-b-0",
                          isHighRisk && "bg-orange-50/50 dark:bg-orange-950/10"
                        )}
                      >
                        <div className="text-sm font-medium flex items-center gap-2">
                          {getFieldLabel(field)}
                          {isHighRisk && (
                            <AlertTriangle className="h-3 w-3 text-orange-500" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground line-through">
                          {formatValue(oldVal, field)}
                        </div>
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className={isHighRisk ? "text-orange-700 dark:text-orange-400" : ""}>
                            {formatValue(newVal, field)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Snapshot View for Creates/Restocks */}
            {snapshotData && Object.keys(snapshotData).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Details</h4>
                <div className="rounded-lg border overflow-hidden">
                  {Object.entries(snapshotData)
                    .filter(([key]) => !key.startsWith("_") && key !== "has_high_risk_changes")
                    .map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0"
                      >
                        <span className="text-sm text-muted-foreground">
                          {getFieldLabel(key)}
                        </span>
                        <span className="text-sm font-medium">
                          {typeof value === "object" && value !== null ? (
                            <pre className="text-xs bg-muted px-2 py-1 rounded max-w-[300px] overflow-auto">
                              {JSON.stringify(value, null, 2)}
                            </pre>
                          ) : (
                            formatValue(value, key)
                          )}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* No additional data */}
            {!hasOldNewValues && (!snapshotData || Object.keys(snapshotData).length === 0) && (
              <div className="text-center text-sm text-muted-foreground py-4">
                No additional details available for this action.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
