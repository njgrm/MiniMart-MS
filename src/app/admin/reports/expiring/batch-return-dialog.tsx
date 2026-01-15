"use client";

import { useState, useTransition, useMemo } from "react";
import { format, differenceInDays, startOfDay } from "date-fns";
import Image from "next/image";
import { 
  Undo2, 
  Truck, 
  X, 
  Search,
  Plus,
  Trash2,
  Package,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  XCircle,
  Timer,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { batchReturnProducts, type BatchReturnItem } from "@/actions/inventory";
import { type ExpiringItem } from "@/actions/reports";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface BatchReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expiringItems: ExpiringItem[];
  preSelectedBatchId?: number | null;
  onSuccess?: () => void;
}

// Urgency configuration matching expiring-client
const urgencyConfig: Record<
  ExpiringItem["urgency"],
  { label: string; color: string; icon: React.ElementType; badgeClass: string }
> = {
  expired: {
    label: "Expired",
    color: "text-[#AC0F16]",
    icon: XCircle,
    badgeClass: "bg-red-50 text-[#AC0F16] border-red-200",
  },
  critical: {
    label: "Critical",
    color: "text-[#AC0F16]",
    icon: AlertCircle,
    badgeClass: "bg-red-50 text-[#AC0F16] border-red-200",
  },
  warning: {
    label: "Warning",
    color: "text-[#F1782F]",
    icon: AlertTriangle,
    badgeClass: "bg-[#fef3eb] text-[#F1782F] border-[#F1782F]/30",
  },
  caution: {
    label: "Caution",
    color: "text-[#2EAFC5]",
    icon: Timer,
    badgeClass: "bg-[#e6f7fa] text-[#2EAFC5] border-[#2EAFC5]/30",
  },
  advise_return: {
    label: "Advise Return",
    color: "text-stone-500",
    icon: Calendar,
    badgeClass: "bg-stone-100 text-stone-600 border-stone-300",
  },
};

