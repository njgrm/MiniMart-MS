import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getVendorProducts } from "@/actions/vendor";
import { VendorOrderClient } from "./order-client";

interface VendorOrderPageProps {
  searchParams: Promise<{ addProduct?: string }>;
}

/**
 * Vendor Order Page - Product catalog with cart functionality
 */
export default async function VendorOrderPage({ searchParams }: VendorOrderPageProps) {
  const session = await auth();
  
  if (!session?.user?.id || session.user.userType !== "vendor") {
    redirect("/login");
  }

  const customerId = parseInt(session.user.id);
  
  // Validate customerId is a valid number
  if (isNaN(customerId) || customerId <= 0) {
    redirect("/login");
  }

  const products = await getVendorProducts();

  // Get unique categories
  const categories = Array.from(new Set(products.map((p) => p.category))).sort();

  // Get pre-add product ID from URL params (from dashboard quick add)
  const params = await searchParams;
  const preAddProductId = params.addProduct ? parseInt(params.addProduct) : undefined;

  return (
    <VendorOrderClient
      products={products}
      categories={categories}
      customerId={customerId}
      preAddProductId={preAddProductId}
    />
  );
}



