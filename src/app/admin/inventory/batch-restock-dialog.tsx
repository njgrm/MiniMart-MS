"use client";

import { useState, useTransition, useRef, useMemo } from "react";
import Image from "next/image";
import { 
  PackagePlus, 
  Truck, 
  Upload, 
  X, 
  ImageIcon, 
  CalendarIcon,
  Search,
  Plus,
  Minus,
  Trash2,
  Package,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { batchRestockProducts } from "@/actions/inventory";
import { uploadReceiptImage } from "@/actions/upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ProductData, SupplierOption } from "./inventory-client";

interface BatchRestockItem {
  product_id: number;
  product_name: string;
  current_stock: number;
  quantity: number;
  cost_price?: number;
  expiry_date?: Date;
  image_url?: string | null;
}

interface BatchRestockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductData[];
  suppliers: SupplierOption[];
  onSuccess?: () => void;
}

export function BatchRestockDialog({
  open,
  onOpenChange,
  products,
  suppliers,
  onSuccess,
}: BatchRestockDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collapsible states
  const [deliveryInfoOpen, setDeliveryInfoOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);

  // Confirmation dialog
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Delivery info (shared across all items)
  const [supplierId, setSupplierId] = useState<string>("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  // Get supplier name for display/submission
  const supplierName = useMemo(() => {
    if (supplierId === "new") return newSupplierName.trim();
    if (supplierId) {
      const supplier = suppliers.find(s => s.id === parseInt(supplierId));
      return supplier?.name || "";
    }
    return "";
  }, [supplierId, newSupplierName, suppliers]);

  // Items to restock
  const [items, setItems] = useState<BatchRestockItem[]>([]);
  
  // Product search
  const [searchQuery, setSearchQuery] = useState("");

  // Reset form when dialog opens
  const resetForm = () => {
    setSupplierId("");
    setNewSupplierName("");
    setReference("");
    setReason("");
    setReceiptFile(null);
    setReceiptPreview(null);
    setItems([]);
    setSearchQuery("");
    setError(null);
    setDeliveryInfoOpen(true);
    setNotesOpen(false);
    setShowConfirmation(false);
  };

  // Filter products for search (exclude already added)
  const availableProducts = useMemo(() => {
    const addedIds = new Set(items.map(i => i.product_id));
    return products.filter(p => !addedIds.has(p.product_id));
  }, [products, items]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return availableProducts.slice(0, 50);
    const query = searchQuery.toLowerCase();
    return availableProducts
      .filter(p => 
        p.product_name.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query)
      )
      .slice(0, 50);
  }, [availableProducts, searchQuery]);

  // Add product to batch
  const addProduct = (product: ProductData) => {
    setItems(prev => [...prev, {
      product_id: product.product_id,
      product_name: product.product_name,
      current_stock: product.current_stock,
      quantity: 1,
      cost_price: product.cost_price,
      expiry_date: undefined,
      image_url: product.image_url,
    }]);
  };

  // Remove product from batch
  const removeProduct = (productId: number) => {
    setItems(prev => prev.filter(i => i.product_id !== productId));
  };

  // Update item quantity
  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) return;
    setItems(prev => prev.map(i => 
      i.product_id === productId ? { ...i, quantity } : i
    ));
  };

  // Update item cost price
  const updateCostPrice = (productId: number, costPrice: number | undefined) => {
    setItems(prev => prev.map(i => 
      i.product_id === productId ? { ...i, cost_price: costPrice } : i
    ));
  };

  // Update item expiry date
  const updateExpiryDate = (productId: number, expiryDate: Date | undefined) => {
    setItems(prev => prev.map(i => 
      i.product_id === productId ? { ...i, expiry_date: expiryDate } : i
    ));
  };

  // Handle receipt file
  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
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

  // Calculate totals
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalCost = items.reduce((sum, i) => sum + (i.quantity * (i.cost_price || 0)), 0);

  // Validate and show confirmation
  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (items.length === 0) {
      setError("Please add at least one product to restock");
      return;
    }

    // Validate all items have valid quantities
    const invalidItems = items.filter(i => i.quantity <= 0);
    if (invalidItems.length > 0) {
      setError("All items must have a quantity greater than 0");
      return;
    }

    // Show confirmation dialog
    setShowConfirmation(true);
  };

  // Actual submission after confirmation
  const handleConfirmedSubmit = async () => {
    setShowConfirmation(false);

    startTransition(async () => {
      // Upload receipt image if provided
      let receiptImageUrl: string | undefined;
      if (receiptFile) {
        try {
          const uploadResult = await uploadReceiptImage(receiptFile);
          if (uploadResult.success && uploadResult.path) {
            receiptImageUrl = uploadResult.path;
          }
        } catch (err) {
          console.error("Receipt upload failed:", err);
          // Continue without receipt
        }
      }

      const result = await batchRestockProducts({
        items: items.map(item => ({
          productId: item.product_id,
          quantity: item.quantity,
          costPrice: item.cost_price,
          newExpiryDate: item.expiry_date,
        })),
        supplierName: supplierName.trim() || undefined,
        reference: reference.trim() || undefined,
        reason: reason.trim() || undefined,
        receiptImageUrl,
      });

      if (result.success) {
        const successCount = result.data?.results?.filter((r: { success: boolean }) => r.success).length ?? items.length;
        toast.success(`Batch restock completed`, {
          description: `Successfully restocked ${successCount} products (${totalUnits} total units)`,
        });
        onSuccess?.();
        onOpenChange(false);
        resetForm();
      } else {
        setError(result.error || "Failed to process batch restock");
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(newOpen) => {
        if (!newOpen) resetForm();
        onOpenChange(newOpen);
      }}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <PackagePlus className="h-5 w-5 text-primary" />
              Batch Restock - Supplier Delivery
            </DialogTitle>
            <DialogDescription>
              Add multiple products from a single supplier delivery. All items share the same receipt/invoice.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mx-6 mt-4 bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form id="batch-restock-form" onSubmit={handlePreSubmit} className="flex-1 flex overflow-hidden">
            {/* LEFT PANEL: Product Search & Selection */}
            <div className="w-[380px] flex-shrink-0 border-r flex flex-col bg-muted/20">
              {/* Search Header */}
              <div className="p-4 border-b space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  Find Products
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Product List - Scrollable */}
              <div className="flex-1 overflow-y-auto p-2">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No products found</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.product_id}
                        type="button"
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors text-left group"
                        onClick={() => addProduct(product)}
                      >
                        {/* Product Image */}
                        <div className="h-10 w-10 rounded-md bg-muted flex-shrink-0 overflow-hidden border">
                          {product.image_url ? (
                            <Image
                              src={product.image_url}
                              alt={product.product_name}
                              width={40}
                              height={40}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.product_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Stock: {product.current_stock} • {product.barcode || "No barcode"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {product.velocity_status === "OUT_OF_STOCK" && (
                            <Badge variant="destructive" className="text-[10px]">Out</Badge>
                          )}
                          {product.velocity_status === "CRITICAL" && (
                            <Badge className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">Critical</Badge>
                          )}
                          {product.velocity_status === "LOW" && (
                            <Badge variant="secondary" className="text-[10px]">Low</Badge>
                          )}
                          <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANEL: Delivery Info & Cart */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Collapsible Delivery Info Section */}
              <Collapsible 
                open={deliveryInfoOpen} 
                onOpenChange={setDeliveryInfoOpen}
                className="flex-shrink-0 border-b"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center justify-between bg-card hover:bg-muted/50 transition-colors"
                  >
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      Delivery Information
                      {(supplierName || reference || receiptPreview) && (
                        <Badge variant="secondary" className="text-[10px] ml-2">Filled</Badge>
                      )}
                    </h3>
                    {deliveryInfoOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 pt-2 bg-card space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className={`space-y-1.5 ${supplierId === "new" ? "col-span-2" : ""}`}>
                        <Label htmlFor="supplier" className="text-xs">Supplier</Label>
                        <div className="flex gap-2">
                          <Select value={supplierId} onValueChange={setSupplierId}>
                            <SelectTrigger className="h-9 flex-1">
                              <SelectValue placeholder="Select supplier..." />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map((s) => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                  {s.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="new" className="text-primary font-medium">
                                + Add New Supplier
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {supplierId === "new" && (
                            <Input
                              value={newSupplierName}
                              onChange={(e) => setNewSupplierName(e.target.value)}
                              placeholder="New supplier name..."
                              className="h-9 flex-1"
                              autoFocus
                            />
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="reference" className="text-xs">Invoice / Reference #</Label>
                        <Input
                          id="reference"
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          placeholder="e.g., INV-2026-001"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          Receipt Image
                        </Label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptChange}
                          className="hidden"
                        />
                        {receiptPreview ? (
                          <div className="relative rounded-md border border-border overflow-hidden inline-flex h-9">
                            <img
                              src={receiptPreview}
                              alt="Receipt preview"
                              className="h-full w-auto object-cover"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute top-0.5 right-0.5 h-4 w-4"
                              onClick={clearReceipt}
                            >
                              <X className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="gap-1.5 h-9"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Upload
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Items Cart Section - Scrollable */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/30 flex-shrink-0">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    Products to Restock ({items.length})
                  </h3>
                  {items.length > 0 && (
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{totalUnits}</span> total units
                      </span>
                      {totalCost > 0 && (
                        <span className="text-muted-foreground">
                          Est. <span className="font-medium font-mono text-foreground">₱{totalCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-4">
                  {items.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <Package className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <p className="text-base font-medium">No products added yet</p>
                      <p className="text-sm mt-1">Select products from the left panel to add them</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div 
                          key={item.product_id}
                          className="border rounded-lg p-4 bg-card shadow-sm"
                        >
                          <div className="flex items-start gap-4 mb-4">
                            {/* Product Image */}
                            <div className="h-14 w-14 rounded-lg bg-muted flex-shrink-0 overflow-hidden border">
                              {item.image_url ? (
                                <Image
                                  src={item.image_url}
                                  alt={item.product_name}
                                  width={56}
                                  height={56}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <Package className="h-6 w-6 text-muted-foreground/50" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-base truncate">{item.product_name}</p>
                              <p className="text-sm text-muted-foreground">Current stock: {item.current_stock} units</p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                              onClick={() => removeProduct(item.product_id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            {/* Quantity */}
                            <div className="space-y-2">
                              <Label className="text-xs font-medium">Quantity *</Label>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-10 w-10"
                                  onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 1)}
                                  className="h-10 w-20 text-center font-mono text-base"
                                  min="1"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-10 w-10"
                                  onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Cost Price */}
                            <div className="space-y-2">
                              <Label className="text-xs font-medium">Cost/Unit (₱)</Label>
                              <Input
                                type="number"
                                value={item.cost_price ?? ""}
                                onChange={(e) => updateCostPrice(item.product_id, e.target.value ? parseFloat(e.target.value) : undefined)}
                                className="h-10 font-mono"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                              />
                            </div>

                            {/* Expiry Date */}
                            <div className="space-y-2">
                              <Label className="text-xs font-medium">Expiry Date</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "h-10 w-full justify-start text-left font-normal",
                                      !item.expiry_date && "text-muted-foreground"
                                    )}
                                    type="button"
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {item.expiry_date ? format(item.expiry_date, "MMM d, yyyy") : "Select date"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={item.expiry_date}
                                    onSelect={(date) => updateExpiryDate(item.product_id, date)}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>

                          {/* Line total */}
                          {item.cost_price && item.cost_price > 0 && (
                            <div className="mt-3 pt-3 border-t text-sm text-right">
                              <span className="text-muted-foreground">Line Total: </span>
                              <span className="font-medium font-mono">₱{(item.quantity * item.cost_price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Collapsible Notes Section */}
                {items.length > 0 && (
                  <Collapsible 
                    open={notesOpen} 
                    onOpenChange={setNotesOpen}
                    className="flex-shrink-0 border-t"
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="w-full px-4 py-2.5 flex items-center justify-between bg-muted/20 hover:bg-muted/40 transition-colors"
                      >
                        <span className="text-xs font-medium flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          Notes (Optional)
                          {reason && (
                            <Badge variant="secondary" className="text-[10px]">Added</Badge>
                          )}
                        </span>
                        {notesOpen ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-2 bg-muted/20">
                        <Textarea
                          id="reason"
                          value={reason}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                          placeholder="Any additional notes about this delivery..."
                          rows={2}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-end gap-3 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              form="batch-restock-form"
              disabled={isPending || items.length === 0}
              className="gap-2 min-w-[160px]"
            >
              {isPending ? (
                "Processing..."
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Restock {items.length} Product{items.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Confirm Batch Restock
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>You are about to restock the following:</p>
                
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Products:</span>
                    <span className="font-medium">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Units:</span>
                    <span className="font-medium">{totalUnits} units</span>
                  </div>
                  {totalCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Est. Cost:</span>
                      <span className="font-medium font-mono">₱{totalCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {supplierName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Supplier:</span>
                      <span className="font-medium">{supplierName}</span>
                    </div>
                  )}
                  {reference && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Reference:</span>
                      <span className="font-medium">{reference}</span>
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    This action will update inventory levels
                  </p>
                  <p className="mt-1 text-amber-700 dark:text-amber-300">
                    Please verify the quantities and details before proceeding. This operation cannot be easily undone.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedSubmit}
              disabled={isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {isPending ? "Processing..." : "Confirm Restock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
