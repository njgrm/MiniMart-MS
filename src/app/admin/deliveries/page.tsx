import { getDeliveryHistory } from "@/actions/inventory";
import { DeliveriesClient } from "./deliveries-client";

export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  const initialData = await getDeliveryHistory("all", 1, 20);
  
  return <DeliveriesClient initialData={initialData} />;
}
