"use client";

import Image from "next/image";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  usePosStore, 
  getCartQuantity, 
  getVisualStock,
  type PosProduct 
} from "@/stores/use-pos-store";

interface Props {
  product: PosProduct;
  /** The display price based on current catalog mode */
  displayPrice: number;
  /** Price type indicator: "R" for retail, "W" for wholesale */
  priceType: "R" | "W";
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

const stockStyles: Record<StockStatus, { bg: string; text: string }> = {
  in_stock: {
    bg: "bg-[#2EAFC5] dark:bg-[#2EAFC5]/90",
    text: "text-white",
  },
  low_stock: {
    bg: "bg-secondary",
    text: "text-secondary-foreground",
  },
  out_of_stock: {
    bg: "bg-destructive",
    text: "text-destructive-foreground",
  },
};

export function ProductCard({ product, displayPrice, priceType, onClick }: Props) {
  const { cart, updateQuantity } = usePosStore();
  
  // Get cart quantity for this product
  const cartQty = getCartQuantity(cart, product.product_id);
  
  // Calculate visual stock (database stock minus cart quantity)
  const visualStock = getVisualStock(product, cart);
  const reorderLevel = product.reorder_level ?? 10;
  
  // Use visual stock for status determination
  const stockStatus = getStockStatus(visualStock, reorderLevel);
  const isOutOfStock = stockStatus === "out_of_stock";
  
  const style = stockStyles[stockStatus];

  // Handle decrement
  const handleDecrement = () => {
    if (cartQty > 0) {
      updateQuantity(product.product_id, cartQty - 1);
    }
  };

  // Handle card click (add to cart)
  const handleCardClick = () => {
    if (!isOutOfStock) {
      onClick();
    }
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all",
        !isOutOfStock && "hover:border-primary hover:shadow-md cursor-pointer",
        isOutOfStock && "opacity-50 grayscale"
      )}
    >
      {/* Stock indicator badge - shows VISUAL stock (top-right) */}
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
            ? `${visualStock} Left` 
            : visualStock
        }
      </span>

      {/* Low stock warning indicator (top-left, only when not in cart) */}
      {stockStatus === "low_stock" && !cartQty && (
        <span className="absolute left-2 top-2 z-10 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
        </span>
      )}

      {/* Clickable Image Area */}
      <div 
        className={cn(
          "relative aspect-square bg-muted/50 dark:bg-background p-2",
          !isOutOfStock && "cursor-pointer active:scale-[0.98] transition-transform"
        )}
        onClick={handleCardClick}
        role="button"
        tabIndex={isOutOfStock ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
        aria-label={`Add ${product.product_name} to cart`}
      >
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

        {/* Hover overlay with plus icon - ALWAYS visible on hover (not out of stock) */}
        {!isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 dark:bg-white rounded-full p-3 shadow-lg">
              <Plus className="h-6 w-6 text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-2.5 text-left border-t border-border/50">
        <p className="text-sm font-medium text-muted-foreground line-clamp-2 leading-tight min-h-[2.5rem]">
          {product.product_name}
        </p>
        
        {/* Price Row */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="font-mono text-base font-medium text-primary dark:text-foreground">
            ₱{displayPrice.toFixed(2)}
          </p>

          {/* Subtract Control - entire button is clickable for decrement */}
          {cartQty > 0 && (
            <button
              type="button"
              className="flex items-center gap-0 rounded-lg overflow-hidden border border-primary dark:border-primary hover:scale-110 hover:shadow-md active:scale-100 transition-all duration-150 cursor-pointer"
              onClick={handleDecrement}
              aria-label={`Remove one ${product.product_name} from cart (${cartQty} in cart)`}
            >
              <span className="h-7 w-7 flex items-center justify-center bg-primary text-primary-foreground">
                <Minus className="h-3.5 w-3.5" />
              </span>
              <span className="px-2.5 h-7 flex items-center justify-center text-sm font-bold text-muted-foreground tabular-nums bg-card dark:bg-background">
                {cartQty}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
