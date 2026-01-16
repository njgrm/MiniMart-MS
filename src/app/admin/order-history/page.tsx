import { getOrderHistory } from "@/actions/orders";
import { OrderHistoryClient } from "./order-history-client";

/**
 * Order History Page
 * Shows all completed and cancelled orders (fulfilled/closed vendor orders)
 * Follows the same table layout pattern as Sales History
 */
export default async function OrderHistoryPage() {
  const initialData = await getOrderHistory("all", "all", 1, 20);

  return <OrderHistoryClient initialData={initialData} />;
}
