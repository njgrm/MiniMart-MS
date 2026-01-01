import { getProducts } from "@/actions/product";
import { getSalesStats, getSalesHistory, getTopProducts } from "@/actions/sales";
import { getIncomingOrders, getRecentCompletedOrders } from "@/actions/orders";
import { DashboardClient } from "./dashboard-client";

/**
 * Admin Dashboard - Real-Time Business Intelligence Hub
 * Layout:
 * - Stock Alerts: Compact banner for out-of-stock/low-stock
 * - Top Row: 4 Key Metric Cards with trend indicators
 * - Middle Row: Charts (Revenue/Profit Trend + Bar Chart)
 * - Order List: Active and recently completed orders
 * - Bottom Row: Recent Activity, Top Products & Quick Actions
 */
export default async function AdminDashboard() {
  // Fetch all data server-side
  const [products, stats, recentSales, topProducts, incomingOrders, recentCompletedOrders] = await Promise.all([
    getProducts(),
    getSalesStats(),
    getSalesHistory("month", 1, 50), // Get more transactions for chart data
    getTopProducts(5),
    getIncomingOrders(),
    getRecentCompletedOrders(10), // Get last 10 completed orders
  ]);

  // Calculate inventory metrics
  const totalProducts = products.length;
  const outOfStockItems = products.filter((p) => p.current_stock === 0).length;
  const lowStockItems = products.filter((p) => p.status === "LOW_STOCK" && p.current_stock > 0).length;
  const inventoryValue = products.reduce(
    (sum, p) => sum + p.retail_price * p.current_stock,
    0
  );

  // Count active orders
  const activeOrdersCount = 
    incomingOrders.pending.length + 
    incomingOrders.preparing.length + 
    incomingOrders.ready.length;

  return (
    <DashboardClient
      stats={stats}
      recentSales={recentSales}
      inventoryMetrics={{
        totalProducts,
        outOfStockItems,
        lowStockItems,
        inventoryValue,
      }}
      topProducts={topProducts}
      incomingOrders={incomingOrders}
      recentCompletedOrders={recentCompletedOrders}
      activeOrdersCount={activeOrdersCount}
    />
  );
}
