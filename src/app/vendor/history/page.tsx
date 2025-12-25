import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getVendorOrders } from "@/actions/vendor";
import { VendorHistoryClient } from "./history-client";

/**
 * Vendor Order History Page
 */
export default async function VendorHistoryPage() {
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

  return <VendorHistoryClient orders={orders} customerId={customerId} />;
}



