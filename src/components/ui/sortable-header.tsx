"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * AnimatedSortableHeader - Sortable column header with animated direction indicators
 * Uses Framer Motion for smooth arrow flip animations
 * Follows Inventory table golden standard: LEFT-aligned, uppercase, tracking-wider
 */
interface SortableHeaderProps {
  column: {
    toggleSorting: (desc?: boolean) => void;
    getIsSorted: () => "asc" | "desc" | false;
  };
  children: React.ReactNode;
  className?: string;
}

export function SortableHeader({ column, children, className }: SortableHeaderProps) {
  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={cn(
        "-ml-4 h-8 uppercase text-[11px] font-semibold tracking-wider gap-1",
        className
      )}
    >
      {children}
      <AnimatePresence mode="wait" initial={false}>
        {sorted === "asc" ? (
          <motion.div
            key="asc"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </motion.div>
        ) : sorted === "desc" ? (
          <motion.div
            key="desc"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.div>
        ) : (
          <motion.div
            key="unsorted"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.5, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </motion.div>
        )}
      </AnimatePresence>
    </Button>
  );
}

/**
 * SortIndicator - Standalone animated sort direction indicator
 * Use this when you need just the icon without the button wrapper
 */
interface SortIndicatorProps {
  direction: "asc" | "desc" | false;
  className?: string;
}

export function SortIndicator({ direction, className }: SortIndicatorProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {direction === "asc" ? (
        <motion.div
          key="asc"
          initial={{ opacity: 0, rotate: 180 }}
          animate={{ opacity: 1, rotate: 0 }}
          exit={{ opacity: 0, rotate: -180 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className={className}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </motion.div>
      ) : direction === "desc" ? (
        <motion.div
          key="desc"
          initial={{ opacity: 0, rotate: -180 }}
          animate={{ opacity: 1, rotate: 0 }}
          exit={{ opacity: 0, rotate: 180 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className={className}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.div>
      ) : (
        <motion.div
          key="unsorted"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.5, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={className}
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
