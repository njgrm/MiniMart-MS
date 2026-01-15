import { Suspense } from "react";
import { getExpiringReport } from "@/actions/reports";
import { ExpiringReportClient } from "./expiring-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Expiry Tracker | Reports | Christian Minimart",
  description: "Track products expiring within 7, 14, and 30 days with batch details",
};

async function ExpiringReportData() {
  const data = await getExpiringReport();
  return <ExpiringReportClient data={data} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-4 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-[400px]" />
    </div>
  );
}

export default function ExpiringReportPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ExpiringReportData />
    </Suspense>
  );
}
