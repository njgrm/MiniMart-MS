"use client";

import { usePosStore, type PosProduct, getGridDisplayPrice } from "@/stores/use-pos-store";
import { ProductCard } from "./product-card";

interface ProductGridProps {
  products: PosProduct[];
}

/**
 * Responsive product grid that uses CSS Grid auto-fill.
 * Cards automatically flow into fewer columns as the container shrinks.
 * 
 * - Min card width: 140px (ensures cards don't get too small)
 * - Max card width: 1fr (cards expand to fill available space evenly)
 * - Gap: 12px (0.75rem / gap-3)
 */
export function ProductGrid({ products }: ProductGridProps) {
  const { addProduct, catalogMode } = usePosStore();

  return (
    <div 
      className="grid gap-3"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
      }}
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
