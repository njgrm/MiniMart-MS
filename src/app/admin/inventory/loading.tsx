import { Skeleton } from "@/components/ui/skeleton";

/**
 * ⚡ Instant Navigation Loading State
 * Shows immediately when navigating to /admin/inventory
 */
export default function InventoryLoading() {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Header skeleton matching InventoryClient toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          {/* Search input skeleton */}
          <Skeleton className="h-9 w-64" />
          {/* Category filter skeleton */}
          <Skeleton className="h-9 w-40" />
          {/* Stock filter skeleton */}
          <Skeleton className="h-9 w-32" />
        </div>
        
        {/* Action buttons skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      
      {/* Table skeleton */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 border-b">
            <Skeleton className="h-4 w-8" /> {/* Checkbox */}
            <Skeleton className="h-4 w-48" /> {/* Product name */}
            <Skeleton className="h-4 w-24" /> {/* Category */}
            <Skeleton className="h-4 w-16" /> {/* Price */}
            <Skeleton className="h-4 w-20" /> {/* Stock */}
            <Skeleton className="h-4 w-20" /> {/* Status */}
            <Skeleton className="h-4 w-24" /> {/* Expiry */}
            <Skeleton className="h-4 w-16" /> {/* Actions */}
          </div>
          
          {/* Table rows */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-3 border-b border-border last:border-0"
            >
              <Skeleton className="h-4 w-4 rounded" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Footer skeleton */}
      <div className="flex items-center justify-between p-4 border-t border-border bg-card">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}
