import { getProducts } from "@/actions/product";
import { getSalesStats, getSalesHistory, getTopProducts } from "@/actions/sales";
import { DashboardClient } from "./dashboard-client";

/**
 * Admin Dashboard - Real-Time Business Intelligence Hub
 * Layout:
 * - Stock Alerts: Clickable cards for out-of-stock/low-stock
 * - Top Row: 4 Key Metric Cards (clickable)
 * - Middle Row: Recharts Graphs with Date Range Filter
 * - Bottom Row: Recent Activity, Top Products & Quick Actions
 */
export default async function AdminDashboard() {
  // Fetch all data server-side
  const [products, stats, recentSales, topProducts] = await Promise.all([
    getProducts(),
    getSalesStats(),
    getSalesHistory("month", 1, 50), // Get more transactions for chart data
    getTopProducts(5),
  ]);

  // Calculate inventory metrics
  const totalProducts = products.length;
  const outOfStockItems = products.filter((p) => p.current_stock === 0).length;
  const lowStockItems = products.filter((p) => p.status === "LOW_STOCK" && p.current_stock > 0).length;
  const inventoryValue = products.reduce(
    (sum, p) => sum + p.retail_price * p.current_stock,
    0
  );

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
    />
  );
}
