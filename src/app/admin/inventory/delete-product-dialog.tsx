"use client";

import { useState, useTransition } from "react";
import { Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteProduct, restoreProduct } from "@/actions/product";
import type { ProductData } from "./inventory-client";

// =============================================================================
// Archive Product Dialog
// =============================================================================

interface ArchiveProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductData | null;
  onSuccess: () => void;
}

export function ArchiveProductDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: ArchiveProductDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleArchive = () => {
    if (!product) return;
    setError(null);

    startTransition(async () => {
      const result = await deleteProduct(product.product_id);

      if (result.success) {
        onSuccess();
        onOpenChange(false);
      } else {
        setError(result.error || "Failed to archive product");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20">
              <Archive className="h-5 w-5 text-warning" />
            </div>
            <div>
              <DialogTitle>Archive Product</DialogTitle>
              <DialogDescription>
                This product will be moved to the archive.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to archive{" "}
            <span className="font-semibold text-foreground">{product?.product_name}</span>?
          </p>
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground">What happens when you archive:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Product will be hidden from inventory and POS</li>
              <li>Sales history and reports are preserved</li>
              <li>Barcode/SKU will be freed for reuse</li>
              <li>You can restore this product anytime</li>
            </ul>
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
          <Button
            type="button"
            variant="warning"
            onClick={handleArchive}
            disabled={isPending}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Archiving...
              </span>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" />
                Archive Product
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Restore Product Dialog
// =============================================================================

export interface ArchivedProduct {
  product_id: number;
  product_name: string;
  archived_name: string;
  category: string;
  retail_price: number;
  wholesale_price: number;
  cost_price: number;
  barcode: string | null;
  image_url: string | null;
  deletedAt: Date | null;
  current_stock: number;
}

interface RestoreProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ArchivedProduct | null;
  onSuccess: () => void;
}

export function RestoreProductDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: RestoreProductDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleRestore = () => {
    if (!product) return;
    setError(null);

    startTransition(async () => {
      const result = await restoreProduct(product.product_id);

      if (result.success) {
        onSuccess();
        onOpenChange(false);
      } else {
        setError(result.error || "Failed to restore product");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
              <RotateCcw className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <DialogTitle>Restore Product</DialogTitle>
              <DialogDescription>
                Bring this product back to active inventory.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Restore{" "}
            <span className="font-semibold text-foreground">{product?.product_name}</span>{" "}
            back to active inventory?
          </p>
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground">What happens when you restore:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Product will appear in inventory and POS</li>
              <li>Original barcode/SKU will be restored</li>
              <li>Stock levels remain as they were</li>
            </ul>
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
          <Button
            type="button"
            variant="default"
            className="bg-green-600 hover:bg-green-700"
            onClick={handleRestore}
            disabled={isPending}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Restoring...
              </span>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore Product
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Keep backwards compatibility with old name
// =============================================================================

/** @deprecated Use ArchiveProductDialog instead */
export const DeleteProductDialog = ArchiveProductDialog;


