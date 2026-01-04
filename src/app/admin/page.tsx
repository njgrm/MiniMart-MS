import { getProducts } from "@/actions/product";
import { getSalesStats, getSalesHistory, getTopProducts } from "@/actions/sales";
import { getIncomingOrders, getRecentCompletedOrders } from "@/actions/orders";
import { getCashRegisterData, getInventoryHealthData, getTodaySalesStats } from "@/actions/dashboard";
import { DashboardClient } from "./dashboard-client";

/**
 * Admin Dashboard - Operational Command Center
 * 
 * Purpose: Answer "What needs my attention RIGHT NOW?"
 * 
 * Layout:
 * - Top Row: Key Metric Cards (Today's stats by default)
 * - Middle Row: Sales Chart + Active Orders Queue
 * - Bottom Row: Cash Register + Inventory Health Alerts
 * - Quick Actions Row
 */
export default async function AdminDashboard() {
  // Fetch all data server-side
  const [
    products,
    stats,
    recentSales,
    topProducts,
    incomingOrders,
    recentCompletedOrders,
    cashRegisterData,
    inventoryHealthData,
    todayStats,
  ] = await Promise.all([
    getProducts(),
    getSalesStats(),
    getSalesHistory("month", 1, 50),
    getTopProducts(5),
    getIncomingOrders(),
    getRecentCompletedOrders(10),
    getCashRegisterData(),
    getInventoryHealthData(),
    getTodaySalesStats(),
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
      cashRegisterData={cashRegisterData}
      inventoryHealthData={inventoryHealthData}
      todayStats={todayStats}
    />
  );
}
