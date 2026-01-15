  "use client";

  import { useMemo, useState, useRef } from "react";
  import { Minus, Plus, Trash2, Percent, ChevronDown, XCircle } from "lucide-react";
  import { Button } from "@/components/ui/button";
  import { Separator } from "@/components/ui/separator";
  import { Input } from "@/components/ui/input";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { cn } from "@/lib/utils";
  import { usePosStore, getCartTotal, getCartItemPrice } from "@/stores/use-pos-store";
  import { createTransaction } from "@/actions/transaction";
  import { PaymentDialog } from "./payment-dialog";
  import { ReceiptTemplate } from "./receipt-template";

  // Discount types
  type DiscountType = "none" | "senior_pwd" | "custom";

  const discountOptions: { value: DiscountType; label: string; percent: number }[] = [
    { value: "none", label: "No Discount", percent: 0 },
    { value: "senior_pwd", label: "Senior/PWD (20%)", percent: 20 },
    { value: "custom", label: "Custom", percent: 0 },
  ];

  // Tax rate (Philippines VAT)
  const TAX_RATE = 0.12; // 12%

  // Generate receipt number
  function generateReceiptNumber() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    return `RCP-${date}-${random}`;
  }

  interface ReceiptData {
    receiptNumber: string;
    date: Date;
    cashierName: string;
    items: { 
      name: string; 
      barcode?: string; 
      quantity: number; 
      price: number; 
      subtotal: number; 
      priceType?: "R" | "W" 
    }[];
    subtotal: number;
    discountPercent: number;
    discountAmount: number;
    taxAmount: number;
    totalDue: number;
    amountTendered: number;
    change: number;
    paymentMethod: "CASH" | "GCASH";
  }

  interface CartPanelProps {
    /** GCash QR code URL from store settings */
    gcashQrUrl?: string | null;
  }

  export function CartPanel({ gcashQrUrl }: CartPanelProps) {
    const {
      cart,
      customerType,
      updateQuantity,
      removeFromCart,
      clearCart,
    } = usePosStore();

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Discount state
    const [discountType, setDiscountType] = useState<DiscountType>("none");
    const [customDiscountPercent, setCustomDiscountPercent] = useState<string>("");

    // Payment dialog state
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    
    // Receipt data for printing
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);

    // Calculate subtotal using locked prices (not affected by catalog mode changes)
    const subtotal = useMemo(() => getCartTotal(cart), [cart]);

    // Calculate discount amount
    const discountPercent = useMemo(() => {
      if (discountType === "none") return 0;
      if (discountType === "senior_pwd") return 20;
      if (discountType === "custom") {
        const parsed = parseFloat(customDiscountPercent || "0");
        return Math.min(Math.max(parsed, 0), 100); // Clamp between 0-100
      }
      return 0;
    }, [discountType, customDiscountPercent]);

    const discountAmount = useMemo(() => {
      return (subtotal * discountPercent) / 100;
    }, [subtotal, discountPercent]);

    // Calculate tax (on discounted amount)
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = useMemo(() => {
      return taxableAmount * TAX_RATE;
    }, [taxableAmount]);

    // Calculate final total
    const totalDue = useMemo(() => {
      return taxableAmount + taxAmount;
    }, [taxableAmount, taxAmount]);

    const itemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    const currentDiscountOption = discountOptions.find((d) => d.value === discountType) || discountOptions[0];

    // Handle payment confirmation
    const handlePaymentConfirm = async (
      paymentMethod: "CASH" | "GCASH",
      amountTendered: number,
      gcashRefNo?: string
    ) => {
      setIsSubmitting(true);
      
      try {
        // Create the transaction using locked prices from cart items
        const result = await createTransaction({
          items: cart.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: getCartItemPrice(item), // Use locked price
          })),
          customerType,
          paymentMethod,
          amountTendered,
          change: amountTendered - totalDue,
          discountPercent: discountPercent > 0 ? discountPercent : undefined,
          discountAmount: discountAmount > 0 ? discountAmount : undefined,
          taxAmount,
        });

        if (!result.success) {
          console.error("Transaction failed:", result.error);
          return;
        }

        // Prepare receipt data using locked prices
        const receipt: ReceiptData = {
          receiptNumber: result.receiptNo || generateReceiptNumber(), // Use generated receipt number from transaction
          date: new Date(),
          cashierName: "Admin", // TODO: Get from session
          items: cart.map((item) => ({
            name: item.product_name,
            barcode: item.barcode || undefined, // Include barcode for receipt
            quantity: item.quantity,
            price: getCartItemPrice(item), // Use locked price
            subtotal: getCartItemPrice(item) * item.quantity,
            priceType: item.priceType, // Include price type for receipt
          })),
          subtotal,
          discountPercent,
          discountAmount,
          taxAmount,
          totalDue,
          amountTendered,
          change: amountTendered - totalDue,
          paymentMethod,
        };

        setReceiptData(receipt);
        
        // Close the payment dialog
        setPaymentDialogOpen(false);

        // Small delay to ensure receipt is rendered, then print
        setTimeout(() => {
          window.print();
          
          // After printing, clear the cart and reset state
          clearCart();
          setDiscountType("none");
          setCustomDiscountPercent("");
          setReceiptData(null);
        }, 100);

      } catch (error) {
        console.error("Failed to process transaction", error);
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <>
        <div className="h-full flex flex-col overflow-hidden">
          {/* Header - compact */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Cart</h2>
              <span className="text-xs text-muted-foreground">({itemCount} items)</span>
            </div>
            {/* Clear All Button - only visible when cart has items */}
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 py-1 text-xs text-muted-foreground hover:text-destructive gap-1"
                onClick={clearCart}
              >
                <XCircle className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>

          {/* Items list - flex-1 to fill space */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <p className="text-xs">No items in cart</p>
              </div>
            ) : (
              cart.map((item, index) => {
                const unitPrice = getCartItemPrice(item); // Use locked price
                return (
                  <div
                    key={`${item.product_id}-${item.priceType}-${index}`}
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
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-medium text-foreground truncate">{item.product_name}</p>
                        {/* Price type badge */}
                        <span
                          className={cn(
                            "text-[8px] font-bold px-1 py-0.5 rounded flex-shrink-0",
                            item.priceType === "W"
                              ? "bg-secondary/20 text-secondary"
                              : "bg-primary/10 text-primary dark:text-primary"
                          )}
                        >
                          {item.priceType}
                        </span>
                      </div>
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
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          if (val >= 0) updateQuantity(item.product_id, val);
                        }}
                        className="w-10 h-6 text-center text-xs font-semibold p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        min="0"
                      />
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
                      <span className="font-mono text-xs w-14 text-right text-foreground">
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

          {/* Footer - payment section with proper hierarchy */}
          <div className="border-t border-border bg-card p-3 space-y-3">
            {/* Subtotal */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">₱{subtotal.toFixed(2)}</span>
            </div>

            {/* Discount Section */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Discount</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2">
                      <Percent className="h-3 w-3" />
                      {currentDiscountOption.label}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {discountOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => setDiscountType(option.value)}
                        className={cn(
                          "text-xs",
                          discountType === option.value && "bg-primary/50"
                        )}
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {discountType === "custom" ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={customDiscountPercent}
                    onChange={(e) => setCustomDiscountPercent(e.target.value)}
                    placeholder="0"
                    className="h-7 w-14 text-xs text-right font-mono"
                    min="0"
                    max="100"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              ) : discountPercent > 0 ? (
                <span className="font-mono text-secondary">-₱{discountAmount.toFixed(2)}</span>
              ) : (
                <span className="font-mono text-muted-foreground">₱0.00</span>
              )}
            </div>

            {/* Show custom discount amount */}
            {discountType === "custom" && discountPercent > 0 && (
              <div className="flex items-center justify-end text-sm">
                <span className="font-mono text-secondary">-₱{discountAmount.toFixed(2)}</span>
              </div>
            )}

            {/* Tax (VAT 12%) */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">VAT (12%)</span>
              <span className="font-mono">₱{taxAmount.toFixed(2)}</span>
            </div>

            <Separator />

            {/* Total Due - Large & Bold with Dark Mode Contrast Fix */}
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold">Total Due</span>
              <span className="font-mono text-2xl font-medium text-primary dark:text-foreground">
                ₱{totalDue.toFixed(2)}
              </span>
            </div>

            {/* Process Transaction Button */}
            <Button
              className="w-full h-11 text-sm font-semibold"
              disabled={cart.length === 0 || isSubmitting}
              onClick={() => setPaymentDialogOpen(true)}
            >
              {isSubmitting ? "Processing..." : `Process Transaction`}
            </Button>
          </div>
        </div>

        {/* Payment Dialog */}
        <PaymentDialog
          open={paymentDialogOpen}
          onClose={() => setPaymentDialogOpen(false)}
          onConfirm={handlePaymentConfirm}
          itemCount={itemCount}
          subtotal={subtotal}
          discountPercent={discountPercent}
          discountAmount={discountAmount}
          taxAmount={taxAmount}
          totalDue={totalDue}
          initialGcashQrUrl={gcashQrUrl}
        />

        {/* Hidden Receipt Template for Printing */}
        <ReceiptTemplate ref={receiptRef} data={receiptData} />
      </>
    );
  }
