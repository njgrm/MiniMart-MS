import { getProducts } from "@/actions/product";
import { getArchivedProducts } from "@/actions/archive";
import { getSuppliersForSelect } from "@/actions/supplier";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const [products, archivedProducts, suppliersResult] = await Promise.all([
    getProducts(),
    getArchivedProducts(),
    getSuppliersForSelect(),
  ]);

  // Unwrap suppliers from ActionResult
  const suppliers = suppliersResult.success ? suppliersResult.data ?? [] : [];

  return (
    <InventoryClient 
      initialProducts={products} 
      initialArchivedProducts={archivedProducts}
      suppliers={suppliers}
    />
  );
}
