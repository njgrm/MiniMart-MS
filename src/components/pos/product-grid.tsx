"use client";

import { usePosStore, type PosProduct, getGridDisplayPrice } from "@/stores/use-pos-store";
import { ProductCard } from "./product-card";

interface ProductGridProps {
  products: PosProduct[];
}

/**
 * Responsive product grid optimized for touch devices.
 * Uses compact card sizing for better density on tablets.
 * 
 * Breakpoints:
 * - Mobile (<640px): 3 columns - Compact cards
 * - Tablet Portrait (md 768px): 4 columns
 * - Tablet Landscape (lg 1024px): 5 columns  
 * - Desktop (xl 1280px+): 5 columns
 * 
 * Fixed split layout means grid fills available space naturally.
 */
export function ProductGrid({ products }: ProductGridProps) {
  const { addProduct, catalogMode } = usePosStore();

  return (
    <div 
      className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2"
    >
      {products.map((product) => {
        const displayPrice = getGridDisplayPrice(product, catalogMode);
        return (
          <ProductCard
            key={product.product_id}
            product={product}
            displayPrice={displayPrice}
            priceType={catalogMode === "wholesale" ? "W" : "R"}
            onClick={() => addProduct(product)}
          />
        );
      })}

      {products.length === 0 && (
        <div className="col-span-full py-10 text-center text-muted-foreground text-sm">
          No products found
        </div>
      )}
    </div>
  );
}
