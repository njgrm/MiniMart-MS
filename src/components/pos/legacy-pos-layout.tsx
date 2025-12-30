"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  Minus,
  Plus,
  Keyboard,
  ScanBarcode,
  XCircle,
  DollarSign,
  Package,
  Hash,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Delete,
  Search,
  Calculator,
  Percent,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  usePosStore,
  getCartTotal,
  getCartItemPrice,
  type PosProduct,
  type PosCartItem,
} from "@/stores/use-pos-store";
import { usePosLayoutStore } from "@/stores/use-pos-layout-store";
import { usePosAudio } from "@/hooks/use-pos-audio";
import { PaymentDialog } from "@/components/pos/payment-dialog";
import { ReceiptTemplate } from "@/components/pos/receipt-template";
import { createTransaction } from "@/actions/transaction";
import { toast } from "sonner";

// Discount types
type DiscountType = "none" | "senior_pwd" | "custom";

const discountOptions: { value: DiscountType; label: string; percent: number }[] = [
  { value: "none", label: "No Discount", percent: 0 },
  { value: "senior_pwd", label: "Senior/PWD (20%)", percent: 20 },
  { value: "custom", label: "Custom", percent: 0 },
];

// Tax rate (Philippines VAT)
const TAX_RATE = 0.12;

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
    priceType?: "R" | "W";
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

// Keyboard shortcuts configuration
const keyboardShortcuts = [
  { key: "Enter", description: "Add item / Process payment", icon: CornerDownLeft },
  { key: "↑ / ↓", description: "Navigate items", icon: ArrowUp },
  { key: "+ / -", description: "Adjust quantity", icon: Calculator },
  { key: "Delete", description: "Remove selected item", icon: Delete },
  { key: "Esc", description: "Clear input / Void all", icon: XCircle },
  { key: "F2", description: "Search products", icon: Search },
];

interface LegacyPOSLayoutProps {
  products: PosProduct[];
  gcashQrUrl?: string | null;
}

