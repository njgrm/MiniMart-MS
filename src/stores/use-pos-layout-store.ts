"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * POS Layout Store
 * 
 * Manages the layout preferences for the POS page, including:
 * - Cart panel width (resizable)
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
  /** Set the cart width */
  setCartWidth: (width: number) => void;
  /** Set resizing state */
  setIsResizing: (isResizing: boolean) => void;
  /** Reset to default width */
  resetCartWidth: () => void;
}

const DEFAULT_CART_WIDTH = 340;
const MIN_CART_WIDTH = 280;
const MAX_CART_WIDTH = 500;

export const usePosLayoutStore = create<PosLayoutState>()(
  persist(
    (set) => ({
      cartWidth: DEFAULT_CART_WIDTH,
      minCartWidth: MIN_CART_WIDTH,
      maxCartWidth: MAX_CART_WIDTH,
      isResizing: false,

      setCartWidth: (width) =>
        set({
          cartWidth: Math.min(Math.max(width, MIN_CART_WIDTH), MAX_CART_WIDTH),
        }),

      setIsResizing: (isResizing) => set({ isResizing }),

      resetCartWidth: () => set({ cartWidth: DEFAULT_CART_WIDTH }),
    }),
    {
      name: "pos-layout-prefs",
      // Only persist the cartWidth, not the isResizing state
      partialize: (state) => ({ cartWidth: state.cartWidth }),
    }
  )
);












