"use client";

import { create } from "zustand";

export type CustomerType = "walkin" | "vendor";

export interface PosProduct {
  product_id: number;
  product_name: string;
  barcode?: string | null;
  category?: string | null;
  retail_price: number;
  wholesale_price: number;
  current_stock: number;
  image_url?: string | null;
}

export interface PosCartItem extends PosProduct {
  quantity: number;
}

interface PosState {
  products: PosProduct[];
  cart: PosCartItem[];
  customerType: CustomerType;
  setProducts: (products: PosProduct[]) => void;
  setCustomerType: (type: CustomerType) => void;
  addProduct: (product: PosProduct) => void;
  addByBarcode: (barcode: string) => PosProduct | null;
  updateQuantity: (productId: number, quantity: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
}

const getUnitPrice = (product: PosProduct, customerType: CustomerType) =>
  customerType === "vendor" ? product.wholesale_price : product.retail_price;

export const usePosStore = create<PosState>((set, get) => ({
  products: [],
  cart: [],
  customerType: "walkin",

  setProducts: (products) => set({ products }),

  setCustomerType: (type) => set({ customerType: type }),

  addProduct: (product) =>
    set((state) => {
      const existing = state.cart.find((item) => item.product_id === product.product_id);
      const maxQty = product.current_stock ?? 0;
      if (existing) {
        const nextQty = Math.min(existing.quantity + 1, maxQty || existing.quantity + 1);
        return {
          cart: state.cart.map((item) =>
            item.product_id === product.product_id ? { ...item, quantity: nextQty } : item
          ),
        };
      }
      return { cart: [...state.cart, { ...product, quantity: Math.min(1, maxQty || 1) }] };
    }),

  addByBarcode: (barcode) => {
    const { products } = get();
    const match = products.find((p) => p.barcode && p.barcode.trim() === barcode.trim());
    if (match) {
      get().addProduct(match);
      return match;
    }
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

export function getCartTotal(cart: PosCartItem[], customerType: CustomerType) {
  return cart.reduce(
    (sum, item) => sum + getUnitPrice(item, customerType) * item.quantity,
    0
  );
}

export function getUnitDisplayPrice(item: PosProduct, customerType: CustomerType) {
  return getUnitPrice(item, customerType);
}




