import { getProducts } from "@/actions/product";
import { getArchivedProducts } from "@/actions/archive";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const [products, archivedProducts] = await Promise.all([
    getProducts(),
    getArchivedProducts(),
  ]);

  return (
    <InventoryClient 
      initialProducts={products} 
      initialArchivedProducts={archivedProducts}
    />
  );
}
