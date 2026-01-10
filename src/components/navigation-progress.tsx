"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * ⚡ Global Navigation Progress Bar
 * 
 * Shows a thin progress bar at the top of the screen during page navigation.
 * This provides INSTANT visual feedback that something is happening,
 * solving the "frozen UI" feeling during slow navigations.
 * 
 * Inspired by NProgress but lighter weight and React-native.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  // Reset when route completes
  useEffect(() => {
    if (isNavigating) {
      // Complete the progress bar animation
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setIsNavigating(false);
        setProgress(0);
      }, 200);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    
    if (isNavigating && visible) {
      // Simulate progress that slows down as it approaches 90%
      progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          // Faster initial progress, then slows down
          const remaining = 90 - prev;
          const increment = remaining * 0.1;
          return Math.min(prev + Math.max(increment, 2), 90);
        });
      }, 100);
    }

    return () => clearInterval(progressInterval);
  }, [isNavigating, visible]);

  // Listen for navigation start via click events on links
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      
      if (link) {
        const href = link.getAttribute("href");
        const isInternal = href?.startsWith("/") && !href?.startsWith("//");
        const isSameOrigin = link.origin === window.location.origin;
        const isNewTab = link.target === "_blank";
        const hasDownload = link.hasAttribute("download");
        
        if (isInternal && isSameOrigin && !isNewTab && !hasDownload) {
          // Check if it's actually a different page
          if (href !== pathname) {
            setIsNavigating(true);
            setProgress(15);
            setVisible(true);
          }
        }
      }
    };

    // Also listen for popstate (back/forward navigation)
    const handlePopState = () => {
      setIsNavigating(true);
      setProgress(15);
      setVisible(true);
    };

    document.addEventListener("click", handleClick, true); // Use capture for earlier detection
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-transparent pointer-events-none">
      <div
        className="h-full bg-primary transition-all ease-out shadow-[0_0_10px_rgba(172,15,22,0.7)]"
        style={{ 
          width: `${progress}%`,
          transitionDuration: progress === 100 ? '100ms' : '300ms'
        }}
      />
    </div>
  );
}
