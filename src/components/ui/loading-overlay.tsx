"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps content with a loading overlay when isLoading is true.
 * Shows a semi-transparent overlay with a spinner on top of the content.
 */
export function LoadingOverlay({ isLoading, children, className }: LoadingOverlayProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center rounded-lg z-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton loading state for compact cards
 */
export function CardSkeleton() {
  return (
    <div className="border rounded-lg p-3 py-4 animate-pulse bg-card">
      <div className="flex items-start gap-2">
        <div className="p-1.5 rounded-lg bg-stone-200 h-7 w-7" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-16 bg-stone-200 rounded" />
          <div className="h-6 w-24 bg-stone-200 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton loading state for tables
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-10 bg-stone-200/50 rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-stone-100/50 rounded" />
      ))}
    </div>
  );
}
