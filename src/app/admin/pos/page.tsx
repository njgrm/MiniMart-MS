"use server";

import { getProducts } from "@/actions/product";
import PosClient from "./pos-client";

export default async function PosPage() {
  const products = await getProducts();

  return <PosClient products={products} />;
}











