"use client";

import { create } from "zustand";

/**
 * Catalog Mode determines which products are shown and at what price.
 * - "retail": Show products with retail_price > 0, use retail_price
 * - "wholesale": Show products with wholesale_price > 0, use wholesale_price
 */
export type CatalogMode = "retail" | "wholesale";

/**
 * Customer type is now only used to tag the transaction (e.g., linking to a customer).
 * It no longer affects pricing - prices are locked at add time based on catalogMode.
 */
export type CustomerType = "walkin" | "vendor";

export interface PosProduct {
  product_id: number;
  product_name: string;
  barcode?: string | null;
  category?: string | null;
  retail_price: number;
  wholesale_price: number;
  current_stock: number;
  reorder_level: number;
  image_url?: string | null;
}

/**
 * Cart item extends PosProduct but includes:
 * - quantity: number of items
 * - lockedPrice: the price locked in at the time of adding (based on catalogMode)
 * - priceType: "R" for retail, "W" for wholesale - for display purposes
 */
export interface PosCartItem extends PosProduct {
  quantity: number;
  lockedPrice: number;
  priceType: "R" | "W";
}

interface PosState {
  products: PosProduct[];
  cart: PosCartItem[];
  catalogMode: CatalogMode;
  customerType: CustomerType;
  setProducts: (products: PosProduct[]) => void;
  setCatalogMode: (mode: CatalogMode) => void;
  setCustomerType: (type: CustomerType) => void;
  addProduct: (product: PosProduct) => void;
  addByBarcode: (barcode: string) => PosProduct | null;
  updateQuantity: (productId: number, quantity: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
}

/**
 * Get the price for a product based on catalog mode
 */
const getPriceForMode = (product: PosProduct, mode: CatalogMode): number =>
  mode === "wholesale" ? product.wholesale_price : product.retail_price;

export const usePosStore = create<PosState>((set, get) => ({
  products: [],
  cart: [],
  catalogMode: "retail",
  customerType: "walkin",

  setProducts: (products) => set({ products }),

  setCatalogMode: (mode) => set({ catalogMode: mode }),

  setCustomerType: (type) => set({ customerType: type }),

  addProduct: (product) =>
    set((state) => {
      const { catalogMode } = state;
      const lockedPrice = getPriceForMode(product, catalogMode);
      const priceType = catalogMode === "wholesale" ? "W" : "R";
      
      // Check if this exact product with the same price type already exists
      const existing = state.cart.find(
        (item) => item.product_id === product.product_id && item.priceType === priceType
      );
      const maxQty = product.current_stock ?? 0;
      
      if (existing) {
        const nextQty = Math.min(existing.quantity + 1, maxQty || existing.quantity + 1);
        return {
          cart: state.cart.map((item) =>
            item.product_id === product.product_id && item.priceType === priceType
              ? { ...item, quantity: nextQty }
              : item
          ),
        };
      }
      
      // Add new item with locked price
      return {
        cart: [
          ...state.cart,
          { ...product, quantity: Math.min(1, maxQty || 1), lockedPrice, priceType },
        ],
      };
    }),

  addByBarcode: (barcode) => {
    const { products, catalogMode } = get();
    // Find product that matches barcode
    const match = products.find((p) => p.barcode && p.barcode.trim() === barcode.trim());
    
    if (!match) {
      return null;
    }
    
    // Get price for current catalog mode
    const primaryPrice = getPriceForMode(match, catalogMode);
    
    if (primaryPrice > 0) {
      // Primary price is valid, use it
      get().addProduct(match);
      return match;
    }
    
    // Fallback: try the other price type
    const fallbackMode: CatalogMode = catalogMode === "retail" ? "wholesale" : "retail";
    const fallbackPrice = getPriceForMode(match, fallbackMode);
    
    if (fallbackPrice > 0) {
      // Use fallback price - temporarily switch mode for this add
      const originalMode = get().catalogMode;
      get().setCatalogMode(fallbackMode);
      get().addProduct(match);
      get().setCatalogMode(originalMode);
      return match;
    }
    
    // Both prices are 0 - cannot add
    return null;
  },

  updateQuantity: (productId, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return { cart: state.cart.filter((item) => item.product_id !== productId) };
      }
      return {
        cart: state.cart.map((item) =>
          item.product_id === productId ? { ...item, quantity } : item
        ),
      };
    }),

  removeFromCart: (productId) =>
    set((state) => ({ cart: state.cart.filter((item) => item.product_id !== productId) })),

  clearCart: () => set({ cart: [] }),
}));

/**
 * Calculate cart total using locked prices (not affected by catalog mode changes)
 */
export function getCartTotal(cart: PosCartItem[]) {
  return cart.reduce((sum, item) => sum + item.lockedPrice * item.quantity, 0);
}

/**
 * Get the display price for a cart item (uses locked price)
 */
export function getCartItemPrice(item: PosCartItem): number {
  return item.lockedPrice;
}

/**
 * Get display price for a product in the grid (based on current catalog mode)
 */
export function getGridDisplayPrice(product: PosProduct, catalogMode: CatalogMode): number {
  return getPriceForMode(product, catalogMode);
}

/**
 * Filter products for the grid based on catalog mode
 * Only shows products that have a price > 0 for the current mode
 */
export function filterProductsForCatalog(
  products: PosProduct[],
  catalogMode: CatalogMode
): PosProduct[] {
  return products.filter((p) => getPriceForMode(p, catalogMode) > 0);
}

/**
 * Get cart quantity for a specific product (sums all entries for that product)
 */
export function getCartQuantity(cart: PosCartItem[], productId: number): number {
  return cart
    .filter((i) => i.product_id === productId)
    .reduce((sum, i) => sum + i.quantity, 0);
}

/**
 * Calculate visual/remaining stock after cart deduction
 * Used for optimistic stock display on product cards
 */
export function getVisualStock(
  product: PosProduct,
  cart: PosCartItem[]
): number {
  const cartQty = getCartQuantity(cart, product.product_id);
  return Math.max(0, product.current_stock - cartQty);
}

// Legacy compatibility exports (deprecated)
/** @deprecated Use catalogMode instead */
export function getUnitDisplayPrice(item: PosProduct, customerType: CustomerType) {
  return customerType === "vendor" ? item.wholesale_price : item.retail_price;
}







