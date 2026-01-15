import { Suspense } from "react";
import { getSupplierAnalytics } from "@/actions/reports";
import { SupplierAnalyticsClient } from "./supplier-analytics-client";

export const metadata = {
  title: "Supplier Analytics | Christian Minimart",
  description: "Analyze supplier performance, deliveries, and return rates",
};

export const dynamic = "force-dynamic";

export default async function SupplierAnalyticsPage() {
  // Default to last 365 days
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  const initialData = await getSupplierAnalytics({
    from: oneYearAgo,
    to: new Date(),
  });

  return (
    <Suspense fallback={<div className="p-6">Loading report...</div>}>
      <SupplierAnalyticsClient initialData={initialData} />
    </Suspense>
  );
}
