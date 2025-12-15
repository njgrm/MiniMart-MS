import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getVendorOrders } from "@/actions/vendor";
import { VendorHistoryClient } from "./history-client";

/**
 * Vendor Order History Page
 */
export default async function VendorHistoryPage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/login");
  }

  const customerId = parseInt(session.user.id);
  const orders = await getVendorOrders(customerId);

  return <VendorHistoryClient orders={orders} customerId={customerId} />;
}

