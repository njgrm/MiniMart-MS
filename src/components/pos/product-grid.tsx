"use client";

import { usePosStore } from "@/stores/use-pos-store";
import { type PosProduct } from "@/stores/use-pos-store";
import { ProductCard } from "./product-card";

interface ProductGridProps {
  products: PosProduct[];
}

export function ProductGrid({ products }: ProductGridProps) {
  const { addProduct } = usePosStore();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
      {products.map((product) => (
        <ProductCard key={product.product_id} product={product} onClick={() => addProduct(product)} />
      ))}

      {products.length === 0 && (
        <div className="col-span-full py-10 text-center text-muted-foreground text-sm">
          No products found
        </div>
      )}
    </div>
  );
}
