import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getVendorStats, getVendorOrders, getTopPurchasedItems } from "@/actions/vendor";
import { VendorDashboard } from "./vendor-dashboard";

/**
 * Vendor Dashboard - Welcome page with stats and quick actions
 */
export default async function VendorDashboardPage() {
  const session = await auth();
  
  if (!session?.user?.id || session.user.userType !== "vendor") {
    redirect("/login");
  }

  const customerId = parseInt(session.user.id);
  
  // Validate customerId is a valid number
  if (isNaN(customerId) || customerId <= 0) {
    redirect("/login");
  }
  const [stats, recentOrders, topPurchasedItems] = await Promise.all([
    getVendorStats(customerId),
    getVendorOrders(customerId),
    getTopPurchasedItems(customerId, 3),
  ]);

  return (
    <VendorDashboard
      userName={session.user.name || "Vendor"}
      stats={stats}
      recentOrders={recentOrders.slice(0, 5)}
      topPurchasedItems={topPurchasedItems}
    />
  );
}