// Helper: Format peso with normal weight sign
function formatPeso(amount: number) {
  return (
    <span>
      <span className="font-normal">₱</span>
      {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

export function BatchReturnDialog({
  open,
  onOpenChange,
  expiringItems,
  preSelectedBatchId,
  onSuccess,
}: BatchReturnDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Confirmation dialog
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Return info (shared across all items)
  const [supplierName, setSupplierName] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");

  // Collapsible states
  const [returnInfoOpen, setReturnInfoOpen] = useState(true);

  // Selected items for return
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<number>>(new Set());

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Pre-select batch when prop changes (for single-batch return from table)
  useEffect(() => {
    if (open && preSelectedBatchId !== null && preSelectedBatchId !== undefined) {
      setSelectedBatchIds(new Set([preSelectedBatchId]));
      // Pre-fill reason for convenience
      const batch = expiringItems.find(i => i.batch_id === preSelectedBatchId);
      if (batch) {
        if (batch.urgency === "expired") {
          setReason("Expired product - returning to supplier");
        } else {
          setReason(`Near expiry (${batch.days_until_expiry} days) - returning to supplier`);
        }
        if (batch.supplier_name) {
          setSupplierName(batch.supplier_name);
        }
      }
    }
  }, [open, preSelectedBatchId, expiringItems]);

  // Reset form when dialog opens
  const resetForm = () => {
    setSupplierName("");
    setReference("");
    setReason("");
    setSelectedBatchIds(new Set());
    setSearchQuery("");
    setError(null);
    setReturnInfoOpen(true);
    setShowConfirmation(false);
  };

  // Filter available items (expired and critical priority)
  const availableItems = useMemo(() => {
    // Sort by urgency (expired first, then critical, warning, caution, advise_return)
    const urgencyOrder: Record<string, number> = { expired: 0, critical: 1, warning: 2, caution: 3, advise_return: 4 };
    return [...expiringItems].sort((a, b) => (urgencyOrder[a.urgency] ?? 5) - (urgencyOrder[b.urgency] ?? 5));
  }, [expiringItems]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return availableItems;
    const query = searchQuery.toLowerCase();
    return availableItems.filter(item =>
      item.product_name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.barcode?.toLowerCase().includes(query) ||
      item.batch_number?.toLowerCase().includes(query) ||
      item.supplier_name?.toLowerCase().includes(query)
    );
  }, [availableItems, searchQuery]);

  // Get selected items
  const selectedItems = useMemo(() => 
    availableItems.filter(item => selectedBatchIds.has(item.batch_id)),
    [availableItems, selectedBatchIds]
  );

  // Calculate totals
  const totalUnits = selectedItems.reduce((sum, i) => sum + i.current_quantity, 0);
  const totalValue = selectedItems.reduce((sum, i) => sum + i.value_at_risk, 0);

  // Toggle item selection
  const toggleItem = (batchId: number) => {
    setSelectedBatchIds(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  // Select all expired items
  const selectAllExpired = () => {
    const expiredIds = availableItems
      .filter(i => i.urgency === "expired")
      .map(i => i.batch_id);
    setSelectedBatchIds(new Set(expiredIds));
  };

  // Select all visible (filtered) items
  const selectAllVisible = () => {
    const visibleIds = filteredItems.map(i => i.batch_id);
    setSelectedBatchIds(new Set(visibleIds));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedBatchIds(new Set());
  };

  // Validate and show confirmation
  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedBatchIds.size === 0) {
      setError("Please select at least one batch to return");
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      setError("Please provide a reason (min 3 characters)");
      return;
    }

    // Show confirmation dialog
    setShowConfirmation(true);
  };

  // Actual submission after confirmation
  const handleConfirmedSubmit = async () => {
    setShowConfirmation(false);

    startTransition(async () => {
      const items: BatchReturnItem[] = selectedItems.map(item => ({
        batchId: item.batch_id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.current_quantity,
        expiryDate: item.expiry_date,
        supplierName: item.supplier_name,
        costPrice: item.cost_price,
      }));

      const result = await batchReturnProducts({
        items,
        reason: reason.trim(),
        supplierName: supplierName.trim() || undefined,
        reference: reference.trim() || undefined,
      });

      if (result.success) {
        const data = result.data!;
        toast.success(`Batch return completed`, {
          description: `Returned ${data.totalUnitsReturned} units (${data.successCount} batches) worth ₱${data.totalValueReturned.toLocaleString()}`,
        });
        onSuccess?.();
        onOpenChange(false);
        resetForm();
      } else {
        setError(result.error || "Failed to process batch return");
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(newOpen) => {
        if (!newOpen) resetForm();
        onOpenChange(newOpen);
      }}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Undo2 className="h-5 w-5 text-[#AC0F16]" />
              Batch Return to Supplier
            </DialogTitle>
            <DialogDescription>
              Select expired or expiring batches to return to suppliers. All items will be removed from inventory.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mx-6 mt-4 bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form id="batch-return-form" onSubmit={handlePreSubmit} className="flex-1 flex flex-col overflow-hidden">
            {/* TOP: Return Info Collapsible */}
            <div className="border-b px-6 py-3 flex-shrink-0">
              <Collapsible open={returnInfoOpen} onOpenChange={setReturnInfoOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Return Details</span>
                    </div>
                    {returnInfoOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplierName" className="text-xs font-medium">
                        Supplier Name
                      </Label>
                      <Input
                        id="supplierName"
                        placeholder="e.g., ABC Distributors"
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reference" className="text-xs font-medium">
                        Reference / RMA #
                      </Label>
                      <Input
                        id="reference"
                        placeholder="e.g., RMA-2026-001"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reason" className="text-xs font-medium text-destructive">
                        Reason for Return *
                      </Label>
                      <Input
                        id="reason"
                        placeholder="e.g., Expired products, supplier recall"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="h-9"
                        required
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* MIDDLE: Batch Selection */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 px-6 py-4">
              {/* Search and Quick Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 flex-shrink-0">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products, suppliers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllExpired}
                    className="h-8 text-xs"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5 text-[#AC0F16]" />
                    Select All Expired
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllVisible}
                    className="h-8 text-xs"
                  >
                    Select All Visible
                  </Button>
                  {selectedBatchIds.size > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      className="h-8 text-xs text-muted-foreground"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Clear ({selectedBatchIds.size})
                    </Button>
                  )}
                </div>
              </div>

              {/* Batch List */}
              <ScrollArea className="flex-1 min-h-0 border rounded-lg overflow-auto">
                <div className="p-2 space-y-1">
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No expiring batches found</p>
                    </div>
                  ) : (
                    filteredItems.map((item) => {
                      const isSelected = selectedBatchIds.has(item.batch_id);
                      const config = urgencyConfig[item.urgency];
                      const Icon = config.icon;

                      return (
                        <div
                          key={item.batch_id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                            isSelected 
                              ? "bg-primary/5 border-primary/30" 
                              : "bg-card hover:bg-muted/50 border-transparent"
                          )}
                          onClick={() => toggleItem(item.batch_id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => {
                              // Handled by parent onClick, prevent double toggle
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0"
                          />
                          
                          {/* Urgency Icon */}
                          <div className={cn("p-1.5 rounded", config.badgeClass)}>
                            <Icon className="h-4 w-4" />
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {item.product_name}
                              </span>
                              <Badge variant="outline" className={cn("text-[10px]", config.badgeClass)}>
                                {config.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(item.expiry_date), "MMM d, yyyy")}
                              </span>
                              {item.batch_number && (
                                <span>Batch: {item.batch_number}</span>
                              )}
                              {item.supplier_name && (
                                <span className="flex items-center gap-1">
                                  <Truck className="h-3 w-3" />
                                  {item.supplier_name}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quantity & Value */}
                          <div className="text-right flex-shrink-0">
                            <p className="font-mono text-sm font-medium">
                              {item.current_quantity} units
                            </p>
                            <p className="text-xs text-[#AC0F16] font-mono">
                              {formatPeso(item.value_at_risk)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* BOTTOM: Summary & Actions */}
            <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
              <div className="flex-1 flex items-center gap-4">
                {selectedBatchIds.size > 0 && (
                  <div className="flex items-center gap-4 text-sm">
                    <Badge variant="secondary" className="font-mono">
                      {selectedBatchIds.size} batches
                    </Badge>
                    <span className="text-muted-foreground">
                      {totalUnits.toLocaleString()} units
                    </span>
                    <span className="font-medium text-[#AC0F16]">
                      {formatPeso(totalValue)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="batch-return-form"
                  disabled={isPending || selectedBatchIds.size === 0}
                  className="bg-[#AC0F16] hover:bg-[#8a0c12] text-white"
                >
                  {isPending ? (
                    <>
                      <Package className="h-4 w-4 mr-2 animate-pulse" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Undo2 className="h-4 w-4 mr-2" />
                      Return {selectedBatchIds.size > 0 ? `${selectedBatchIds.size} Batches` : "to Supplier"}
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#F1782F]" />
              Confirm Batch Return
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to return <strong>{selectedBatchIds.size} batches</strong> ({totalUnits.toLocaleString()} units) 
                worth <strong className="text-[#AC0F16]">₱{totalValue.toLocaleString()}</strong> to the supplier.
              </p>
              <p className="text-muted-foreground">
                This action will remove these batches from inventory and cannot be undone.
                A stock movement record will be created for each batch.
              </p>
              {reason && (
                <div className="bg-muted/50 p-3 rounded-lg text-sm">
                  <strong>Reason:</strong> {reason}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedSubmit}
              disabled={isPending}
              className="bg-[#AC0F16] hover:bg-[#8a0c12]"
            >
              {isPending ? "Processing..." : "Confirm Return"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
