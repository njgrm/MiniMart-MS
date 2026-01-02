import { Suspense } from "react";
import { AnalyticsDashboard } from "./analytics-dashboard";
import { getAnalyticsData } from "./actions";
import { getSalesStats } from "@/actions/sales";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [analyticsData, financialStats] = await Promise.all([
    getAnalyticsData(),
    getSalesStats(),
  ]);

  return (
    <Suspense fallback={<AnalyticsLoadingSkeleton />}>
      <AnalyticsDashboard data={analyticsData} financialStats={financialStats} />
    </Suspense>
  );
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-[#F9F6F0] animate-pulse rounded-xl" />
        ))}
      </div>
      <div className="h-[400px] bg-[#F9F6F0] animate-pulse rounded-xl" />
      <div className="h-[300px] bg-[#F9F6F0] animate-pulse rounded-xl" />
    </div>
  );
}
