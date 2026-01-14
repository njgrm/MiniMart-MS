import { Suspense } from "react";
import { getSpoilageReport } from "@/actions/reports";
import { SpoilageReportClient } from "./spoilage-client";

export const metadata = {
  title: "Spoilage & Wastage Report | Christian Minimart",
  description: "Track damaged, expired, and returned stock",
};

export const dynamic = "force-dynamic";

export default async function SpoilageReportPage() {
  // Default to last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const initialData = await getSpoilageReport({
    from: thirtyDaysAgo,
    to: new Date(),
  });

  return (
    <Suspense fallback={<div className="p-6">Loading report...</div>}>
      <SpoilageReportClient initialData={initialData} />
    </Suspense>
  );
}
