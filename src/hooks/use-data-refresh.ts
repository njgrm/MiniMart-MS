"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface UseDataRefreshOptions {
  /**
   * Server action to check for updates.
   * Should return { hasUpdates: boolean; latestTimestamp: Date }
   */
  checkForUpdates: (lastCheckTimestamp: Date) => Promise<{
    hasUpdates: boolean;
    latestTimestamp: Date;
  }>;
  /**
   * Polling interval in milliseconds (default: 30000ms = 30 seconds)
   * Longer intervals are better for UX and prevent session issues
   */
  intervalMs?: number;
  /**
   * Whether the refresh is enabled (default: true)
   */
  enabled?: boolean;
  /**
   * Callback when updates are detected (called instead of router.refresh)
   * If provided, router.refresh() will NOT be called automatically
   */
  onUpdateDetected?: () => void;
}

/**
 * Smart data refresh hook using "pulse checking"
 * 
 * Features:
 * - Only checks when tab is visible (respects Page Visibility API)
 * - Pauses during navigation to prevent interruption
 * - Uses longer default intervals (30s) to prevent session issues
 * - Calls onUpdateDetected callback instead of router.refresh when provided
 * 
 * @example
 * ```tsx
 * const { isChecking, lastCheck, forceRefresh } = useDataRefresh({
 *   checkForUpdates: (timestamp) => checkOrdersForUpdates(timestamp),
 *   intervalMs: 30000,
 *   enabled: true,
 *   onUpdateDetected: () => {
 *     // Custom update handling - e.g., fetch new data without full refresh
 *   },
 * });
 * ```
 */
export function useDataRefresh({
  checkForUpdates,
  intervalMs = 30000, // 30 seconds default - much safer for UX
  enabled = true,
  onUpdateDetected,
}: UseDataRefreshOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const lastCheckRef = useRef<Date>(new Date());
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);
  const pathnameRef = useRef(pathname);
  const isMountedRef = useRef(true);

  // Track pathname changes to pause during navigation
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Track page visibility to pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    isVisibleRef.current = document.visibilityState === "visible";

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const performCheck = useCallback(async () => {
    // Don't check if already checking, not visible, or unmounted
    if (isChecking || !isVisibleRef.current || !isMountedRef.current) return;

    try {
      setIsChecking(true);
      const result = await checkForUpdates(lastCheckRef.current);

      // Check if still mounted and on same page after async call
      if (!isMountedRef.current) return;

      if (result.hasUpdates) {
        // Update timestamp before callback to prevent re-triggering
        lastCheckRef.current = result.latestTimestamp;
        setLastCheck(result.latestTimestamp);

        // Call the callback if provided (replaces router.refresh)
        if (onUpdateDetected) {
          onUpdateDetected();
        }
        // NOTE: We no longer call router.refresh() automatically
        // The callback should handle data fetching if needed
      } else {
        // Even if no updates, update the timestamp to the server's latest
        lastCheckRef.current = result.latestTimestamp;
        setLastCheck(result.latestTimestamp);
      }
    } catch (error) {
      // Silently fail - network issues shouldn't break the UI
      console.warn("[useDataRefresh] Check failed:", error);
    } finally {
      if (isMountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [checkForUpdates, isChecking, onUpdateDetected]);

  // Force refresh function for manual triggers
  const forceRefresh = useCallback(() => {
    setLastCheck(new Date());
    lastCheckRef.current = new Date();
    // Only call router.refresh for manual triggers
    router.refresh();
  }, [router]);

  // Pause/resume polling
  const pausePolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resumePolling = useCallback(() => {
    if (!intervalRef.current && enabled) {
      intervalRef.current = setInterval(performCheck, intervalMs);
    }
  }, [enabled, intervalMs, performCheck]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) {
      pausePolling();
      return;
    }

    // Don't perform initial check immediately - wait for first interval
    // This prevents overwhelming the server on page load
    intervalRef.current = setInterval(performCheck, intervalMs);

    return () => {
      isMountedRef.current = false;
      pausePolling();
    };
  }, [enabled, intervalMs, performCheck, pausePolling]);

  return {
    /** Whether a check is currently in progress */
    isChecking,
    /** Timestamp of the last successful check */
    lastCheck,
    /** Manually trigger a refresh */
    forceRefresh,
    /** Pause polling (e.g., during modals or navigation) */
    pausePolling,
    /** Resume polling after pause */
    resumePolling,
  };
}

/**
 * Simpler version for pages that just need periodic refresh
 * without the complexity of timestamp tracking
 */
export function usePeriodicRefresh(intervalMs: number = 30000, enabled: boolean = true) {
  const router = useRouter();
  const [refreshCount, setRefreshCount] = useState(0);
  const isVisibleRef = useRef(true);

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    isVisibleRef.current = document.visibilityState === "visible";

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      // Only refresh if tab is visible
      if (isVisibleRef.current) {
        router.refresh();
        setRefreshCount((c) => c + 1);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [enabled, intervalMs, router]);

  const forceRefresh = useCallback(() => {
    router.refresh();
    setRefreshCount((c) => c + 1);
  }, [router]);

  return { refreshCount, forceRefresh };
}


