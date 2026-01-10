import { Skeleton } from "@/components/ui/skeleton";

/**
 * ⚡ Login Page Loading State
 */
export default function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <Skeleton className="h-10 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-56 mx-auto" />
          </div>
          
          {/* Form */}
          <div className="space-y-4">
            <div>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-10 w-full rounded" />
            </div>
            <div>
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-10 w-full rounded" />
            </div>
            <Skeleton className="h-10 w-full rounded-lg mt-6" />
          </div>
          
          {/* Footer */}
          <div className="mt-6 text-center">
            <Skeleton className="h-4 w-40 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
