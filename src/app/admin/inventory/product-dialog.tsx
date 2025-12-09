"use client";

import { useState, useTransition, useEffect } from "react";
import { Camera, X, Wand2 } from "lucide-react";
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
import { createProduct, updateProduct } from "@/actions/product";
import { uploadImage } from "@/actions/upload";
import { PRODUCT_CATEGORIES } from "@/lib/validations/product";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ImageUpload } from "@/components/ui/image-upload";
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
  const [stock, setStock] = useState("");
  const [reorderLevel, setReorderLevel] = useState("10");
  const [barcode, setBarcode] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Reset form when dialog opens/closes or product changes
  useEffect(() => {
    if (open) {
      if (product) {
        setProductName(product.product_name);
        setCategory(product.category);
        setRetailPrice(product.retail_price.toString());
        setWholesalePrice(product.wholesale_price.toString());
        setStock(product.current_stock.toString());
        setReorderLevel(product.reorder_level.toString());
        setBarcode(product.barcode || "");
        setImageUrl(product.image_url || null);
        setImageFile(null);
      } else {
        setProductName("");
        setCategory("");
        setRetailPrice("");
        setWholesalePrice("");
        setStock("");
        setReorderLevel("10");
        setBarcode("");
        setImageUrl(null);
        setImageFile(null);
      }
      setError(null);
    }
  }, [open, product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      // Handle image upload if a new file was chosen
      let imagePath: string | null = imageUrl || null;

      if (imageFile) {
        try {
          const upload = await uploadImage(imageFile);
          if (!upload.success || !upload.path) {
            setError(upload.error || "Failed to upload image");
            return;
          }
          imagePath = upload.path;
        } catch (err) {
          console.error("Upload image failed:", err);
          setError("Failed to upload image. Please try again.");
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
            current_stock: stockNum,
            reorder_level: reorderNum,
            barcode: barcode || null,
            image_url: imagePath,
            status: stockNum <= reorderNum ? "LOW_STOCK" : "IN_STOCK",
          });
          onOpenChange(false);
        } else {
          setError(result.error || "Failed to update product");
        }
      } else {
        const result = await createProduct({
          product_name: productName,
          category: category as typeof PRODUCT_CATEGORIES[number],
          retail_price: parseFloat(retailPrice),
          wholesale_price: parseFloat(wholesalePrice),
          initial_stock: parseInt(stock),
          reorder_level: parseInt(reorderLevel),
          barcode: barcode || null,
          image_url: imagePath,
        });

        if (result.success && result.data) {
          const data = result.data as { product_id: number };
          const stockNum = parseInt(stock);
          const reorderNum = parseInt(reorderLevel);
          onSuccess({
            product_id: data.product_id,
            product_name: productName,
            category,
            retail_price: parseFloat(retailPrice),
            wholesale_price: parseFloat(wholesalePrice),
            current_stock: stockNum,
            reorder_level: reorderNum,
            barcode: barcode || null,
            image_url: imagePath,
            status: stockNum <= reorderNum ? "LOW_STOCK" : "IN_STOCK",
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Product" : "Add New Product"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the product details below."
                : "Fill in the details to add a new product."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-4 py-4">
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
                      // Clear existing URL when a new file is chosen
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
                      // Generate internal barcode starting with '200' (reserved for in-store use)
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
                  <Label htmlFor="stock">
                    {isEditing ? "Current Stock" : "Initial Stock"}
                  </Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="0"
                    required
                    disabled={isPending}
                  />
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
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
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
          </form>
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
