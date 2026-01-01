"use client";

import { useState, useMemo, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  IconSearch,
  IconShoppingCart,
  IconPlus,
  IconMinus,
  IconTrash,
  IconX,
  IconCheck,
  IconPackage,
  IconArrowLeft,
  IconReceipt,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { VendorProduct, CartItem } from "@/actions/vendor";
import { createVendorOrder } from "@/actions/vendor";
import { useNotificationStore } from "@/stores/use-notification-store";

// Category display name mapping (database value -> UI-friendly name)
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  "SOFTDRINKS_CASE": "Soft Drinks Case",
  "BEVERAGES": "Beverages",
  "CANNED_GOODS": "Canned Goods",
  "CONDIMENTS": "Condiments",
  "DAIRY": "Dairy",
  "SNACK": "Snacks",
  "SODA": "Soft Drinks",
  "BREAD": "Bread & Bakery",
  "FROZEN": "Frozen Foods",
  "HOUSEHOLD": "Household Items",
  "PERSONAL_CARE": "Personal Care",
  "INSTANT_NOODLES": "Instant Noodles",
  "OTHER": "Other",
};

// Get UI-friendly category name
const getCategoryDisplayName = (category: string): string => {
  return CATEGORY_DISPLAY_NAMES[category] || category.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
};

interface VendorOrderClientProps {
  products: VendorProduct[];
  categories: string[];
  customerId: number;
  /** Product ID to auto-add to cart (from dashboard quick add) */
  preAddProductId?: number;
}

interface LocalCartItem extends CartItem {
  image_url: string | null;
  current_stock: number;
}

/**
 * VendorOrderClient - Mini POS experience for vendor ordering
 * Clean white backgrounds, uniform cards, sticky cart footer
 */
