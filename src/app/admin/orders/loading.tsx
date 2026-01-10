import { Skeleton } from "@/components/ui/skeleton";

/**
 * ⚡ Instant Navigation Loading State
 * Shows immediately when navigating to /admin/orders
 * Mimics the Kanban board layout
 */
export default function OrdersLoading() {
  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 overflow-hidden p-0 md:p-2 lg:p-4">
        <div className="h-full rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Kanban header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-9 w-24" />
          </div>
          
          {/* Kanban columns */}
          <div className="flex h-[calc(100%-60px)] gap-4 p-4 overflow-x-auto">
            {/* Pending Column */}
            <div className="flex-shrink-0 w-80 bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-6 rounded-full" />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card rounded-lg p-3 mb-2 border border-border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-32 mb-2" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Preparing Column */}
            <div className="flex-shrink-0 w-80 bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-6 rounded-full" />
              </div>
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card rounded-lg p-3 mb-2 border border-border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-28 mb-2" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Ready Column */}
            <div className="flex-shrink-0 w-80 bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-6 rounded-full" />
              </div>
              {Array.from({ length: 1 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card rounded-lg p-3 mb-2 border border-border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
