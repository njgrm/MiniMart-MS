import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getVendorProducts } from "@/actions/vendor";
import { VendorOrderClient } from "./order-client";

/**
 * Vendor Order Page - Product catalog with cart functionality
 */
export default async function VendorOrderPage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/login");
  }

  const customerId = parseInt(session.user.id);
  const products = await getVendorProducts();

  // Get unique categories
  const categories = Array.from(new Set(products.map((p) => p.category))).sort();

  return (
    <VendorOrderClient
      products={products}
      categories={categories}
      customerId={customerId}
    />
  );
}

