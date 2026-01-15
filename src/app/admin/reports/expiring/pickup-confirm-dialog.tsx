"use client";

import { useState, useMemo, useTransition } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import {
  Package,
  Truck,
  CheckCircle2,
  Search,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Timer,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { confirmBatchesReturned } from "@/actions/inventory";
import { type ExpiringItem } from "@/actions/reports";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PickupConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  markedItems: ExpiringItem[];
  onSuccess?: () => void;
}

// Urgency configuration for badges
const urgencyConfig: Record<
  ExpiringItem["urgency"],
  { label: string; icon: React.ElementType; badgeClass: string }
> = {
  expired: {
    label: "Expired",
    icon: XCircle,
    badgeClass: "bg-red-50 text-[#AC0F16] border-red-200",
  },
  critical: {
    label: "Critical",
    icon: AlertCircle,
    badgeClass: "bg-red-50 text-[#AC0F16] border-red-200",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    badgeClass: "bg-[#fef3eb] text-[#F1782F] border-[#F1782F]/30",
  },
  caution: {
    label: "Caution",
    icon: Timer,
    badgeClass: "bg-[#e6f7fa] text-[#2EAFC5] border-[#2EAFC5]/30",
  },
  advise_return: {
    label: "Advise Return",
    icon: Calendar,
    badgeClass: "bg-stone-100 text-stone-600 border-stone-300",
  },
};

// Helper: Format peso
function formatPeso(amount: number) {
  return (
    <span>
      <span className="font-normal">₱</span>
      {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

export function PickupConfirmDialog({
  open,
  onOpenChange,
  markedItems,
  onSuccess,
}: PickupConfirmDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  
  // Reference info
  const [supplierName, setSupplierName] = useState("");
  const [reference, setReference] = useState("");

  // Reset form when dialog opens
  const resetForm = () => {
    setSelectedBatchIds(new Set(markedItems.map(i => i.batch_id))); // Select all by default
    setSearchQuery("");
    setSupplierName("");
    setReference("");
    setError(null);
  };

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return markedItems;
    const query = searchQuery.toLowerCase();
    return markedItems.filter(item =>
      item.product_name.toLowerCase().includes(query) ||
      item.supplier_name?.toLowerCase().includes(query) ||
      item.batch_number?.toLowerCase().includes(query)
    );
  }, [markedItems, searchQuery]);

  // Selected items details
  const selectedItems = useMemo(
    () => markedItems.filter(item => selectedBatchIds.has(item.batch_id)),
    [markedItems, selectedBatchIds]
  );

  // Totals
  const totalUnits = selectedItems.reduce((sum, i) => sum + i.current_quantity, 0);
  const totalValue = selectedItems.reduce((sum, i) => sum + i.value_at_risk, 0);

  // Toggle selection
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

  // Select/Deselect all
  const selectAll = () => {
    setSelectedBatchIds(new Set(filteredItems.map(i => i.batch_id)));
  };

  const deselectAll = () => {
    setSelectedBatchIds(new Set());
  };

  // Submit
  const handleConfirm = async () => {
    if (selectedBatchIds.size === 0) {
      setError("Please select at least one batch to confirm");
      return;
    }

    setError(null);

    startTransition(async () => {
      const batchIds = Array.from(selectedBatchIds);
      const result = await confirmBatchesReturned(
        batchIds,
        supplierName.trim() || undefined,
        reference.trim() || undefined
      );

      if (result.success) {
        toast.success("Batch pickup confirmed", {
          description: `Returned ${result.data!.totalUnits} units (${result.data!.returnedCount} batches) worth ₱${result.data!.totalValue.toLocaleString()}`,
        });
        onSuccess?.();
        router.refresh();
        onOpenChange(false);
        resetForm();
      } else {
        setError(result.error || "Failed to confirm batch pickup");
      }
    });
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        if (newOpen) resetForm();
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Truck className="h-5 w-5 text-purple-600" />
            Confirm Supplier Pickup
          </DialogTitle>
          <DialogDescription>
            Select batches that were picked up by the supplier. Selected items will be removed from inventory.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mx-6 mt-4 bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="px-6 py-4 border-b space-y-4 flex-shrink-0">
          {/* Search and reference fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pickup-supplier">Supplier Name (Optional)</Label>
              <Input
                id="pickup-supplier"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g., ABC Distributors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup-reference">Reference # (Optional)</Label>
              <Input
                id="pickup-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g., RET-2026-001"
              />
            </div>
          </div>

          {/* Search and selection controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={selectAll} className="h-9 text-xs">
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll} className="h-9 text-xs">
              Clear
            </Button>
          </div>
        </div>

        {/* Batch list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-2 space-y-2">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No batches marked for return</p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedBatchIds.has(item.batch_id);
                const config = urgencyConfig[item.urgency];
                const StatusIcon = config.icon;

                return (
                  <div
                    key={item.batch_id}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      isSelected
                        ? "bg-purple-50 border-purple-300"
                        : "bg-card hover:bg-muted/50 border-border"
                    )}
                    onClick={() => toggleItem(item.batch_id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleItem(item.batch_id)}
                        onClick={(e) => e.stopPropagation()}
                        className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {item.product_name}
                          </span>
                          <Badge variant="outline" className={cn("text-[10px] h-5", config.badgeClass)}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>Batch #{item.batch_id}</span>
                          {item.batch_number && <span>• {item.batch_number}</span>}
                          {item.supplier_name && <span>• {item.supplier_name}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-medium">
                          {item.current_quantity} units
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {formatPeso(item.value_at_risk)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer with totals */}
        <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm">
              <span className="text-muted-foreground">Selected: </span>
              <span className="font-medium">{selectedBatchIds.size} batches</span>
              <span className="text-muted-foreground mx-2">•</span>
              <span className="font-mono font-medium">{totalUnits.toLocaleString()} units</span>
              <span className="text-muted-foreground mx-2">•</span>
              <span className="font-mono font-medium text-purple-700">{formatPeso(totalValue)}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isPending || selectedBatchIds.size === 0}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isPending ? (
                  "Processing..."
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirm Pickup
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
