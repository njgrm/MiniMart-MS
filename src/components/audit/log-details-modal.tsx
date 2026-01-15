"use client";

import { useState } from "react";
import { format, differenceInDays } from "date-fns";
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
  Equal,
  ImageIcon,
  ZoomIn,
  MessageSquare,
  Truck,
  DollarSign,
  Tag,
  Boxes,
  Hash,
  LogIn,
  LogOut,
  Receipt,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  LOGIN: { label: "Logged In", icon: LogIn, color: "text-emerald-700 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  LOGIN_FAILED: { label: "Login Failed", icon: ShieldAlert, color: "text-red-700 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30" },
  LOGOUT: { label: "Logged Out", icon: LogOut, color: "text-slate-700 dark:text-slate-400", bgColor: "bg-slate-100 dark:bg-slate-900/30" },
  ZREAD_CLOSE: { label: "Z-Read Close", icon: Receipt, color: "text-cyan-700 dark:text-cyan-400", bgColor: "bg-cyan-100 dark:bg-cyan-900/30" },
  VENDOR_REGISTER: { label: "Vendor Registered", icon: UserPlus, color: "text-emerald-700 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  BATCH_RESTOCK: { label: "Batch Restocked", icon: PackagePlus, color: "text-teal-700 dark:text-teal-400", bgColor: "bg-teal-100 dark:bg-teal-900/30" },
  BATCH_RETURN: { label: "Batch Returned", icon: RotateCcw, color: "text-orange-700 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
};

// Module colors
const MODULE_COLORS: Record<string, string> = {
  INVENTORY: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  CATALOG: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  POS: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  ORDERS: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  AUTH: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

// Helper: Format category enum to Title Case (e.g., CANNED_GOODS -> "Canned Goods")
function formatCategory(category: string | null | undefined): string {
  if (!category) return "";
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

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

// Check if date is within N days (for expiry warning)
function getDaysUntilExpiry(dateStr: string): number | null {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return differenceInDays(date, new Date());
  } catch {
    return null;
  }
}

// Hero Math Section for stock changes
function StockMathHero({ 
  oldStock, 
  change, 
  newStock,
  isPositive 
}: { 
  oldStock: number; 
  change: number; 
  newStock: number;
  isPositive: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-3 py-6 px-4 bg-muted/30 rounded-lg">
      {/* Previous Stock */}
      <div className="text-center">
        <div className="text-2xl font-bold text-muted-foreground">{oldStock.toLocaleString()}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Previous</div>
      </div>
      
      {/* Operator */}
      <div className={cn(
        "text-2xl font-bold",
        isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      )}>
        {isPositive ? "+" : "−"}
      </div>
      
      {/* Change Amount - HERO */}
      <div className="text-center">
        <div className={cn(
          "text-4xl font-black",
          isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
        )}>
          {Math.abs(change).toLocaleString()}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          {isPositive ? "Added" : "Removed"}
        </div>
      </div>
      
      {/* Equals */}
      <Equal className="h-6 w-6 text-muted-foreground" />
      
      {/* New Stock */}
      <div className="text-center">
        <div className="text-2xl font-bold text-foreground">{newStock.toLocaleString()}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">New Level</div>
      </div>
    </div>
  );
}

// Metadata Grid Component
function MetadataGrid({ items }: { items: { label: string; value: React.ReactNode; warning?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item, i) => (
        <div key={i} className={cn(
          "p-3 rounded-lg border bg-card",
          item.warning && "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20"
        )}>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{item.label}</div>
          <div className={cn(
            "text-sm font-semibold flex items-center gap-1.5",
            item.warning && "text-amber-700 dark:text-amber-400"
          )}>
            {item.warning && <AlertTriangle className="h-3.5 w-3.5" />}
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// Snapshot Item for Archive/Restore modals
function SnapshotItem({ 
  icon: Icon, 
  label, 
  value 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string;
}) {
  return (
    <div className="p-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

export function LogDetailsModal({ log, open, onOpenChange }: LogDetailsModalProps) {
  const [imageZoom, setImageZoom] = useState(false);

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

  // Stock math for RESTOCK/ADJUST actions
  const isStockAction = ["RESTOCK", "ADJUST_STOCK", "EDIT_BATCH"].includes(log.action);
  
  // Handle different metadata field names from logger
  let oldStock: number | undefined;
  let newStock: number | undefined;
  let stockChange: number | undefined;

  if (log.action === "RESTOCK") {
    const quantityAdded = metadata?.quantity_added as number | undefined;
    const newStockLevel = metadata?.new_stock_level as number | undefined;
    const previousStock = metadata?.previous_stock as number | undefined;
    if (quantityAdded !== undefined && newStockLevel !== undefined) {
      stockChange = quantityAdded;
      newStock = newStockLevel;
      // Use actual previous_stock from metadata if available, otherwise calculate
      oldStock = previousStock !== undefined ? previousStock : (newStockLevel - quantityAdded);
    }
  } else if (log.action === "ADJUST_STOCK") {
    oldStock = metadata?.previous_stock as number | undefined;
    newStock = metadata?.new_stock as number | undefined;
    stockChange = metadata?.quantity_change as number | undefined;
    if (stockChange === undefined && oldStock !== undefined && newStock !== undefined) {
      stockChange = newStock - oldStock;
    }
  } else if (log.action === "EDIT_BATCH") {
    oldStock = metadata?.old_quantity as number | undefined;
    newStock = metadata?.new_quantity as number | undefined;
    stockChange = metadata?.quantity_change as number | undefined;
    if (stockChange === undefined && oldStock !== undefined && newStock !== undefined) {
      stockChange = newStock - oldStock;
    }
  }

  const hasStockMath = isStockAction && oldStock !== undefined && newStock !== undefined && stockChange !== undefined;
  
  // Expiry check
  const expiryDate = metadata?.expiry_date as string | undefined;
  const daysUntilExpiry = expiryDate ? getDaysUntilExpiry(expiryDate) : null;
  const isNearExpiry = daysUntilExpiry !== null && daysUntilExpiry <= 30;
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;

  // Build metadata items for grid
  const metadataItems: { label: string; value: React.ReactNode; warning?: boolean }[] = [];
  
  // For RESTOCK: Add all the fields like Stock History shows
  if (log.action === "RESTOCK") {
    // Date & Time
    metadataItems.push({ 
      label: "Date & Time", 
      value: format(new Date(log.created_at), "MMMM d, yyyy 'at' h:mm a") 
    });
    // Performed By
    metadataItems.push({ label: "Performed By", value: log.username });
  }
  
  if (metadata?.supplier_name) {
    metadataItems.push({ label: "Supplier", value: metadata.supplier_name as string });
  }
  if (metadata?.reference) {
    metadataItems.push({ label: "Reference #", value: metadata.reference as string });
  }
  if (metadata?.cost_price !== undefined && metadata?.cost_price !== null) {
    metadataItems.push({ 
      label: "Cost Price", 
      value: `₱${Number(metadata.cost_price).toFixed(2)} per unit` 
    });
  }
  if (metadata?.batch_id) {
    metadataItems.push({ label: "Batch ID", value: `#${metadata.batch_id}` });
  }
  // Movement ID (for restock, entity_id is often the movement)
  if (log.action === "RESTOCK" && log.entity_id) {
    metadataItems.push({ label: "Movement ID", value: `#${log.entity_id}` });
  }
  if (expiryDate) {
    metadataItems.push({ 
      label: "Expiry Date", 
      value: (
        <span>
          {format(new Date(expiryDate), "MMM d, yyyy")}
          {daysUntilExpiry !== null && (
            <span className="ml-1.5 text-xs font-normal">
              ({isExpired ? "expired" : `${daysUntilExpiry}d left`})
            </span>
          )}
        </span>
      ),
      warning: isNearExpiry || isExpired
    });
  }
  // Non-restock actions: show reason/notes in grid
  if (log.action !== "RESTOCK") {
    if (metadata?.reason) {
      metadataItems.push({ label: "Reason", value: metadata.reason as string });
    }
    if (metadata?.notes) {
      metadataItems.push({ label: "Notes", value: metadata.notes as string });
    }
  }

  // LOGIN/LOGOUT metadata
  if (log.action === "LOGIN" || log.action === "LOGOUT") {
    if (metadata?.user_type) {
      metadataItems.push({ label: "User Type", value: String(metadata.user_type) });
    }
    if (metadata?.email) {
      metadataItems.push({ label: "Email", value: String(metadata.email) });
    }
    if (metadata?.ip_address) {
      metadataItems.push({ label: "IP Address", value: String(metadata.ip_address) });
    }
    if (metadata?.session_status) {
      metadataItems.push({ label: "Session", value: String(metadata.session_status) });
    }
  }

  // LOGIN_FAILED metadata
  if (log.action === "LOGIN_FAILED") {
    const reasonMessages: Record<string, string> = {
      user_not_found: "User not found in system",
      wrong_password: "Incorrect password entered",
      account_disabled: "Account has been disabled",
      unknown: "Authentication failed",
    };
    if (metadata?.reason) {
      metadataItems.push({ 
        label: "Failure Reason", 
        value: reasonMessages[String(metadata.reason)] || String(metadata.reason),
        warning: true
      });
    }
    if (metadata?.identifier) {
      metadataItems.push({ label: "Attempted As", value: String(metadata.identifier) });
    }
    if (metadata?.attempt_time) {
      metadataItems.push({ label: "Attempt Time", value: format(new Date(String(metadata.attempt_time)), "MMM d, yyyy h:mm a") });
    }
    if (metadata?.ip_address) {
      metadataItems.push({ label: "IP Address", value: String(metadata.ip_address) });
    }
  }

  // VENDOR_REGISTER metadata
  if (log.action === "VENDOR_REGISTER") {
    if (metadata?.vendor_name) {
      metadataItems.push({ label: "Vendor Name", value: String(metadata.vendor_name) });
    }
    if (metadata?.email) {
      metadataItems.push({ label: "Email", value: String(metadata.email) });
    }
    if (metadata?.contact_details) {
      metadataItems.push({ label: "Contact", value: String(metadata.contact_details) });
    }
    if (metadata?.registration_time) {
      metadataItems.push({ label: "Registered At", value: format(new Date(String(metadata.registration_time)), "MMM d, yyyy h:mm a") });
    }
  }

  // Z-Read Close metadata
  if (log.action === "ZREAD_CLOSE") {
    if (metadata?.total_sales !== undefined) {
      metadataItems.push({ 
        label: "Total Sales", 
        value: `₱${Number(metadata.total_sales).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` 
      });
    }
    if (metadata?.total_transactions !== undefined) {
      metadataItems.push({ label: "Total Transactions", value: String(metadata.total_transactions) });
    }
    if (metadata?.cash_sales !== undefined) {
      metadataItems.push({ 
        label: "Cash Sales", 
        value: `₱${Number(metadata.cash_sales).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` 
      });
    }
    if (metadata?.gcash_sales !== undefined) {
      metadataItems.push({ 
        label: "GCash Sales", 
        value: `₱${Number(metadata.gcash_sales).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` 
      });
    }
    if (metadata?.expected_drawer !== undefined) {
      metadataItems.push({ 
        label: "Expected Drawer", 
        value: `₱${Number(metadata.expected_drawer).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` 
      });
    }
    if (metadata?.actual_drawer !== undefined) {
      metadataItems.push({ 
        label: "Actual Drawer", 
        value: `₱${Number(metadata.actual_drawer).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` 
      });
    }
    if (metadata?.variance !== undefined) {
      const variance = Number(metadata.variance);
      metadataItems.push({ 
        label: "Variance", 
        value: `₱${Math.abs(variance).toLocaleString("en-PH", { minimumFractionDigits: 2 })} ${variance >= 0 ? '(over)' : '(short)'}`,
        warning: variance !== 0
      });
    }
    if (metadata?.starting_cash !== undefined) {
      metadataItems.push({ 
        label: "Starting Cash", 
        value: `₱${Number(metadata.starting_cash).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` 
      });
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
          {/* Compact Header - No badge here to avoid overlapping X button */}
          <DialogHeader className="px-5 py-3 border-b shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={cn("p-1.5 rounded-md", actionConfig?.bgColor)}>
                <ActionIcon className={cn("h-4 w-4", actionConfig?.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold">
                  {actionConfig?.label || log.action}
                </DialogTitle>
                <p className="text-xs text-muted-foreground truncate">{log.entity_name}</p>
              </div>
            </div>
          </DialogHeader>

          {/* Compact Meta Bar - Module badge moved here */}
          <div className="px-5 py-2 bg-muted/30 border-b flex items-center gap-4 text-xs text-muted-foreground shrink-0">
            {log.module && (
              <Badge className={cn("text-[10px]", MODULE_COLORS[log.module] || "bg-muted")}>
                {log.module}
              </Badge>
            )}
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {log.username}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-5 py-4 space-y-4">
              
              {/* Hero Math Section for Stock Actions */}
              {hasStockMath && (
                <StockMathHero 
                  oldStock={oldStock!}
                  change={stockChange!}
                  newStock={newStock!}
                  isPositive={stockChange! > 0}
                />
              )}
              
              {/* Receipt Image (Restock) */}
              {log.action === "RESTOCK" && typeof metadata?.receipt_image_url === "string" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ImageIcon className="h-3 w-3" />
                    Receipt Proof
                  </div>
                  <div 
                    className="relative h-40 w-full rounded-lg border border-border bg-muted/20 overflow-hidden cursor-pointer group"
                    onClick={() => setImageZoom(true)}
                  >
                    <img
                      src={metadata.receipt_image_url}
                      alt="Receipt"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ZoomIn className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata Grid */}
              {metadataItems.length > 0 && (
                <MetadataGrid items={metadataItems} />
              )}

              {/* Restock: Reason/Notes Section (like Stock History) */}
              {log.action === "RESTOCK" && (typeof metadata?.reason === "string" || typeof metadata?.notes === "string") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    Reason / Notes
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/20">
                    <p className="text-sm whitespace-pre-wrap">
                      {String(metadata?.reason || metadata?.notes || "")}
                    </p>
                  </div>
                </div>
              )}

              {/* Archive/Restore: Snapshot Summary */}
              {(log.action === "ARCHIVE" || log.action === "RESTORE") && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Package className="h-3 w-3" />
                    {log.action === "ARCHIVE" ? "Archived Product Snapshot" : "Restored Product Snapshot"}
                  </div>
                  <div className="rounded-lg border bg-card overflow-hidden">
                    {/* Product Info */}
                    <div className="p-4 border-b bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-muted border flex items-center justify-center overflow-hidden">
                          {log.product_image ? (
                            <img src={log.product_image} alt={log.entity_name} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-6 w-6 text-muted-foreground/50" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{log.entity_name}</h4>
                          {(metadata?.category || log.product_category) && (
                            <span className="text-xs text-muted-foreground">
                              {formatCategory((metadata?.category || log.product_category) as string)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Snapshot Details Grid */}
                    <div className="grid grid-cols-2 divide-x divide-y">
                      <SnapshotItem 
                        icon={Tag} 
                        label="SKU / Barcode" 
                        value={String(metadata?.barcode || metadata?.sku || `ID: ${log.entity_id}`)} 
                      />
                      <SnapshotItem 
                        icon={DollarSign} 
                        label="Retail Price" 
                        value={metadata?.retail_price != null ? `₱${Number(metadata.retail_price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"} 
                      />
                      <SnapshotItem 
                        icon={Boxes} 
                        label="Final Stock" 
                        value={metadata?.current_stock != null ? `${Number(metadata.current_stock).toLocaleString()} units` : "—"} 
                      />
                      <SnapshotItem 
                        icon={Hash} 
                        label="Entity ID" 
                        value={`#${log.entity_id}`} 
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    This is a record of the product state at the time of {log.action === "ARCHIVE" ? "archiving" : "restoration"}.
                  </p>
                </div>
              )}

              {/* Diff View for UPDATE actions */}
              {hasOldNewValues && changedFields.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Changes</h4>
                  <div className="rounded-lg border overflow-hidden divide-y">
                    {changedFields.map((field) => {
                      const oldVal = oldValues[field];
                      const newVal = newValues[field];
                      const isHighRisk = ["expiry_date", "current_stock", "quantity", "cost_price"].includes(field);
                      
                      return (
                        <div
                          key={field}
                          className={cn(
                            "flex items-center justify-between px-3 py-2",
                            isHighRisk && "bg-orange-50/50 dark:bg-orange-950/10"
                          )}
                        >
                          <div className="flex items-center gap-1.5 text-sm">
                            {isHighRisk && <AlertTriangle className="h-3 w-3 text-orange-500" />}
                            <span className="font-medium">{getFieldLabel(field)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground line-through decoration-red-400/50 decoration-2">
                              {formatValue(oldVal, field)}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                            <span className="font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                              {formatValue(newVal, field)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center pt-1">
                    Comparing old value vs new value
                  </p>
                </div>
              )}

              {/* Fallback for actions without structured data */}
              {!hasStockMath && metadataItems.length === 0 && !hasOldNewValues && !metadata?.receipt_image_url && !["ARCHIVE", "RESTORE"].includes(log.action) && (
                <div className="text-center text-sm text-muted-foreground py-4">
                  No additional details available.
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {/* Image Zoom Modal */}
      <Dialog open={imageZoom} onOpenChange={setImageZoom}>
        <DialogContent className="max-w-4xl p-2 bg-black/90 border-none">
          <DialogTitle className="sr-only">Receipt Image Preview</DialogTitle>
          {typeof metadata?.receipt_image_url === "string" && (
            <img
              src={metadata.receipt_image_url}
              alt="Receipt"
              className="w-full h-auto max-h-[85vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
