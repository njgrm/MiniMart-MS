import { Skeleton } from "@/components/ui/skeleton";

/**
 * ⚡ Instant Navigation Loading State
 * Shows immediately when navigating to /admin/pos
 */
export default function POSLoading() {
  return (
    <div className="h-full w-full flex">
      {/* Product Grid Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search/Filter Bar */}
        <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
          <Skeleton className="h-10 flex-1 max-w-md" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-10" />
        </div>
        
        {/* Category Pills */}
        <div className="flex items-center gap-2 p-3 border-b border-border overflow-x-auto">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>
        
        {/* Product Grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-3 flex flex-col"
              >
                <Skeleton className="aspect-square rounded-lg mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-3 w-20 mb-2" />
                <div className="flex items-center justify-between mt-auto">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Cart Sidebar */}
      <div className="w-96 border-l border-border bg-card flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b border-border">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
        
        {/* Cart Items */}
        <div className="flex-1 overflow-auto p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-muted/50"
            >
              <Skeleton className="h-12 w-12 rounded" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
        
        {/* Cart Footer */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
