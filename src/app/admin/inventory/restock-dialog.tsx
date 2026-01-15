"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { PackagePlus, Truck, DollarSign, Hash, FileText, Upload, X, ImageIcon, CalendarIcon, Plus, Building2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { restockProduct } from "@/actions/inventory";
import { uploadReceiptImage } from "@/actions/upload";
import { getSuppliersForSelect, createSupplier } from "@/actions/supplier";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RestockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    product_id: number;
    product_name: string;
    current_stock: number;
    cost_price?: number;
    nearest_expiry_date?: Date | string | null;
  } | null;
  onSuccess?: (newStock: number) => void;
}

export function RestockDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: RestockDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [quantity, setQuantity] = useState("");
  const [supplierId, setSupplierId] = useState<string>(""); // Store supplier ID or "new" for new supplier
  const [newSupplierName, setNewSupplierName] = useState(""); // For creating new supplier inline
  const [reference, setReference] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [reason, setReason] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [newExpiryDate, setNewExpiryDate] = useState<Date | undefined>(undefined);

  // Suppliers list
  const [suppliers, setSuppliers] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // Fetch suppliers on dialog open
  useEffect(() => {
    if (open) {
      setLoadingSuppliers(true);
      getSuppliersForSelect().then((result) => {
        if (result.success && result.data) {
          setSuppliers(result.data);
        }
        setLoadingSuppliers(false);
      });
    }
  }, [open]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && product) {
      setQuantity("");
      setSupplierId("");
      setNewSupplierName("");
      setReference("");
      setCostPrice(product.cost_price?.toString() || "");
      setReason("");
      setReceiptFile(null);
      setReceiptPreview(null);
      setNewExpiryDate(undefined);
      setError(null);
    }
  }, [open, product]);

  // Handle receipt file selection
  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      // Create preview URL
      const url = URL.createObjectURL(file);
      setReceiptPreview(url);
    }
  };

  const clearReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!product) return;

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Please enter a valid quantity greater than 0");
      return;
    }

    startTransition(async () => {
      // Upload receipt image if provided (raw, no AI processing)
      let receiptImageUrl: string | undefined;
      if (receiptFile) {
        try {
          const uploadResult = await uploadReceiptImage(receiptFile);
          if (uploadResult.success && uploadResult.path) {
            receiptImageUrl = uploadResult.path;
          }
        } catch (err) {
          console.error("Receipt upload failed:", err);
          // Non-blocking - continue without receipt
        }
      }

      // Determine supplier name - either from selected supplier or new one
      let finalSupplierName: string | undefined;
      let finalSupplierId: number | undefined;

      if (supplierId === "new" && newSupplierName.trim()) {
        // Create new supplier first
        const newSupplierResult = await createSupplier({ name: newSupplierName.trim() });
        if (newSupplierResult.success && newSupplierResult.data) {
          finalSupplierName = newSupplierResult.data.name;
          finalSupplierId = newSupplierResult.data.id;
          // Add to local list for future use
          setSuppliers(prev => [...prev, { id: newSupplierResult.data!.id, name: newSupplierResult.data!.name }]);
        } else {
          // Still use the name even if creation failed
          finalSupplierName = newSupplierName.trim();
        }
      } else if (supplierId && supplierId !== "new") {
        const selected = suppliers.find(s => s.id === parseInt(supplierId));
        if (selected) {
          finalSupplierName = selected.name;
          finalSupplierId = selected.id;
        }
      }

      const result = await restockProduct({
        productId: product.product_id,
        quantity: qty,
        supplierName: finalSupplierName,
        supplierId: finalSupplierId,
        reference: reference.trim() || undefined,
        costPrice: costPrice ? parseFloat(costPrice) : undefined,
        reason: reason.trim() || undefined,
        receiptImageUrl,
        newExpiryDate: newExpiryDate || undefined,
      });

      if (result.success) {
        toast.success(`Successfully added ${qty} units to ${product.product_name}`, {
          description: `New stock level: ${(result.data as { newStock: number }).newStock}`,
        });
        onSuccess?.((result.data as { newStock: number }).newStock);
        onOpenChange(false);
      } else {
        setError(result.error || "Failed to restock product");
      }
    });
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-3 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            Restock Product
          </DialogTitle>
          <DialogDescription>
            Adding stock for <strong>{product.product_name}</strong> | Current: <strong>{product.current_stock}</strong> units.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="restock-form" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            {/* Quantity - Required */}
            <div className="space-y-2">
              <Label htmlFor="quantity" className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" />
                Quantity to Add <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g., 50"
                min="1"
                className="font-mono"
                autoFocus
              />
            </div>

            {/* Supplier - Dropdown with create option */}
            <div className="space-y-2">
              <Label htmlFor="supplier" className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Supplier
              </Label>
              <Select
                value={supplierId}
                onValueChange={setSupplierId}
                disabled={loadingSuppliers}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingSuppliers ? "Loading suppliers..." : "Select supplier"} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new" className="text-primary">
                    <span className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Add New Supplier
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {supplierId === "new" && (
                <Input
                  placeholder="Enter new supplier name"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            {/* Reference Number - Optional */}
            <div className="space-y-2">
              <Label htmlFor="reference" className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Reference / Invoice #
              </Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g., INV-2025-001"
              />
            </div>

            {/* Cost Price - Optional */}
            <div className="space-y-2">
              <Label htmlFor="costPrice" className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Cost Price (per unit)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  ₱
                </span>
                <Input
                  id="costPrice"
                  type="number"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="Leave empty to keep current"
                  min="0"
                  step="0.01"
                  className="pl-7 font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This will update the product&apos;s cost price for future profit calculations
              </p>
            </div>

            {/* New Expiry Date - Optional */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                Batch Expiry Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newExpiryDate && "text-muted-foreground"
                    )}
                    type="button"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newExpiryDate ? format(newExpiryDate, "PPP") : "Select expiry date for this batch"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newExpiryDate}
                    onSelect={setNewExpiryDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                This creates a new batch. Stock is auto-deducted from oldest-expiring batches first (FEFO).
              </p>
            </div>

            {/* Receipt Image Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                Receipt Image (Optional)
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleReceiptChange}
                className="hidden"
              />
              {receiptPreview ? (
                <div className="relative rounded-lg border border-border overflow-hidden">
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="w-full h-32 object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={clearReceipt}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "w-full h-24 border-2 border-dashed border-border rounded-lg",
                    "flex flex-col items-center justify-center gap-2",
                    "text-muted-foreground hover:border-primary/50 hover:bg-muted/50 transition-colors"
                  )}
                >
                  <Upload className="h-6 w-6" />
                  <span className="text-xs">Click to upload receipt</span>
                </button>
              )}
              <p className="text-xs text-muted-foreground">
                Attach supplier invoice or delivery receipt (uploaded as-is, no processing)
              </p>
            </div>

            {/* Reason/Notes - Optional */}
            <div className="space-y-2">
              <Label htmlFor="reason">Notes (Optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                placeholder="Any additional notes about this restock..."
                rows={2}
              />
            </div>
          </form>
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/30 flex-shrink-0">
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
            form="restock-form"
            disabled={isPending}
          >
            {isPending ? "Processing..." : `Add ${quantity || "0"} Units`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
