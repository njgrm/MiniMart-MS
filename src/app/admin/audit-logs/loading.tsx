import { Skeleton } from "@/components/ui/skeleton";

/**
 * ⚡ Audit Logs Loading State
 * Shows immediately when navigating to /admin/audit-logs
 */
export default function AuditLogsLoading() {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      
      {/* Table */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 border-b">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
          
          {/* Table rows */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-3 border-b border-border last:border-0"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-between p-4 border-t border-border bg-card">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}
