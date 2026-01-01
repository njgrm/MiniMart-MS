import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getVendorDashboardData, getVendorStats } from "@/actions/vendor";
import { VendorDashboard } from "./vendor-dashboard";

/**
 * Vendor Dashboard - Welcome page with live order status, quick re-order, and recent orders
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

  // Fetch dashboard data using the new combined function
  const [dashboardData, stats] = await Promise.all([
    getVendorDashboardData(customerId),
    getVendorStats(customerId), // Keep for additional stats like pendingOrders
  ]);

  return (
    <VendorDashboard
      userName={session.user.name || "Vendor"}
      customerId={customerId}
      activeOrders={dashboardData.activeOrders}
      quickReorderItems={dashboardData.quickReorderItems}
      recentOrders={dashboardData.recentOrders}
      stats={stats}
    />
  );
}



