import { Skeleton } from "@/components/ui/skeleton";

/**
 * ⚡ Instant Navigation Loading State
 * Shows immediately when navigating to /admin/sales
 * Uses Suspense boundary for streaming
 */
export default function SalesLoading() {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Header skeleton matching SalesHistoryClient toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          {/* Search input skeleton */}
          <Skeleton className="h-9 w-64" />
          {/* Filter dropdown skeleton */}
          <Skeleton className="h-9 w-32" />
        </div>
        
        {/* KPI chips skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        
        {/* Action buttons skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      
      {/* Table skeleton */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 border-b">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          
          {/* Table rows */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-3 border-b border-border last:border-0"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Pagination skeleton */}
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
