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
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  SheetFooter,
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
 * VendorOrderClient - Product catalog with live cart
 * Shows wholesale prices for vendor customers
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

  // Auto-add product from URL param (from dashboard quick add)
  useEffect(() => {
    if (preAddProductId && !hasAddedPreSelectRef.current) {
      const product = products.find((p) => p.product_id === preAddProductId);
      if (product && product.current_stock > 0) {
        // Add to cart
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
        
        // Clean up URL without causing navigation
        window.history.replaceState({}, "", "/vendor/order");
      }
    }
  }, [preAddProductId, products]);
  const [cart, setCart] = useState<LocalCartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { addNotification } = useNotificationStore();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
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

  // Add to cart
  const addToCart = (product: VendorProduct) => {
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
    toast.success(`${product.product_name} added to cart`);
  };

  // Update quantity
  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product_id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
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
        // Show success toast
        toast.success(`Order #${result.orderId} submitted successfully!`, {
          description: "You'll be notified when your order is ready for pickup.",
          duration: 5000,
        });
        
        // Add notification
        addNotification({
          title: "Order Submitted!",
          message: `Your order #${result.orderId} has been submitted and is now being processed.`,
          type: "success",
          href: "/vendor/history",
        });
        
        setCart([]);
        setIsCartOpen(false);
        setIsConfirmOpen(false);
        router.push("/vendor/history");
      } else {
        toast.error(result.error || "Failed to submit order");
      }
    });
  };

  // Get stock status
  const getStockStatus = (stock: number) => {
    if (stock === 0) return { text: "Out of Stock", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
    if (stock < 10) return { text: `${stock} left`, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" };
    return { text: "In Stock", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" };
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Product Catalog</h1>
          <p className="text-muted-foreground">
            Browse products and add to your order
          </p>
        </div>

        {/* Cart Button - Mobile */}
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetTrigger asChild>
            <Button className="relative gap-2 lg:hidden">
              <IconShoppingCart className="size-5" />
              Cart
              {cartItemCount > 0 && (
                <Badge className="absolute -top-2 -right-2 size-6 p-0 flex items-center justify-center rounded-full bg-secondary text-white">
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-[400px] p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle className="flex items-center gap-2">
                <IconShoppingCart className="size-5" />
                Your Cart ({cartItemCount})
              </SheetTitle>
              <SheetDescription>
                Review your order before submitting
              </SheetDescription>
            </SheetHeader>
            <CartContent
              cart={cart}
              cartTotal={cartTotal}
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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[180px]">
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

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Product Grid */}
        <div className="flex-1 min-w-0">
          <ScrollArea className="h-[calc(100vh-280px)]">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <IconPackage className="size-12 mb-4 opacity-50" />
                <p>No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pr-4">
                {filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(product.current_stock);
                  const isOutOfStock = product.current_stock === 0;
                  const inCart = cart.find((item) => item.product_id === product.product_id);

                  return (
                    <Card
                      key={product.product_id}
                      className={`group relative overflow-hidden transition-shadow hover:shadow-md flex flex-col h-full ${isOutOfStock ? "opacity-60" : ""}`}
                    >
                      {/* Product Image */}
                      <div className="aspect-square relative bg-muted overflow-hidden shrink-0">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.product_name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <IconPackage className="size-12 text-muted-foreground/30" />
                          </div>
                        )}
                        <Badge className={`absolute top-2 right-2 text-xs ${stockStatus.color}`}>
                          {stockStatus.text}
                        </Badge>
                        {inCart && (
                          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">
                            {inCart.quantity} in cart
                          </Badge>
                        )}
                      </div>

                      {/* Product Info */}
                      <CardContent className="p-3 flex flex-col flex-1">
                        <p className="font-medium text-sm line-clamp-2 mb-1">
                          {product.product_name}
                        </p>
                        <Badge variant="outline" className="text-xs mb-2 w-fit">
                          {getCategoryDisplayName(product.category)}
                        </Badge>
                        {/* Price & Add Button - Pinned to bottom */}
                        <div className="flex items-end justify-between mt-auto pt-2">
                          <div>
                            <p className="text-lg font-bold text-primary">
                              {formatCurrency(product.wholesale_price)}
                            </p>
                            {/* Only show retail price crossed out if different from wholesale */}
                            {product.wholesale_price < product.retail_price && (
                              <p className="text-xs text-muted-foreground line-through">
                                {formatCurrency(product.retail_price)}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addToCart(product)}
                            disabled={isOutOfStock}
                            className="shrink-0"
                          >
                            <IconPlus className="size-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Desktop Cart Sidebar */}
        <Card className="hidden lg:flex flex-col w-80 shrink-0">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <IconShoppingCart className="size-5" />
              Your Cart ({cartItemCount})
            </CardTitle>
            <CardDescription>Review your order</CardDescription>
          </CardHeader>
          <CartContent
            cart={cart}
            cartTotal={cartTotal}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            clearCart={clearCart}
            onSubmit={() => setIsConfirmOpen(true)}
            formatCurrency={formatCurrency}
            isDesktop
          />
        </Card>
      </div>

      {/* Confirm Order Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Order</DialogTitle>
            <DialogDescription>
              You are about to submit an order for {cartItemCount} item{cartItemCount !== 1 ? "s" : ""} totaling{" "}
              {formatCurrency(cartTotal)}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Your order will be reviewed and prepared by our team. You will be notified when it&apos;s ready for pickup.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitOrder}
              disabled={isPending}
              className="gap-2"
            >
              {isPending ? (
                <>
                  <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
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

// Cart Content Component
function CartContent({
  cart,
  cartTotal,
  updateQuantity,
  removeFromCart,
  clearCart,
  onSubmit,
  formatCurrency,
  isDesktop = false,
}: {
  cart: LocalCartItem[];
  cartTotal: number;
  updateQuantity: (productId: number, delta: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  onSubmit: () => void;
  formatCurrency: (amount: number) => string;
  isDesktop?: boolean;
}) {
  if (cart.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground">
        <IconShoppingCart className="size-12 mb-4 opacity-50" />
        <p>Your cart is empty</p>
        <p className="text-sm">Add products to get started</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className={isDesktop ? "flex-1" : "h-[calc(100vh-320px)]"}>
        <div className="divide-y">
          {cart.map((item) => (
            <div key={item.product_id} className="flex items-center gap-3 p-4">
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
                    <IconPackage className="size-6 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm line-clamp-1">{item.product_name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-primary font-mono">
                    {formatCurrency(item.price)}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    • {item.current_stock} in stock
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={() => updateQuantity(item.product_id, -1)}
                  >
                    <IconMinus className="size-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={() => updateQuantity(item.product_id, 1)}
                  >
                    <IconPlus className="size-3" />
                  </Button>
                </div>
              </div>

              {/* Subtotal & Remove */}
              <div className="text-right">
                <p className="font-mono font-medium">
                  {formatCurrency(item.price * item.quantity)}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => removeFromCart(item.product_id)}
                >
                  <IconTrash className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">Total</span>
          <span className="text-xl font-bold text-primary">
            {formatCurrency(cartTotal)}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={clearCart} className="flex-1">
            <IconX className="size-4 mr-2" />
            Clear
          </Button>
          <Button onClick={onSubmit} className="flex-1 gap-2">
            <IconCheck className="size-4" />
            Submit Order
          </Button>
        </div>
      </div>
    </>
  );
}

