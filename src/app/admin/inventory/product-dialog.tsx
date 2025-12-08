"use client";

import { useState, useTransition, useEffect } from "react";
import Image from "next/image";
import { Camera, ImageIcon, X, Wand2 } from "lucide-react";
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
import { PRODUCT_CATEGORIES } from "@/lib/validations/product";
import { BarcodeScanner } from "@/components/barcode-scanner";
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
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState(false);

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
        setImageUrl(product.image_url || "");
      } else {
        setProductName("");
        setCategory("");
        setRetailPrice("");
        setWholesalePrice("");
        setStock("");
        setReorderLevel("10");
        setBarcode("");
        setImageUrl("");
      }
      setError(null);
      setImageError(false);
    }
  }, [open, product]);

  // Reset image error when URL changes
  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
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
          image_url: imageUrl || null,
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
            image_url: imageUrl || null,
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
          image_url: imageUrl || null,
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
            image_url: imageUrl || null,
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

  const isValidImageUrl = imageUrl && !imageError;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-white dark:bg-[#1A1A1E] border-gray-200 dark:border-[#1F1F23]">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">
              {isEditing ? "Edit Product" : "Add New Product"}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              {isEditing
                ? "Update the product details below."
                : "Fill in the details to add a new product."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="grid gap-4 py-4">
              {/* Image URL with Preview */}
              <div className="grid gap-2">
                <Label htmlFor="image_url">Product Image URL</Label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      id="image_url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      disabled={isPending}
                    />
                  </div>
                  {imageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setImageUrl("")}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {/* Image Preview */}
                {imageUrl && (
                  <div className="mt-2 relative w-32 h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-[#1F1F23] bg-zinc-100 dark:bg-zinc-800">
                    {isValidImageUrl ? (
                      <Image
                        src={imageUrl}
                        alt="Product preview"
                        fill
                        className="object-cover"
                        onError={() => setImageError(true)}
                        unoptimized
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                        <ImageIcon className="h-8 w-8 mb-1" />
                        <span className="text-xs">Invalid URL</span>
                      </div>
                    )}
                  </div>
                )}
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
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
