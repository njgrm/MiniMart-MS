import { Suspense } from "react";
import { AnalyticsDashboard } from "./analytics-dashboard";
import { getAnalyticsData } from "./actions";
import { getSalesStats } from "@/actions/sales";
import { Skeleton } from "@/components/ui/skeleton";

// Force dynamic but with shorter revalidation
export const dynamic = "force-dynamic";

/**
 * Analytics Page
 * 
 * ⚡ OPTIMIZED: Data fetching is parallelized and the page shell loads instantly.
 * The heavy analytics data loads in the background while users see the skeleton.
 */
export default async function AnalyticsPage() {
  // Run both data fetches in parallel
  const dataPromise = Promise.all([
    getAnalyticsData(),
    getSalesStats(),
  ]);

  return (
    <Suspense fallback={<AnalyticsLoadingSkeleton />}>
      <AnalyticsContent dataPromise={dataPromise} />
    </Suspense>
  );
}

// Separate async component for streaming
async function AnalyticsContent({ 
  dataPromise 
}: { 
  dataPromise: Promise<[Awaited<ReturnType<typeof getAnalyticsData>>, Awaited<ReturnType<typeof getSalesStats>>]> 
}) {
  const [analyticsData, financialStats] = await dataPromise;
  
  return (
    <AnalyticsDashboard data={analyticsData} financialStats={financialStats} />
  );
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="h-full w-full flex flex-col p-6 gap-6 overflow-auto">
      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-xl border border-border p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
            <Skeleton className="h-8 w-36 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      
      {/* Main Chart Area */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <Skeleton className="h-[350px] w-full rounded-lg" />
      </div>
      
      {/* Forecasts Table */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-44" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        
        {/* Table Header */}
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-t-lg border-b">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        
        {/* Table Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-3 border-b border-border last:border-0"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
