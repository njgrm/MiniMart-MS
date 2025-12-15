import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getVendorStats, getVendorOrders } from "@/actions/vendor";
import { VendorDashboard } from "./vendor-dashboard";

/**
 * Vendor Dashboard - Welcome page with stats and quick actions
 */
export default async function VendorDashboardPage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/login");
  }

  const customerId = parseInt(session.user.id);
  const [stats, recentOrders] = await Promise.all([
    getVendorStats(customerId),
    getVendorOrders(customerId),
  ]);

  return (
    <VendorDashboard
      userName={session.user.name || "Vendor"}
      stats={stats}
      recentOrders={recentOrders.slice(0, 5)}
    />
  );
}

