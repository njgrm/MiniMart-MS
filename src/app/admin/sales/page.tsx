import { getSalesHistory } from "@/actions/sales";
import { SalesHistoryClient } from "./sales-history-client";

/**
 * Sales Transactions Page
 * Pure data table view matching the Inventory page layout exactly
 * Sub-navigation provided by layout.tsx
 */
export default async function SalesPage() {
  const initialData = await getSalesHistory("all", 1, 20);

  return <SalesHistoryClient initialData={initialData} />;
}
