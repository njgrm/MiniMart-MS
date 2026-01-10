import { Suspense } from "react";
import { getAuditLogs, getAuditLogFilterOptions } from "@/actions/audit";
import { AuditLogsClient } from "./audit-logs-client";
import { Skeleton } from "@/components/ui/skeleton";

// ⚡ Separate data fetching into a component for Suspense streaming
async function AuditLogsContent() {
  // Fetch logs and filter options in parallel (2 DB calls instead of 4)
  const [logsResult, filterOptions] = await Promise.all([
    getAuditLogs(),
    getAuditLogFilterOptions(),
  ]);

  return (
    <AuditLogsClient 
      initialLogs={logsResult.logs}
      initialTotal={logsResult.total}
      initialPages={logsResult.pages}
      entityTypes={filterOptions.entityTypes}
      usernames={filterOptions.usernames}
      modules={filterOptions.modules}
    />
  );
}

// Loading skeleton for Suspense fallback
function AuditLogsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      
      {/* Filters skeleton */}
      <div className="flex gap-4 flex-wrap">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-64" />
      </div>
      
      {/* Table skeleton */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/50 p-3">
          <div className="flex gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
        </div>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
          <div key={row} className="p-3 border-t">
            <div className="flex gap-4">
              {[1, 2, 3, 4, 5].map((col) => (
                <Skeleton key={col} className="h-4 flex-1" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuditLogsPage() {
  return (
    <Suspense fallback={<AuditLogsSkeleton />}>
      <AuditLogsContent />
    </Suspense>
  );
}
