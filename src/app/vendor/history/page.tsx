import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getVendorOrders } from "@/actions/vendor";
import { VendorHistoryClient } from "./history-client";

interface VendorHistoryPageProps {
  searchParams: Promise<{ orderId?: string }>;
}

/**
 * Vendor Order History Page
 * Supports deep-linking via ?orderId=X to auto-expand an order
 */
export default async function VendorHistoryPage({ searchParams }: VendorHistoryPageProps) {
  const session = await auth();
  
  if (!session?.user?.id || session.user.userType !== "vendor") {
    redirect("/login");
  }

  const customerId = parseInt(session.user.id);
  
  // Validate customerId is a valid number
  if (isNaN(customerId) || customerId <= 0) {
    redirect("/login");
  }
  const orders = await getVendorOrders(customerId);

  // Get orderId from searchParams for deep-linking
  const params = await searchParams;
  const highlightOrderId = params.orderId ? parseInt(params.orderId) : undefined;

  return (
    <VendorHistoryClient 
      orders={orders} 
      customerId={customerId}
      highlightOrderId={highlightOrderId}
    />
  );
}



