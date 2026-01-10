import { Skeleton } from "@/components/ui/skeleton";

/**
 * ⚡ Vendor New Order Loading State
 * Shows immediately when navigating to /vendor/order
 */
export default function VendorOrderLoading() {
  return (
    <div className="h-full w-full flex">
      {/* Product Selection */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-border bg-card">
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
        
        {/* Category Pills */}
        <div className="flex items-center gap-2 p-3 border-b border-border overflow-x-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>
        
        {/* Product Grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-3"
              >
                <Skeleton className="aspect-square rounded-lg mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Order Cart */}
      <div className="w-80 border-l border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-6 w-28 mb-2" />
          <Skeleton className="h-4 w-20" />
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-muted/50">
              <Skeleton className="h-12 w-12 rounded" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
