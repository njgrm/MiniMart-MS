"use client";

import { useState, useTransition, useEffect } from "react";
import { ClipboardEdit, AlertTriangle, RotateCcw, Home, FileSearch } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { adjustStock } from "@/actions/inventory";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AdjustmentType = "ADJUSTMENT" | "DAMAGE" | "RETURN" | "INTERNAL_USE";

interface AdjustmentOption {
  value: AdjustmentType;
  label: string;
  icon: React.ElementType;
  description: string;
  isAddition: boolean;
}

const adjustmentOptions: AdjustmentOption[] = [
  {
    value: "DAMAGE",
    label: "Damage / Spoilage",
    icon: AlertTriangle,
    description: "Remove damaged or expired items",
    isAddition: false,
  },
  {
    value: "INTERNAL_USE",
    label: "Internal Use",
    icon: Home,
    description: "Used internally (not sold)",
    isAddition: false,
  },
  {
    value: "RETURN",
    label: "Customer Return",
    icon: RotateCcw,
    description: "Return items back to stock",
    isAddition: true,
  },
  {
    value: "ADJUSTMENT",
    label: "Audit Correction",
    icon: FileSearch,
    description: "Inventory count correction",
    isAddition: false,
  },
];

interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    product_id: number;
    product_name: string;
    current_stock: number;
  } | null;
  onSuccess?: (newStock: number) => void;
}

export function AdjustStockDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: AdjustStockDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("DAMAGE");
  const [quantity, setQuantity] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && product) {
      setAdjustmentType("DAMAGE");
      setQuantity("");
      setDirection("remove");
      setReason("");
      setReference("");
      setError(null);
    }
  }, [open, product]);

  // Update direction when adjustment type changes
  useEffect(() => {
    const option = adjustmentOptions.find((o) => o.value === adjustmentType);
    if (option) {
      setDirection(option.isAddition ? "add" : "remove");
    }
  }, [adjustmentType]);

  const isAdjustmentType = adjustmentType === "ADJUSTMENT";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!product) return;

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Please enter a valid quantity greater than 0");
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      setError("Please provide a reason for this adjustment (min 3 characters)");
      return;
    }

    const quantityChange = direction === "add" ? qty : -qty;
    const newStock = product.current_stock + quantityChange;
    if (newStock < 0) {
      setError(`Cannot remove ${qty} units. Current stock is only ${product.current_stock}`);
      return;
    }

    startTransition(async () => {
      const result = await adjustStock({
        productId: product.product_id,
        quantity: quantityChange,
        movementType: adjustmentType,
        reason: reason.trim(),
        reference: reference.trim() || undefined,
      });

      if (result.success) {
        const actionWord = direction === "add" ? "added" : "removed";
        toast.success(`Successfully ${actionWord} ${qty} units from ${product.product_name}`, {
          description: `New stock level: ${(result.data as { newStock: number }).newStock}`,
        });
        onSuccess?.((result.data as { newStock: number }).newStock);
        onOpenChange(false);
      } else {
        setError(result.error || "Failed to adjust stock");
      }
    });
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardEdit className="h-5 w-5 text-secondary" />
            Adjust Stock
          </DialogTitle>
          <DialogDescription>
            Adjusting inventory for <strong>{product.product_name}</strong> |  Current: <strong>{product.current_stock}</strong> units.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="adjust-form" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            {/* Adjustment Type */}
            <div className="space-y-2">
              <Label>Adjustment Type <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 gap-2">
                {adjustmentOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAdjustmentType(option.value)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border text-left transition-all",
                      adjustmentType === option.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <option.icon
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        adjustmentType === option.value
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{option.label}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {option.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Direction (only for ADJUSTMENT type) */}
            {isAdjustmentType && (
              <div className="space-y-2">
                <Label>Direction</Label>
                <RadioGroup
                  value={direction}
                  onValueChange={(val) => setDirection(val as "add" | "remove")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="remove" id="remove" />
                    <Label htmlFor="remove" className="cursor-pointer">
                      Remove from stock
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="add" id="add" />
                    <Label htmlFor="add" className="cursor-pointer">
                      Add to stock
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Quantity to {direction === "add" ? "Add" : "Remove"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g., 5"
                min="1"
                max={direction === "remove" ? product.current_stock : undefined}
                className="font-mono"
              />
              {direction === "remove" && (
                <p className="text-xs text-muted-foreground">
                  Maximum: {product.current_stock} units
                </p>
              )}
            </div>

            {/* Reason - Required */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                placeholder="Explain why this adjustment is being made..."
                rows={2}
              />
            </div>

            {/* Reference - Optional */}
            <div className="space-y-2">
              <Label htmlFor="reference">Reference # (Optional)</Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g., AUDIT-2025-001"
              />
            </div>

            {/* Preview */}
            <div className="bg-muted/50 rounded-lg p-3 border border-border">
              <p className="text-sm text-muted-foreground">
                After this adjustment:
              </p>
              <p className="text-lg font-semibold font-mono">
                {product.current_stock} {direction === "add" ? "+" : "−"}{" "}
                {quantity || "0"} ={" "}
                <span
                  className={cn(
                    parseInt(quantity || "0") > 0
                      ? direction === "add"
                        ? "text-green-600 dark:text-green-400"
                        : "text-destructive"
                      : ""
                  )}
                >
                  {Math.max(
                    0,
                    product.current_stock +
                      (direction === "add" ? 1 : -1) * parseInt(quantity || "0")
                  )}{" "}
                  units
                </span>
              </p>
            </div>
          </form>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30 flex-shrink-0">
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
            form="adjust-form"
            disabled={isPending}
            variant={direction === "remove" ? "destructive" : "default"}
          >
            {isPending
              ? "Processing..."
              : `${direction === "add" ? "Add" : "Remove"} ${quantity || "0"} Units`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