export function LegacyPOSLayout({ products, gcashQrUrl }: LegacyPOSLayoutProps) {
  // State
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<PosProduct[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [customDiscountPercent, setCustomDiscountPercent] = useState<string>("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [typingAnimation, setTypingAnimation] = useState<{
    text: string;
    visible: boolean;
  }>({ text: "", visible: false });

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Stores
  const {
    cart,
    customerType,
    addByBarcode,
    updateQuantity,
    removeFromCart,
    clearCart,
    setProducts,
  } = usePosStore();
  const {
    selectedItemIndex,
    setSelectedItemIndex,
    lastAddedItemId,
    setLastAddedItemId,
  } = usePosLayoutStore();

  // Audio
  const { playSuccessBeep, playErrorBuzz, playConfirmSound } = usePosAudio();

  // Initialize products
  useEffect(() => {
    setProducts(products);
  }, [products, setProducts]);

  // Calculate totals
  const subtotal = useMemo(() => getCartTotal(cart), [cart]);
  
  const discountPercent = useMemo(() => {
    if (discountType === "none") return 0;
    if (discountType === "senior_pwd") return 20;
    if (discountType === "custom") {
      const parsed = parseFloat(customDiscountPercent || "0");
      return Math.min(Math.max(parsed, 0), 100);
    }
    return 0;
  }, [discountType, customDiscountPercent]);

  const discountAmount = useMemo(() => (subtotal * discountPercent) / 100, [subtotal, discountPercent]);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = useMemo(() => taxableAmount * TAX_RATE, [taxableAmount]);
  const totalDue = useMemo(() => taxableAmount + taxAmount, [taxableAmount, taxAmount]);
  const itemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const currentDiscountOption = discountOptions.find((d) => d.value === discountType) || discountOptions[0];

  // Typing animation effect
  const showTypingAnimation = useCallback((productName: string) => {
    setTypingAnimation({ text: "", visible: true });
    
    let index = 0;
    const typeInterval = setInterval(() => {
      if (index < productName.length) {
        setTypingAnimation(prev => ({
          text: productName.slice(0, index + 1),
          visible: true,
        }));
        index++;
      } else {
        clearInterval(typeInterval);
        // Hide after a brief pause
        setTimeout(() => {
          setTypingAnimation({ text: "", visible: false });
        }, 500);
      }
    }, 30); // Fast typing speed
  }, []);

  // Handle barcode input
  const handleBarcodeSubmit = useCallback(() => {
    if (!barcodeInput.trim()) {
      // Empty input + items in cart = open payment dialog
      if (cart.length > 0) {
        setPaymentDialogOpen(true);
      }
      return;
    }

    if (isSearchMode) {
      // In search mode, filter products by name
      const results = products.filter(
        (p) =>
          p.product_name.toLowerCase().includes(barcodeInput.toLowerCase()) ||
          (p.barcode ?? "").toLowerCase().includes(barcodeInput.toLowerCase())
      );
      setSearchResults(results);
      if (results.length === 1) {
        // Single result - add it
        const found = addByBarcode(results[0].barcode || "");
        if (found) {
          playSuccessBeep();
          showTypingAnimation(found.product_name);
          setLastAddedItemId(found.product_id);
          setSelectedItemIndex(cart.length); // Select the new item
          setTimeout(() => setLastAddedItemId(null), 1500);
        }
        setBarcodeInput("");
        setIsSearchMode(false);
        setSearchResults([]);
      }
    } else {
      // Normal barcode mode
      const found = addByBarcode(barcodeInput.trim());
      if (found) {
        playSuccessBeep();
        showTypingAnimation(found.product_name);
        setLastAddedItemId(found.product_id);
        // Find the index of the added item
        const existingIndex = cart.findIndex((item) => item.product_id === found.product_id);
        if (existingIndex >= 0) {
          setSelectedItemIndex(existingIndex);
        } else {
          setSelectedItemIndex(cart.length); // Will be added at the end
        }
        setTimeout(() => setLastAddedItemId(null), 1500);
      } else {
        playErrorBuzz();
        toast.error(`Product not found: ${barcodeInput.trim()}`, {
          description: "The scanned barcode does not match any product.",
        });
      }
      setBarcodeInput("");
    }
  }, [
    barcodeInput,
    cart,
    products,
    isSearchMode,
    addByBarcode,
    playSuccessBeep,
    playErrorBuzz,
    showTypingAnimation,
    setLastAddedItemId,
    setSelectedItemIndex,
  ]);

  // Global keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if payment dialog is open
      if (paymentDialogOpen) return;

      // F2 - Toggle search mode
      if (e.key === "F2") {
        e.preventDefault();
        setIsSearchMode((prev) => !prev);
        setBarcodeInput("");
        setSearchResults([]);
        inputRef.current?.focus();
        return;
      }

      // Escape - Clear input or void transaction
      if (e.key === "Escape") {
        e.preventDefault();
        if (barcodeInput) {
          setBarcodeInput("");
          setIsSearchMode(false);
          setSearchResults([]);
        } else if (cart.length > 0) {
          // Could add confirmation dialog here
          const confirmVoid = window.confirm("Void entire transaction?");
          if (confirmVoid) {
            clearCart();
            setSelectedItemIndex(-1);
            toast.info("Transaction voided");
          }
        }
        inputRef.current?.focus();
        return;
      }

      // Arrow keys - Navigate items
      if (e.key === "ArrowUp" && cart.length > 0) {
        e.preventDefault();
        setSelectedItemIndex(Math.max(0, selectedItemIndex - 1));
        return;
      }
      if (e.key === "ArrowDown" && cart.length > 0) {
        e.preventDefault();
        setSelectedItemIndex(Math.min(cart.length - 1, selectedItemIndex + 1));
        return;
      }

      // Plus/Minus - Adjust quantity
      if ((e.key === "+" || e.key === "=") && selectedItemIndex >= 0 && selectedItemIndex < cart.length) {
        e.preventDefault();
        const item = cart[selectedItemIndex];
        updateQuantity(item.product_id, item.quantity + 1);
        return;
      }
      if (e.key === "-" && selectedItemIndex >= 0 && selectedItemIndex < cart.length) {
        e.preventDefault();
        const item = cart[selectedItemIndex];
        if (item.quantity > 1) {
          updateQuantity(item.product_id, item.quantity - 1);
        } else {
          removeFromCart(item.product_id);
          setSelectedItemIndex(Math.max(0, selectedItemIndex - 1));
        }
        return;
      }

      // Delete - Remove selected item
      if ((e.key === "Delete" || e.key === "Backspace") && 
          selectedItemIndex >= 0 && 
          selectedItemIndex < cart.length &&
          !barcodeInput) {
        e.preventDefault();
        const item = cart[selectedItemIndex];
        removeFromCart(item.product_id);
        setSelectedItemIndex(Math.max(0, selectedItemIndex - 1));
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    barcodeInput,
    cart,
    selectedItemIndex,
    paymentDialogOpen,
    clearCart,
    updateQuantity,
    removeFromCart,
    setSelectedItemIndex,
  ]);

  // Auto-scroll to selected item
  useEffect(() => {
    if (selectedItemIndex >= 0 && tableRef.current) {
      const row = tableRef.current.querySelector(`[data-row-index="${selectedItemIndex}"]`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedItemIndex]);

  // Focus input on mount and when clicking the main area
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleMainAreaClick = useCallback((e: React.MouseEvent) => {
    // Don't refocus if clicking on a button or input
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.tagName === "INPUT") return;
    inputRef.current?.focus();
  }, []);

  // Payment confirmation handler
  const handlePaymentConfirm = async (
    paymentMethod: "CASH" | "GCASH",
    amountTendered: number,
    _gcashRefNo?: string
  ) => {
    setIsSubmitting(true);

    try {
      const result = await createTransaction({
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: getCartItemPrice(item),
        })),
        customerType,
        paymentMethod,
        amountTendered,
        change: amountTendered - totalDue,
        discountPercent: discountPercent > 0 ? discountPercent : undefined,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        taxAmount,
        // Note: gcashRefNo is not yet implemented in createTransaction
      });

      if (!result.success) {
        console.error("Transaction failed:", result.error);
        return;
      }

      playConfirmSound();

      const receipt: ReceiptData = {
        receiptNumber: result.receiptNo || generateReceiptNumber(),
        date: new Date(),
        cashierName: "Admin",
        items: cart.map((item) => ({
          name: item.product_name,
          barcode: item.barcode || undefined,
          quantity: item.quantity,
          price: getCartItemPrice(item),
          subtotal: getCartItemPrice(item) * item.quantity,
          priceType: item.priceType,
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
      setPaymentDialogOpen(false);

      setTimeout(() => {
        window.print();
        clearCart();
        setDiscountType("none");
        setCustomDiscountPercent("");
        setReceiptData(null);
        setSelectedItemIndex(-1);
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error("Failed to process transaction", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="w-full h-[calc(100vh-3.5rem)] flex overflow-hidden text-foreground bg-background"
      onClick={handleMainAreaClick}
    >
      {/* Left Panel - Transaction Table (75%) */}
      <div className="flex-[3] flex flex-col h-full overflow-hidden border-r border-border">
        {/* Header with barcode input */}
        <div className="flex-shrink-0 border-b border-border px-4 py-3 bg-card dark:bg-dark-foreground">
          <div className="flex items-center gap-3">
            {/* Mode indicator */}
            <Badge
              variant={isSearchMode ? "secondary" : "outline"}
              className="gap-1.5 px-3 py-3 border-border radius-md text-xs font-medium"
            >
              {isSearchMode ? (
                <>
                  <Search className="h-3 w-3" />
                  Search Mode
                </>
              ) : (
                <>
                  <ScanBarcode className="h-3 w-3" />
                  Scan Mode
                </>
              )}
            </Badge>

            {/* Barcode input (phantom input - always focused) */}
            <div className="relative flex-1">
              <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleBarcodeSubmit();
                  }
                }}
                placeholder={isSearchMode ? "Type product name..." : "Type barcode or search product name(F2)"}
                className="h-11 pl-10 text-lg font-mono bg-background border-2 border-primary/20 focus:border-primary"
                autoComplete="off"
              />
            </div>

            {/* Typing animation indicator */}
            <AnimatePresence>
              {typingAnimation.visible && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20"
                >
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary font-mono">
                    {typingAnimation.text}
                    <span className="animate-pulse">|</span>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Search results dropdown */}
          <AnimatePresence>
            {isSearchMode && searchResults.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
              >
                {searchResults.map((product) => (
                  <button
                    key={product.product_id}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted text-left"
                    onClick={() => {
                      const found = addByBarcode(product.barcode || "");
                      if (found) {
                        playSuccessBeep();
                        showTypingAnimation(found.product_name);
                        setLastAddedItemId(found.product_id);
                        setTimeout(() => setLastAddedItemId(null), 1500);
                      }
                      setBarcodeInput("");
                      setIsSearchMode(false);
                      setSearchResults([]);
                      inputRef.current?.focus();
                    }}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {product.barcode || "N/A"}
                    </span>
                    <span className="flex-1 text-sm">{product.product_name}</span>
                    <span className="font-mono text-sm">
                      ₱{product.retail_price.toFixed(2)}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Transaction Table */}
        <div ref={tableRef} className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            /* Empty State */
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="relative">
                  <ScanBarcode className="h-24 w-24 text-muted-foreground/30" />
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="h-1 w-16 bg-primary/50 rounded" />
                  </motion.div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-foreground mb-1">
                    Ready to Scan
                  </h3>
                  <p className="text-sm">
                    Scan a barcode or press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">F2</kbd> to search
                  </p>
                </div>
              </motion.div>
            </div>
          ) : (
            /* Transaction Table Header + Rows */
            <table className="w-full">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="w-12 px-4 py-3">#</th>
                  <th className="w-32 px-4 py-3">Barcode</th>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="w-24 px-4 py-3 text-right">Price</th>
                  <th className="w-24 px-4 py-3 text-center">Qty</th>
                  <th className="w-28 px-4 py-3 text-right">Total</th>
                  <th className="w-20 px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {cart.map((item, index) => {
                    const isSelected = index === selectedItemIndex;
                    const isLastAdded = item.product_id === lastAddedItemId;
                    const unitPrice = getCartItemPrice(item);

                    return (
                      <motion.tr
                        key={`${item.product_id}-${item.priceType}`}
                        data-row-index={index}
                        initial={{ opacity: 0, x: -20, backgroundColor: "rgba(172, 15, 22, 0.2)" }}
                        animate={{
                          opacity: 1,
                          x: 0,
                          backgroundColor: isLastAdded
                            ? ["rgba(172, 15, 22, 0.2)", "rgba(172, 15, 22, 0)", "rgba(172, 15, 22, 0.1)", "rgba(172, 15, 22, 0)"]
                            : "transparent",
                        }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{
                          duration: 0.3,
                          backgroundColor: { duration: 1.5, times: [0, 0.3, 0.6, 1] },
                        }}
                        className={cn(
                          "border-b border-border cursor-pointer transition-colors",
                          isSelected && "bg-primary/10 border-l-4 border-l-primary",
                          !isSelected && "hover:bg-muted/50"
                        )}
                        onClick={() => setSelectedItemIndex(index)}
                      >
                        <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">
                          {item.barcode || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{item.product_name}</span>
                            <span
                              className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                                item.priceType === "W"
                                  ? "bg-secondary/20 text-secondary"
                                  : "bg-primary/10 text-primary"
                              )}
                            >
                              {item.priceType}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-right">
                          ₱{unitPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.quantity > 1) {
                                  updateQuantity(item.product_id, item.quantity - 1);
                                } else {
                                  removeFromCart(item.product_id);
                                }
                              }}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-mono text-sm font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(item.product_id, item.quantity + 1);
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-right font-medium">
                          ₱{(unitPrice * item.quantity).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromCart(item.product_id);
                              if (selectedItemIndex >= cart.length - 1) {
                                setSelectedItemIndex(Math.max(0, cart.length - 2));
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right Panel - Command Center (25%) */}
      <div className="flex-1 flex flex-col h-full bg-card overflow-hidden">
        {/* Transaction Summary */}
        <div className="flex-shrink-0 p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            Transaction Summary
          </h3>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Items
              </span>
              <span className="font-medium">{itemCount}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">₱{subtotal.toFixed(2)}</span>
            </div>

            {/* Discount */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Discount</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 text-xs gap-1 px-2">
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
                    className="h-6 w-12 text-xs text-right font-mono"
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

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VAT (12%)</span>
              <span className="font-mono">₱{taxAmount.toFixed(2)}</span>
            </div>

            <Separator />

            {/* Total Due - Large */}
            <div className="flex items-center justify-between py-2">
              <span className="text-lg font-semibold flex items-center gap-2">
    
                Total Due
              </span>
              <span className="font-mono text-3xl font-medium text-primary dark:text-foreground">
                ₱{totalDue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex-shrink-0 p-4 border-b border-border space-y-2">
          <Button
            className="w-full h-12 text-base font-semibold"
            disabled={cart.length === 0 || isSubmitting}
            onClick={() => setPaymentDialogOpen(true)}
          >
            {isSubmitting ? "Processing..." : "Process Payment (Enter)"}
          </Button>

          <Button
            variant="outline"
            className="w-full gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
            disabled={cart.length === 0}
            onClick={() => {
              const confirmVoid = window.confirm("Void entire transaction?");
              if (confirmVoid) {
                clearCart();
                setSelectedItemIndex(-1);
                toast.info("Transaction voided");
              }
            }}
          >
            <XCircle className="h-4 w-4" />
            Void Transaction
          </Button>
        </div>

        {/* Keyboard Shortcuts Reference */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Keyboard Shortcuts
          </h3>

          <TooltipProvider>
            <div className="space-y-1.5">
              {keyboardShortcuts.map((shortcut) => (
                <Tooltip key={shortcut.key}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between h-9 px-3 text-left hover:bg-muted"
                      onClick={() => {
                        // Execute the shortcut action
                        if (shortcut.key === "Enter") {
                          handleBarcodeSubmit();
                        } else if (shortcut.key === "F2") {
                          setIsSearchMode(true);
                          inputRef.current?.focus();
                        } else if (shortcut.key === "Esc") {
                          if (barcodeInput) {
                            setBarcodeInput("");
                          }
                        }
                      }}
                    >
                      <span className="flex items-center gap-2 text-xs">
                        <shortcut.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {shortcut.description}
                      </span>
                      <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground">
                        {shortcut.key}
                      </kbd>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>{shortcut.description}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </div>

        {/* Status Bar */}
        <div className="flex-shrink-0 px-4 py-2 border-t border-border bg-muted/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Legacy Mode</span>
            <span className="font-mono">
              {new Date().toLocaleTimeString()}
            </span>
          </div>
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
        viewMode="legacy"
      />

      {/* Hidden Receipt Template */}
      <ReceiptTemplate ref={receiptRef} data={receiptData} />
    </div>
  );
}
