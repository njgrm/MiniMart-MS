"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { getUnitDisplayPrice, usePosStore, type PosProduct } from "@/stores/use-pos-store";

interface Props {
  product: PosProduct;
  onClick: () => void;
}

export function ProductCard({ product, onClick }: Props) {
  const { customerType } = usePosStore();
  const outOfStock = (product.current_stock ?? 0) <= 0;
  const unitPrice = getUnitDisplayPrice(product, customerType);

  return (
    <button
      type="button"
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-[0.98]",
        outOfStock && "opacity-50 pointer-events-none"
      )}
      onClick={onClick}
      disabled={outOfStock}
    >
      {/* Stock indicator */}
      <span
        className={cn(
          "absolute right-2 top-2 z-10 rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none",
          outOfStock ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground"
        )}
      >
        {outOfStock ? "Out" : product.current_stock}
      </span>

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
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight min-h-[2.5rem]">
          {product.product_name}
        </p>
        <p className="mt-1.5 font-mono text-base text-primary">
          ₱{unitPrice.toFixed(2)}
        </p>
      </div>
    </button>
  );
}
