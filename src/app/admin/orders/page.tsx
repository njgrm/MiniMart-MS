import { getIncomingOrders } from "@/actions/orders";
import { OrderBoard } from "@/components/orders/order-board";

/**
 * Incoming Orders Page - Kitchen Display System / Fulfillment Center
 * 
 * This page displays all incoming orders in a Kanban-style board:
 * - Pending: New orders waiting to be processed
 * - Preparing: Orders being packed
 * - Ready: Orders ready for pickup/delivery
 * 
 * Features:
 * - Real-time status updates
 * - Packing checklist for each order
 * - Direct payment processing
 * - Automatic inventory deduction on completion
 */
export default async function OrdersPage() {
  const orders = await getIncomingOrders();

  return (
    <div className="h-full w-full flex flex-col ">
      {/* Responsive container with proper padding */}
      <div className="flex-1 overflow-hidden p-0 md:p-2 lg:p-4">
        <div className="h-full rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <OrderBoard initialOrders={orders} />
        </div>
      </div>
    </div>
  );
}

