"use client";

import { useCallback, useEffect, useRef } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePosLayoutStore } from "@/stores/use-pos-layout-store";

interface ResizeHandleProps {
  /** Reference to the container element for calculating positions */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Drag handle for resizing the cart panel.
 * 
 * Features:
 * - Visual grip indicator with hover effect
 * - Smooth drag interaction
 * - Respects min/max width constraints
 * - Updates layout store in real-time
 */
export function ResizeHandle({ containerRef }: ResizeHandleProps) {
  const { 
    setCartWidth, 
    isResizing, 
    setIsResizing,
    minCartWidth,
    maxCartWidth 
  } = usePosLayoutStore();
  
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = usePosLayoutStore.getState().cartWidth;
    },
    [setIsResizing]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      
      // Calculate delta (negative because dragging left increases width)
      const delta = startXRef.current - e.clientX;
      const newWidth = startWidthRef.current + delta;
      
      // Clamp to min/max
      const clampedWidth = Math.min(Math.max(newWidth, minCartWidth), maxCartWidth);
      setCartWidth(clampedWidth);
    },
    [isResizing, setCartWidth, minCartWidth, maxCartWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, [setIsResizing]);

  // Add/remove global listeners when resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      // Prevent text selection during drag
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      className={cn(
        "relative flex-shrink-0 z-20 cursor-col-resize group",
        "w-0.25 hover:w-1.5 transition-all duration-150",
        isResizing && "w-1.5"
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Visual border line */}
      <div
        className={cn(
          "absolute inset-0 bg-border transition-colors duration-150",
          "group-hover:bg-primary/50",
          isResizing && "bg-primary"
        )}
      />
      
      {/* Grip handle button */}
      <div
        className={cn(
          "absolute left-1/2 top-1/10 -translate-x-1/2 -translate-y-1/2",
          "flex items-center justify-center",
          "w-4 h-10 rounded-full",
          "bg-muted border border-border shadow-sm",
          "opacity-100 group-hover:opacity-100 transition-opacity duration-150",
          "hover:bg-primary/10 hover:border-primary/50",
          isResizing && "opacity-100 bg-primary/10 border-primary"
        )}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

