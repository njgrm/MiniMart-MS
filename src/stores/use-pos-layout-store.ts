"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * POS View Mode
 * - "touch": Modern touch-friendly layout with product grid (for mobile/tablet)
 * - "legacy": Traditional keyboard-centric layout for barcode scanning (for desktop)
 */
export type PosViewMode = "touch" | "legacy";

/**
 * POS Layout Store
 * 
 * Manages the layout preferences for the POS page, including:
 * - Cart panel width (resizable)
 * - View mode (touch vs legacy)
 * - Selected item index for legacy mode navigation
 * 
 * Uses Zustand persist middleware to save preferences to localStorage
 */

interface PosLayoutState {
  /** Width of the cart panel in pixels */
  cartWidth: number;
  /** Minimum cart width */
  minCartWidth: number;
  /** Maximum cart width */
  maxCartWidth: number;
  /** Whether the user is currently dragging the resize handle */
  isResizing: boolean;
  /** Current POS view mode (touch or legacy) */
  viewMode: PosViewMode;
  /** Whether viewMode has been initialized (for auto-detection) */
  viewModeInitialized: boolean;
  /** Index of the currently selected item in legacy mode (-1 = none) */
  selectedItemIndex: number;
  /** ID of the most recently added item (for highlight animation) */
  lastAddedItemId: number | null;
  /** Set the cart width */
  setCartWidth: (width: number) => void;
  /** Set resizing state */
  setIsResizing: (isResizing: boolean) => void;
  /** Reset to default width */
  resetCartWidth: () => void;
  /** Set the view mode */
  setViewMode: (mode: PosViewMode) => void;
  /** Toggle between touch and legacy modes */
  toggleViewMode: () => void;
  /** Initialize view mode based on device type (only runs once) */
  initializeViewMode: () => void;
  /** Set selected item index for legacy mode */
  setSelectedItemIndex: (index: number) => void;
  /** Set the last added item ID for highlight animation */
  setLastAddedItemId: (id: number | null) => void;
}

const DEFAULT_CART_WIDTH = 340;
const MIN_CART_WIDTH = 280;
const MAX_CART_WIDTH = 500;

/**
 * Detect if the current device is mobile/tablet
 * Uses multiple signals: screen width, touch capability, and user agent
 */
const detectIsMobileOrTablet = (): boolean => {
  if (typeof window === "undefined") return false;
  
  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < 1024;
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  
  // Consider it mobile/tablet if it's a touch device AND (small screen OR mobile user agent)
  return isTouchDevice && (isSmallScreen || isMobileUserAgent);
};

export const usePosLayoutStore = create<PosLayoutState>()(
  persist(
    (set, get) => ({
      cartWidth: DEFAULT_CART_WIDTH,
      minCartWidth: MIN_CART_WIDTH,
      maxCartWidth: MAX_CART_WIDTH,
      isResizing: false,
      viewMode: "touch", // Default, will be auto-detected on init
      viewModeInitialized: false,
      selectedItemIndex: -1,
      lastAddedItemId: null,

      setCartWidth: (width) =>
        set({
          cartWidth: Math.min(Math.max(width, MIN_CART_WIDTH), MAX_CART_WIDTH),
        }),

      setIsResizing: (isResizing) => set({ isResizing }),

      resetCartWidth: () => set({ cartWidth: DEFAULT_CART_WIDTH }),

      setViewMode: (mode) => set({ viewMode: mode, viewModeInitialized: true }),

      toggleViewMode: () =>
        set((state) => ({
          viewMode: state.viewMode === "touch" ? "legacy" : "touch",
          viewModeInitialized: true,
        })),

      initializeViewMode: () => {
        const { viewModeInitialized } = get();
        // Only auto-detect if not previously set by user
        if (!viewModeInitialized) {
          const isMobileOrTablet = detectIsMobileOrTablet();
          set({
            viewMode: isMobileOrTablet ? "touch" : "legacy",
            viewModeInitialized: true,
          });
        }
      },

      setSelectedItemIndex: (index) => set({ selectedItemIndex: index }),

      setLastAddedItemId: (id) => set({ lastAddedItemId: id }),
    }),
    {
      name: "pos-layout-prefs",
      // Persist cartWidth, viewMode, and initialization flag
      partialize: (state) => ({
        cartWidth: state.cartWidth,
        viewMode: state.viewMode,
        viewModeInitialized: state.viewModeInitialized,
      }),
    }
  )
);


































