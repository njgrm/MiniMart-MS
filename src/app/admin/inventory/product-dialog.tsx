"use client";

import { useState, useTransition, useEffect } from "react";
import { Camera, X, Wand2, Truck, FileText, ImageIcon, CalendarIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { createProduct, updateProduct } from "@/actions/product";
import { uploadImage, uploadImageRaw } from "@/actions/upload";
import { PRODUCT_CATEGORIES } from "@/lib/validations/product";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ImageUpload } from "@/components/ui/image-upload";
import { cn } from "@/lib/utils";
import type { ProductData } from "./inventory-client";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductData | null;
  onSuccess: (product: ProductData) => void;
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: ProductDialogProps) {
  const isEditing = !!product;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Form state
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [retailPrice, setRetailPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("");
  const [reorderLevel, setReorderLevel] = useState("10");
  const [barcode, setBarcode] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Stock movement tracking (for new products only)
  const [supplierName, setSupplierName] = useState("");
  const [reference, setReference] = useState("");
  const [receiptImageFile, setReceiptImageFile] = useState<File | null>(null);
  const [receiptImagePreview, setReceiptImagePreview] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);

  // Reset form when dialog opens/closes or product changes
  useEffect(() => {
    if (open) {
      if (product) {
        setProductName(product.product_name);
        setCategory(product.category);
        setRetailPrice(product.retail_price.toString());
        setWholesalePrice(product.wholesale_price.toString());
        setCostPrice((product as any).cost_price?.toString() || "0.00");
        setStock(product.current_stock.toString());
        setReorderLevel(product.reorder_level.toString());
        setBarcode(product.barcode || "");
        setImageUrl(product.image_url || null);
        setImageFile(null);
        // Clear stock movement fields (not applicable when editing)
        setSupplierName("");
        setReference("");
        setReceiptImageFile(null);
        setReceiptImagePreview(null);
      } else {
        setProductName("");
        setCategory("");
        setRetailPrice("");
        setWholesalePrice("");
        setCostPrice("");
        setStock("");
        setReorderLevel("10");
        setBarcode("");
        setImageUrl(null);
        setImageFile(null);
        setSupplierName("");
        setReference("");
        setReceiptImageFile(null);
        setReceiptImagePreview(null);
        setExpiryDate(undefined);
      }
      setError(null);
    }
  }, [open, product]);

  // Handle receipt image selection
  const handleReceiptImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate stock source fields when creating new product
    if (!isEditing) {
      if (!supplierName.trim()) {
        setError("Supplier name is required");
        return;
      }
      if (!reference.trim()) {
        setError("Receipt/Reference number is required");
        return;
      }
    }

    startTransition(async () => {
      // Handle product image upload (with AI background removal)
      let imagePath: string | null = imageUrl || null;
      if (imageFile) {
        try {
          const upload = await uploadImage(imageFile);
          if (!upload.success || !upload.path) {
            setError(upload.error || "Failed to upload product image");
            return;
          }
          imagePath = upload.path;
        } catch (err) {
          console.error("Upload image failed:", err);
          setError("Failed to upload product image. Please try again.");
          return;
        }
      }

      // Handle receipt image upload (raw, no AI processing)
      let receiptImagePath: string | null = null;
      if (!isEditing && receiptImageFile) {
        try {
          const upload = await uploadImageRaw(receiptImageFile);
          if (!upload.success || !upload.path) {
            setError(upload.error || "Failed to upload receipt image");
            return;
          }
          receiptImagePath = upload.path;
        } catch (err) {
          console.error("Upload receipt image failed:", err);
          setError("Failed to upload receipt image. Please try again.");
          return;
        }
      }

      if (isEditing && product) {
        const result = await updateProduct({
          product_id: product.product_id,
          product_name: productName,
          category: category as typeof PRODUCT_CATEGORIES[number],
          retail_price: parseFloat(retailPrice),
          wholesale_price: parseFloat(wholesalePrice),
          cost_price: parseFloat(costPrice || "0"),
          current_stock: parseInt(stock),
          reorder_level: parseInt(reorderLevel),
          barcode: barcode || null,
          image_url: imagePath,
        });

        if (result.success) {
          const stockNum = parseInt(stock);
          const reorderNum = parseInt(reorderLevel);
          onSuccess({
            product_id: product.product_id,
            product_name: productName,
            category,
            retail_price: parseFloat(retailPrice),
            wholesale_price: parseFloat(wholesalePrice),
            cost_price: parseFloat(costPrice || "0"),
            current_stock: stockNum,
            reorder_level: reorderNum,
            auto_reorder: true, // Default value for existing products
            lead_time_days: 7,  // Default value
            barcode: barcode || null,
            image_url: imagePath,
            status: stockNum <= reorderNum ? "LOW_STOCK" : "IN_STOCK",
            nearest_expiry_date: product.nearest_expiry_date || null,
          });
          onOpenChange(false);
        } else {
          setError(result.error || "Failed to update product");
        }
      } else {
        // Create product with stock movement tracking
        const result = await createProduct({
          product_name: productName,
          category: category as typeof PRODUCT_CATEGORIES[number],
          retail_price: parseFloat(retailPrice),
          wholesale_price: parseFloat(wholesalePrice),
          cost_price: parseFloat(costPrice || "0"),
          initial_stock: parseInt(stock || "0"),
          reorder_level: parseInt(reorderLevel),
          barcode: barcode || null,
          image_url: imagePath,
          // Stock movement tracking
          supplier_name: supplierName || null,
          reference: reference || null,
          receipt_image_url: receiptImagePath,
          // Expiry date for initial stock
          expiry_date: expiryDate || null,
        });

        if (result.success && result.data) {
          const data = result.data as { product_id: number };
          const stockNum = parseInt(stock || "0");
          const reorderNum = parseInt(reorderLevel);
          onSuccess({
            product_id: data.product_id,
            product_name: productName,
            category,
            retail_price: parseFloat(retailPrice),
            wholesale_price: parseFloat(wholesalePrice),
            cost_price: parseFloat(costPrice || "0"),
            current_stock: stockNum,
            reorder_level: reorderNum,
            auto_reorder: true, // Default for new products
            lead_time_days: 7,  // Default value
            barcode: barcode || null,
            image_url: imagePath,
            status: stockNum <= reorderNum ? "LOW_STOCK" : "IN_STOCK",
            nearest_expiry_date: expiryDate || null,
          });
          onOpenChange(false);
        } else {
          setError(result.error || "Failed to create product");
        }
      }
    });
  };

  const handleBarcodeScanned = (scannedBarcode: string) => {
    setBarcode(scannedBarcode);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[650px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* Pinned Header */}
          <DialogHeader className="px-6 py-3 border-b flex-shrink-0">
            <DialogTitle>
              {isEditing ? "Edit Product" : "Add New Product"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the product details below."
                : "Fill in the details to add a new product. Stock movement will be recorded."}
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <form id="product-form" onSubmit={handleSubmit}>
              {error && (
                <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="grid gap-4">
                {/* Image Upload */}
                <div className="grid gap-2">
                  <Label>Product Image</Label>
                  <ImageUpload
                    value={imageUrl || undefined}
                    onChange={(file) => {
                      setImageFile(file);
                      if (!file) {
                        setImageUrl(null);
                      } else {
                        setImageUrl(null);
                      }
                    }}
                    disabled={isPending}
                  />
                </div>

                {/* Barcode with Scanner and Generator */}
                <div className="grid gap-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <div className="flex gap-2">
                    <Input
                      id="barcode"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="e.g., 4800016123456"
                      disabled={isPending}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsScannerOpen(true)}
                      disabled={isPending}
                      className="shrink-0"
                      title="Scan barcode with camera"
                    >
                      <Camera className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Scan</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const generated = "200" + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
                        setBarcode(generated);
                      }}
                      disabled={isPending}
                      className="shrink-0"
                      title="Generate internal barcode"
                    >
                      <Wand2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Generate</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scan retail products or generate for custom bundles
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="product_name">Product Name</Label>
                  <Input
                    id="product_name"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g., Coca-Cola 350ml"
                    required
                    disabled={isPending}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={category}
                    onValueChange={setCategory}
                    required
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat.replace("_", " ").charAt(0) +
                            cat.replace("_", " ").slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="retail_price">Retail Price (₱)</Label>
                    <Input
                      id="retail_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={retailPrice}
                      onChange={(e) => setRetailPrice(e.target.value)}
                      placeholder="0.00"
                      required
                      disabled={isPending}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="wholesale_price">Wholesale Price (₱)</Label>
                    <Input
                      id="wholesale_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={wholesalePrice}
                      onChange={(e) => setWholesalePrice(e.target.value)}
                      placeholder="0.00"
                      required
                      disabled={isPending}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="cost_price">Cost Price (₱) *</Label>
                    <Input
                      id="cost_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder="0.00"
                      required
                      disabled={isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      Supply cost from suppliers
                    </p>
                  </div>
                  <div></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="stock">
                      {isEditing ? "Current Stock" : "Initial Stock"}
                    </Label>
                    <Input
                      id="stock"
                      type="number"
                      min="0"
                      value={stock}
                      onChange={(e) => !isEditing && setStock(e.target.value)}
                      placeholder="0"
                      required
                      disabled={isPending || isEditing}
                      className={isEditing ? "bg-muted cursor-not-allowed" : ""}
                    />
                    {isEditing && (
                      <p className="text-xs text-muted-foreground">
                        Use <strong>Restock</strong> or <strong>Adjust Stock</strong> from the table menu to modify stock levels
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="reorder_level">Reorder Level</Label>
                    <Input
                      id="reorder_level"
                      type="number"
                      min="0"
                      value={reorderLevel}
                      onChange={(e) => setReorderLevel(e.target.value)}
                      placeholder="10"
                      required
                      disabled={isPending}
                    />
                  </div>
                </div>

                {/* Expiry Date - Only shown when creating new product */}
                {!isEditing && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Expiry Date (Initial Stock)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !expiryDate && "text-muted-foreground"
                            )}
                            disabled={isPending}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {expiryDate ? format(expiryDate, "PPP") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={expiryDate}
                            onSelect={setExpiryDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground">
                        Optional: Track expiry for perishable goods
                      </p>
                    </div>
                    <div></div>
                  </div>
                )}

                {/* Stock Movement Tracking - Shown when creating new product */}
                {!isEditing && (
                  <>
                    <Separator className="my-2" />
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Truck className="h-4 w-4" />
                        Stock Source <span className="text-destructive">*</span>
                      </div>
                      <p className="text-xs text-muted-foreground -mt-2">
                        Required: Track where your stock came from for audit purposes.
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="supplier_name">
                            Supplier Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="supplier_name"
                            value={supplierName}
                            onChange={(e) => setSupplierName(e.target.value)}
                            placeholder="e.g., ABC Distributors"
                            disabled={isPending}
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="reference">
                            Receipt/Reference # <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="reference"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder="e.g., INV-2024-001"
                            disabled={isPending}
                            required
                          />
                        </div>
                      </div>

                      {/* Receipt Image Upload - Using ImageUpload style */}
                      <div className="grid gap-2">
                        <Label>Receipt Image (Optional)</Label>
                        <div
                          className={`
                            relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden
                            min-h-[120px]
                            ${receiptImagePreview 
                              ? "border-solid border-border" 
                              : "bg-muted/30 border-border hover:bg-muted/50 hover:border-primary/50"
                            }
                            ${isPending ? "opacity-50 cursor-not-allowed" : ""}
                          `}
                          onClick={() => !isPending && document.getElementById("receipt_image")?.click()}
                        >
                          <input
                            type="file"
                            id="receipt_image"
                            accept="image/*"
                            className="hidden"
                            onChange={handleReceiptImageChange}
                            disabled={isPending}
                          />

                          {receiptImagePreview ? (
                            <div className="relative w-full h-full min-h-[120px] flex items-center justify-center p-2">
                              <div className="relative w-full h-28 rounded-md overflow-hidden bg-muted">
                                <img
                                  src={receiptImagePreview}
                                  alt="Receipt preview"
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              {!isPending && (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-warm-md"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReceiptImageFile(null);
                                    setReceiptImagePreview(null);
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-4 px-4 text-center">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full mb-2 bg-muted text-muted-foreground">
                                <ImageIcon className="h-5 w-5" />
                              </div>
                              <p className="text-sm font-medium mb-1 text-foreground">
                                Upload receipt image
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Drag & drop or click to browse
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </form>
          </div>

          {/* Pinned Footer */}
          <DialogFooter className="px-6 py-3 border-t bg-muted/30 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" form="product-form" disabled={isPending}>
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {isEditing ? "Saving..." : "Creating..."}
                </span>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Add Product"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScan={handleBarcodeScanned}
      />
    </>
  );
}
