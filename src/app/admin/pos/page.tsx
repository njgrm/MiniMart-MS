"use server";

import { getProducts } from "@/actions/product";
import { getStoreSettings } from "@/actions/settings";
import PosClient from "./pos-client";

export default async function PosPage() {
  // Fetch products and store settings in parallel
  const [products, settings] = await Promise.all([
    getProducts(),
    getStoreSettings(),
  ]);

  return (
    <PosClient 
      products={products} 
      gcashQrUrl={settings.gcash_qr_image_url}
    />
  );
}












