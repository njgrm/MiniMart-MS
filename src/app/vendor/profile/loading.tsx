import { Skeleton } from "@/components/ui/skeleton";

/**
 * ⚡ Vendor Profile Loading State
 * Shows immediately when navigating to /vendor/profile
 */
export default function VendorProfileLoading() {
  return (
    <div className="h-full w-full flex flex-col p-6 gap-6 overflow-auto max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <Skeleton className="h-7 w-32 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>
      
      {/* Profile Card */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div>
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-10 w-full rounded" />
          </div>
          <div>
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-10 w-full rounded" />
          </div>
          <div>
            <Skeleton className="h-4 w-28 mb-2" />
            <Skeleton className="h-10 w-full rounded" />
          </div>
        </div>
      </div>
      
      {/* Password Section */}
      <div className="bg-card rounded-xl border border-border p-6">
        <Skeleton className="h-5 w-36 mb-4" />
        <div className="space-y-4">
          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-10 w-full rounded" />
          </div>
          <div>
            <Skeleton className="h-4 w-28 mb-2" />
            <Skeleton className="h-10 w-full rounded" />
          </div>
          <div>
            <Skeleton className="h-4 w-36 mb-2" />
            <Skeleton className="h-10 w-full rounded" />
          </div>
        </div>
        <Skeleton className="h-10 w-36 mt-4" />
      </div>
    </div>
  );
}