export function VendorOrderClient({
  products,
  categories,
  customerId,
  preAddProductId,
}: VendorOrderClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const hasAddedPreSelectRef = useRef(false);
  const [cart, setCart] = useState<LocalCartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { addNotification } = useNotificationStore();

  // Auto-add product from URL param (from dashboard quick add)
  useEffect(() => {
    if (preAddProductId && !hasAddedPreSelectRef.current) {
      const product = products.find((p) => p.product_id === preAddProductId);
      if (product && product.current_stock > 0) {
        setCart((prev) => {
          const existing = prev.find((item) => item.product_id === product.product_id);
          if (existing) {
            return prev.map((item) =>
              item.product_id === product.product_id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            );
          }
          return [
            ...prev,
            {
              product_id: product.product_id,
              product_name: product.product_name,
              quantity: 1,
              price: product.wholesale_price,
              image_url: product.image_url,
              current_stock: product.current_stock,
            },
          ];
        });
        toast.success(`${product.product_name} added to cart!`);
        hasAddedPreSelectRef.current = true;
        window.history.replaceState({}, "", "/vendor/order");
      }
    }
  }, [preAddProductId, products]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Cart calculations
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Add to cart - FIXED: Check stock BEFORE adding to prevent toast spam
  const addToCart = (product: VendorProduct) => {
    // Check stock first - before any state updates
    const existingItem = cart.find((item) => item.product_id === product.product_id);
    const currentQty = existingItem?.quantity ?? 0;
    
    if (currentQty >= product.current_stock) {
      toast.error(`Maximum stock (${product.current_stock}) reached`);
      return; // Exit early - no success toast
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.product_id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.product_id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.product_id,
          product_name: product.product_name,
          quantity: 1,
          price: product.wholesale_price,
          image_url: product.image_url,
          current_stock: product.current_stock,
        },
      ];
    });
    toast.success(`${product.product_name} added`);
  };

  // Subtract from cart (for product grid controls)
  const subtractFromCart = (productId: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product_id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  // Update quantity
  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = Math.max(0, item.quantity + delta);
            if (newQty > item.current_stock) {
              toast.error(`Maximum stock (${item.current_stock}) reached`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  // Remove from cart
  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setIsCartOpen(false);
  };

  // Submit order
  const handleSubmitOrder = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    startTransition(async () => {
      const result = await createVendorOrder(customerId, cart);

      if (result.success) {
        toast.success(`Order #${result.orderId} submitted!`, {
          description: "You'll be notified when ready for pickup.",
          duration: 5000,
        });
        
        addNotification({
          title: "Order Submitted!",
          message: `Order #${result.orderId} is being processed.`,
          type: "success",
          href: "/vendor/history",
        });
        
        setCart([]);
        setIsCartOpen(false);
        setIsConfirmOpen(false);
        router.push("/vendor");
      } else {
        // Handle stock issues specifically
        if (result.stockIssues && result.stockIssues.length > 0) {
          toast.error("Stock Changed!", {
            description: result.stockIssues.join(". "),
            duration: 8000,
          });
        } else {
          toast.error(result.error || "Failed to submit order");
        }
      }
    });
  };

  // Get stock status - Show exact count
  const getStockStatus = (stock: number) => {
    if (stock === 0) return { text: "Out of Stock", color: "bg-red-500 text-white" };
    if (stock < 5) return { text: `Only ${stock} left!`, color: "bg-red-500 text-white" };
    if (stock < 10) return { text: `${stock} left`, color: "bg-amber-500 text-white" };
    return { text: `${stock} in stock`, color: "bg-emerald-500 text-white" };
  };

  // Tax calculations for confirm dialog
  const taxAmount = cartTotal * 0.12;
  const totalWithTax = cartTotal + taxAmount;

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex flex-col gap-0 pb-2">
        <div className="flex items-center gap-0">
      

          {/* Cart Button - Mobile */}
          <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
            <SheetTrigger asChild>
             
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-[400px] p-0 flex flex-col m-0 bg-card">
              <SheetHeader className="px-4 py-3 mb-0 border-b border-border bg-card">
                <SheetTitle className="flex items-center gap-2 text-foreground">
                  <IconShoppingCart className="size-5" />
                  Your Cart ({cartItemCount})
                </SheetTitle>
              </SheetHeader>
              <CartContent
                cart={cart}
                cartTotal={cartTotal}
                cartItemCount={cartItemCount}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
                clearCart={clearCart}
                onSubmit={() => setIsConfirmOpen(true)}
                formatCurrency={formatCurrency}
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
            <Input
              placeholder="Search products"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 py-2 bg-card border-border"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[180px] bg-card border-border">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {getCategoryDisplayName(cat)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Product Grid */}
        <div className="flex-1 min-w-0 overflow-y-auto h-[calc(100vh-260px)] lg:h-[calc(120vh-220px)] pb-0 lg:pb-2 md:pb-2">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
                <IconPackage className="size-16 mb-4 opacity-50" />
                <p className="font-medium">No products found</p>
                <p className="text-sm">Try adjusting your search or filter</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
                {filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(product.current_stock);
                  const isOutOfStock = product.current_stock === 0;
                  const inCart = cart.find((item) => item.product_id === product.product_id);
                  const hasSavings = product.wholesale_price < product.retail_price;

                  return (
                    <div
                      key={product.product_id}
                      className={cn(
                        "bg-card rounded-xl overflow-hidden flex flex-col transition-all relative",
                        isOutOfStock && "opacity-60",
                        inCart 
                          ? "border-2 border-[#AC0F16]"
                          : "border border-border"
                      )}
                    >
                      {/* Quantity Badge - Top Left Circle */}
                      {inCart && (
                        <div className="absolute top-2 left-2 z-10 size-7 rounded-full bg-[#AC0F16] text-white flex items-center justify-center text-xs font-bold shadow-md">
                          {inCart.quantity}
                        </div>
                      )}
                      
                      {/* Product Image - Clean with minimal overlays */}
                      <div className="aspect-square relative bg-zinc-100 dark:bg-zinc-800">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.product_name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <IconPackage className="size-12 text-zinc-300 dark:text-zinc-600" />
                          </div>
                        )}

                        {/* Savings Badge - Only essential overlay */}
                        {hasSavings && !isOutOfStock && (
                          <Badge className="absolute bottom-2 left-2 bg-emerald-500 text-white text-[10px]">
                            Save {Math.round(((product.retail_price - product.wholesale_price) / product.retail_price) * 100)}%
                          </Badge>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="p-3 flex flex-col flex-1">
                        <p className="font-medium text-sm text-[#2d1b1a] dark:text-white line-clamp-2 h-10 leading-tight">
                          {product.product_name}
                        </p>
                        {/* Category */}
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                          {getCategoryDisplayName(product.category)}
                        </p>
                        {/* Stock Badge */}
                        <Badge className={cn("w-fit mt-1 text-[10px] px-1.5 py-0.5", stockStatus.color)}>
                          {stockStatus.text}
                        </Badge>

                        <div className="flex mt-1.5 items-center justify-between gap-2">
                          <div>
                            <p className="text-base font-bold text-[#AC0F16]">
                              {formatCurrency(product.wholesale_price)}
                            </p>
                            {hasSavings && (
                              <p className="text-[10px] text-zinc-400 line-through">
                                {formatCurrency(product.retail_price)}
                              </p>
                            )}
                          </div>
                          
                          {/* Quantity Controls - Circle buttons */}
                          {inCart ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => subtractFromCart(product.product_id)}
                                className="size-8 rounded-full"
                              >
                                <IconMinus className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                onClick={() => addToCart(product)}
                                disabled={inCart.quantity >= product.current_stock}
                                className={cn(
                                  "size-8 rounded-full",
                                  inCart.quantity >= product.current_stock
                                    ? "bg-zinc-300 text-zinc-500"
                                    : "bg-[#AC0F16] hover:bg-[#8a0c12] text-white"
                                )}
                              >
                                <IconPlus className="size-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="icon"
                              onClick={() => addToCart(product)}
                              disabled={isOutOfStock}
                              className={cn(
                                "size-8 rounded-full",
                                isOutOfStock 
                                  ? "bg-zinc-300 text-zinc-500" 
                                  : "bg-[#AC0F16] hover:bg-[#8a0c12] text-white"
                              )}
                            >
                              <IconPlus className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Desktop Cart Sidebar */}
        <div className="hidden lg:flex flex-col w-80 shrink-0 bg-card rounded-2xl border border-border overflow-hidden h-[calc(120vh-220px)]">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <h2 className="font-semibold text-lg flex items-center gap-2 text-foreground">
              <IconShoppingCart className="size-5" />
              Your Cart ({cartItemCount})
            </h2>
          </div>
          <CartContent
            cart={cart}
            cartTotal={cartTotal}
            cartItemCount={cartItemCount}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            clearCart={clearCart}
            onSubmit={() => setIsConfirmOpen(true)}
            formatCurrency={formatCurrency}
            isDesktop
          />
        </div>
      </div>

      {/* Mobile Sticky Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 shadow-lg z-50">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-zinc-500">{cartItemCount} items</p>
              <p className="text-lg font-bold text-[#AC0F16]">
                {formatCurrency(cartTotal)}
              </p>
            </div>
            <Button
              onClick={() => setIsCartOpen(true)}
              className="flex-1 max-w-[200px] bg-[#AC0F16] hover:bg-[#8a0c12] text-white gap-2"
              size="lg"
            >
              <IconReceipt className="size-5" />
              View Cart
            </Button>
          </div>
        </div>
      )}

      {/* Confirm Order Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#2d1b1a] dark:text-white">
              Confirm Order
            </DialogTitle>
            <DialogDescription>
              You are about to submit an order for {cartItemCount} item{cartItemCount !== 1 ? "s" : ""}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-500">Subtotal ({cartItemCount} items)</span>
                <span className="font-medium">{formatCurrency(cartTotal)}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-500">Tax (12% VAT)</span>
                <span className="font-medium">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-2">
                <span className="font-semibold text-[#2d1b1a] dark:text-white">Total</span>
                <span className="text-xl font-bold text-[#AC0F16]">
                  {formatCurrency(totalWithTax)}
                </span>
              </div>
            </div>
            
            {/* Pickup Policy Disclaimer */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium mb-1">
                📦 Pickup Policy
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Please pick up your order within 24 hours. Unclaimed orders may be cancelled and items restocked.
              </p>
            </div>
            
            <p className="text-xs text-zinc-500 text-center">
              Your order will be reviewed and prepared. You&apos;ll be notified when it&apos;s ready for pickup.
            </p>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitOrder}
              disabled={isPending}
              className="bg-[#AC0F16] hover:bg-[#8a0c12] text-white gap-2"
            >
              {isPending ? (
                <>
                  <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <IconCheck className="size-4" />
                  Submit Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Tax rate (12% VAT)
const TAX_RATE = 0.12;

// Cart Content Component
function CartContent({
  cart,
  cartTotal,
  cartItemCount,
  updateQuantity,
  removeFromCart,
  clearCart,
  onSubmit,
  formatCurrency,
  isDesktop = false,
}: {
  cart: LocalCartItem[];
  cartTotal: number;
  cartItemCount: number;
  updateQuantity: (productId: number, delta: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  onSubmit: () => void;
  formatCurrency: (amount: number) => string;
  isDesktop?: boolean;
}) {
  // Calculate tax and total
  const taxAmount = cartTotal * TAX_RATE;
  const totalWithTax = cartTotal + taxAmount;

  if (cart.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-zinc-400">
        <IconShoppingCart className="size-16 mb-4 opacity-50" />
        <p className="font-medium">Your cart is empty</p>
        <p className="text-sm">Add products to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-card">
      {/* Cart items - maximized content area */}
      <div className={cn(
        "flex-1 overflow-y-auto",
        !isDesktop && "max-h-[calc(100vh-340px)]"
      )}>
        <div className="p-3 space-y-2">
          {cart.map((item) => (
            <div 
              key={item.product_id} 
              className="bg-card rounded-xl p-3 shadow-sm border border-border"
            >
              <div className="flex items-start gap-3">
                {/* Image */}
                <div className="size-14 rounded-lg bg-muted overflow-hidden shrink-0">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.product_name}
                      width={56}
                      height={56}
                      className="object-cover size-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <IconPackage className="size-5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground line-clamp-2 leading-tight">
                    {item.product_name}
                  </p>
                  <p className="text-sm text-[#AC0F16] font-bold mt-1">
                    {formatCurrency(item.price)}
                  </p>
                </div>

                {/* Subtotal */}
                <div className="text-right shrink-0">
                  <p className="font-bold text-foreground text-sm">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </div>
              </div>
              
              {/* Quantity Controls */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-full"
                    onClick={() => updateQuantity(item.product_id, -1)}
                  >
                    <IconMinus className="size-3" />
                  </Button>
                  <span className="w-8 text-center font-semibold text-foreground">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-full"
                    onClick={() => updateQuantity(item.product_id, 1)}
                  >
                    <IconPlus className="size-3" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 gap-1"
                  onClick={() => removeFromCart(item.product_id)}
                >
                  <IconTrash className="size-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Footer - Fixed at bottom */}
      <div className="shrink-0 border-t border-border p-4 bg-card shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        {/* Clear All Button */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 gap-1.5 h-8 mb-3"
            >
              <IconTrash className="size-4" />
              Clear All
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Cart?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure? This will remove all {cart.length} item{cart.length !== 1 ? "s" : ""} from your cart.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={clearCart}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Clear All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* Order Summary */}
        <div className="space-y-1.5 mb-3 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Items ({cartItemCount})</span>
            <span>{formatCurrency(cartTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Tax (12% VAT)</span>
            <span>{formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-border">
            <span className="font-semibold text-foreground">Total</span>
            <span className="text-xl font-bold text-[#AC0F16]">
              {formatCurrency(totalWithTax)}
            </span>
          </div>
        </div>
        
        <Button 
          onClick={onSubmit} 
          className="w-full bg-[#AC0F16] hover:bg-[#8a0c12] text-white gap-2 min-h-[48px] text-base"
        >
          <IconCheck className="size-5" />
          Submit Order
        </Button>
      </div>
    </div>
  );
}

