import { getProducts } from "@/actions/product";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const products = await getProducts();

  return <InventoryClient initialProducts={products} />;
}
