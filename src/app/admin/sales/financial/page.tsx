import { getSalesStats, getSalesHistory } from "@/actions/sales";
import { FinancialBreakdownClient } from "./financial-client";

/**
 * Financial Breakdown Page
 * Detailed financial analytics accessible from Dashboard cards
 */
export default async function FinancialPage() {
  const [stats, salesData] = await Promise.all([
    getSalesStats(),
    getSalesHistory("month", 1, 100), // Get more data for charts
  ]);

  return <FinancialBreakdownClient stats={stats} salesData={salesData} />;
}



