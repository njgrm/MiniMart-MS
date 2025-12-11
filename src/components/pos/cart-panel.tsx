"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Trash2, UserCircle2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { usePosStore, getUnitDisplayPrice, getCartTotal } from "@/stores/use-pos-store";
import { createTransaction } from "@/actions/transaction";

export function CartPanel() {
  const {
    cart,
    customerType,
    setCustomerType,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = usePosStore();

  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "GCASH">("CASH");
  const [amountTendered, setAmountTendered] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cartTotal = useMemo(() => getCartTotal(cart, customerType), [cart, customerType]);

  const change = useMemo(() => {
    const tendered = parseFloat(amountTendered || "0");
    return tendered > cartTotal ? tendered - cartTotal : 0;
  }, [amountTendered, cartTotal]);

  const canCheckout = cart.length > 0 && parseFloat(amountTendered || "0") >= cartTotal;

  const handleCheckout = async () => {
    if (!canCheckout) return;
    setIsSubmitting(true);
    try {
      await createTransaction({
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: getUnitDisplayPrice(item, customerType),
        })),
        customerType,
        paymentMethod,
        amountTendered: parseFloat(amountTendered),
        change,
      });
      clearCart();
      setAmountTendered("");
    } catch (error) {
      console.error("Failed to process transaction", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header - compact */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <h2 className="text-sm font-semibold">Cart</h2>
        <Tabs
          value={customerType}
          onValueChange={(val) => setCustomerType(val as "walkin" | "vendor")}
        >
          <TabsList className="h-8">
            <TabsTrigger value="walkin" className="gap-1 text-xs px-2 h-7">
              <UserCircle2 className="h-3.5 w-3.5" /> Walk-in
            </TabsTrigger>
            <TabsTrigger value="vendor" className="gap-1 text-xs px-2 h-7">
              <Store className="h-3.5 w-3.5" /> Vendor
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Items list - flex-1 to fill space */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {cart.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <p className="text-xs">No items in cart</p>
          </div>
        ) : (
          cart.map((item) => {
            const unitPrice = getUnitDisplayPrice(item, customerType);
            return (
              <div
                key={item.product_id}
                className="flex items-center gap-2 rounded-md border border-border bg-card p-2"
              >
                {/* Thumbnail */}
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-muted">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.product_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[8px] text-muted-foreground">
                      No img
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{item.product_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    ₱{unitPrice.toFixed(2)} × {item.quantity}
                  </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-5 text-center text-xs font-semibold">{item.quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {/* Subtotal & Delete */}
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs w-14 text-right">
                    ₱{(unitPrice * item.quantity).toFixed(2)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFromCart(item.product_id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer - payment section */}
      <div className="border-t border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Items: {cart.reduce((acc, item) => acc + item.quantity, 0)}</span>
          <span className="font-mono">Subtotal: ₱{cartTotal.toFixed(2)}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Total</span>
          <span className="font-mono text-lg text-primary">₱{cartTotal.toFixed(2)}</span>
        </div>

        <Button
          className="w-full h-10 text-sm font-semibold"
          disabled={cart.length === 0 || isSubmitting}
          onClick={handleCheckout}
        >
          {isSubmitting ? "Processing..." : "Process Payment"}
        </Button>
      </div>
    </div>
  );
}
