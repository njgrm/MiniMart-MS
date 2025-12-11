"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { getUnitDisplayPrice, usePosStore, type PosProduct } from "@/stores/use-pos-store";

interface Props {
  product: PosProduct;
  onClick: () => void;
}

/**
 * Stock status indicator colors (matching inventory theming):
 * - In Stock (> reorder level): Teal (#2EAFC5)
 * - Low Stock (<= reorder level): Orange/Secondary (#F1782F)
 * - Out of Stock (0): Destructive Red (#EF4444)
 */
type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

function getStockStatus(stock: number, reorderLevel: number): StockStatus {
  if (stock <= 0) return "out_of_stock";
  if (stock <= reorderLevel) return "low_stock";
  return "in_stock";
}

const stockStyles: Record<StockStatus, { bg: string; text: string; label: string }> = {
  in_stock: {
    bg: "bg-[#2EAFC5]", // Teal
    text: "text-white",
    label: "", // Will show stock count
  },
  low_stock: {
    bg: "bg-secondary", // Orange (#F1782F)
    text: "text-secondary-foreground",
    label: "Low",
  },
  out_of_stock: {
    bg: "bg-destructive", // Red (#EF4444)
    text: "text-destructive-foreground",
    label: "Out",
  },
};

export function ProductCard({ product, onClick }: Props) {
  const { customerType } = usePosStore();
  const stock = product.current_stock ?? 0;
  const reorderLevel = product.reorder_level ?? 10;
  const stockStatus = getStockStatus(stock, reorderLevel);
  const isOutOfStock = stockStatus === "out_of_stock";
  const unitPrice = getUnitDisplayPrice(product, customerType);
  const style = stockStyles[stockStatus];

  return (
    <button
      type="button"
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-[0.98]",
        isOutOfStock && "opacity-50 pointer-events-none grayscale"
      )}
      onClick={onClick}
      disabled={isOutOfStock}
    >
      {/* Stock indicator badge */}
      <span
        className={cn(
          "absolute right-2 top-2 z-10 rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none",
          style.bg,
          style.text
        )}
      >
        {stockStatus === "out_of_stock" 
          ? "Out" 
          : stockStatus === "low_stock" 
            ? `${stock} Left` 
            : stock
        }
      </span>

      {/* Low stock warning indicator */}
      {stockStatus === "low_stock" && (
        <span className="absolute left-2 top-2 z-10 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
        </span>
      )}

      {/* Image */}
      <div className="relative aspect-square bg-background p-2">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.product_name}
            fill
            className="object-contain p-1"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-2.5 text-left border-t border-border/50">
        <p className="text-sm font-medium text-muted-foreground line-clamp-2 leading-tight min-h-[2.5rem]">
          {product.product_name}
        </p>
        <p className="mt-1.5 font-mono text-base text-foreground">
          ₱{unitPrice.toFixed(2)}
        </p>
      </div>
    </button>
  );
}
