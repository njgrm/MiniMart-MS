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
  Bell,
  Monitor,
  Smartphone,
  Camera,
  AlertTriangle,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  usePosStore,
  getCartTotal,
  getCartItemPrice,
  type PosProduct,
  type PosCartItem,
} from "@/stores/use-pos-store";
import { usePosLayoutStore, type PosViewMode } from "@/stores/use-pos-layout-store";
import { usePosAudio } from "@/hooks/use-pos-audio";
import { PaymentDialog } from "@/components/pos/payment-dialog";
import { CameraScanner } from "@/components/pos/camera-scanner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [editingQtyIndex, setEditingQtyIndex] = useState<number | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState<string>("");

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
    viewMode,
    setViewMode,
  } = usePosLayoutStore();

  // Audio
  const { playSuccessBeep, playErrorBuzz, playConfirmSound } = usePosAudio();

  // Initialize products
  useEffect(() => {
    setProducts(products);
  }, [products, setProducts]);

  // Helper: Get available stock (accounts for reserved stock from pending orders)
  const getAvailableStock = useCallback((product: PosProduct | PosCartItem) => {
    // If available_stock is provided, use it; otherwise fall back to current_stock
    return product.available_stock ?? product.current_stock;
  }, []);

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
        const product = results[0];
        // Zero-stock check - use available_stock to account for reserved stock
        const availableStock = getAvailableStock(product);
        if (availableStock <= 0) {
          playErrorBuzz();
          toast.error(`"${product.product_name}" is out of stock!`, {
            description: product.allocated_stock ? `${product.current_stock} in stock, ${product.allocated_stock} reserved` : "Cannot add items with zero stock.",
          });
          setBarcodeInput("");
          return;
        }
        // Single result - add it
        const found = addByBarcode(product.barcode || "");
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
      // Normal barcode mode - first find the product to check stock
      const productMatch = products.find(
        (p) => p.barcode && p.barcode.trim() === barcodeInput.trim()
      );
      
      // Zero-stock check - use available_stock to account for reserved stock
      if (productMatch) {
        const availableStock = getAvailableStock(productMatch);
        if (availableStock <= 0) {
          playErrorBuzz();
          toast.error(`"${productMatch.product_name}" is out of stock!`, {
            description: productMatch.allocated_stock ? `${productMatch.current_stock} in stock, ${productMatch.allocated_stock} reserved` : "Cannot add items with zero stock.",
          });
          setBarcodeInput("");
          return;
        }
      }

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
          // Open void confirmation dialog
          setVoidDialogOpen(true);
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

      // Plus/Minus - Adjust quantity with strict stock guardrails
      if ((e.key === "+" || e.key === "=") && selectedItemIndex >= 0 && selectedItemIndex < cart.length) {
        e.preventDefault();
        const item = cart[selectedItemIndex];
        // Strict guardrail: cannot exceed available_stock (accounts for reserved stock)
        const availableStock = getAvailableStock(item);
        if (item.quantity >= availableStock) {
          playErrorBuzz();
          toast.error(`Stock limit reached (${availableStock} available)`, {
            description: `Cannot add more "${item.product_name}"`,
          });
          return;
        }
        updateQuantity(item.product_id, item.quantity + 1);
        return;
      }
      if (e.key === "-" && selectedItemIndex >= 0 && selectedItemIndex < cart.length) {
        e.preventDefault();
        const item = cart[selectedItemIndex];
        // Safety: stop at 1, never remove via minus key
        if (item.quantity > 1) {
          updateQuantity(item.product_id, item.quantity - 1);
        } else {
          playErrorBuzz();
          toast.warning("Quantity already at minimum", {
            description: "Use Delete key to remove item",
          });
        }
        return;
      }

      // Delete - Remove selected item
      if ((e.key === "Delete" ) && 
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
    playErrorBuzz,
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

  // View mode options
  const viewModes: { id: PosViewMode; label: string; icon: React.ElementType }[] = [
    { id: "touch", label: "Touch", icon: Smartphone },
    { id: "legacy", label: "Legacy", icon: Monitor },
  ];

  // Handle camera scan
  const handleCameraScan = useCallback((barcode: string) => {
    // Check stock first - use available_stock to account for reserved stock
    const productMatch = products.find(
      (p) => p.barcode && p.barcode.trim() === barcode.trim()
    );
    
    if (productMatch) {
      const availableStock = getAvailableStock(productMatch);
      if (availableStock <= 0) {
        playErrorBuzz();
        toast.error(`"${productMatch.product_name}" is out of stock!`, {
          description: productMatch.allocated_stock ? `${productMatch.current_stock} in stock, ${productMatch.allocated_stock} reserved` : "Cannot add items with zero stock.",
        });
        setCameraOpen(false);
        return;
      }
    }

    const found = addByBarcode(barcode);
    if (found) {
      playSuccessBeep();
      setLastAddedItemId(found.product_id);
      setTimeout(() => setLastAddedItemId(null), 1500);
      showTypingAnimation(found.product_name);
      toast.success(`Added: ${found.product_name}`);
    } else {
      playErrorBuzz();
      toast.error(`Product not found: ${barcode}`);
    }
    setCameraOpen(false);
  }, [products, addByBarcode, playSuccessBeep, playErrorBuzz, setLastAddedItemId, showTypingAnimation, getAvailableStock]);

  // Handle void confirmation
  const handleVoidConfirm = useCallback(() => {
    clearCart();
    setSelectedItemIndex(-1);
    setVoidDialogOpen(false);
    toast.info("Transaction voided");
    inputRef.current?.focus();
  }, [clearCart, setSelectedItemIndex]);

  // Handle editable quantity submit with stock guardrails
  const handleQtySubmit = useCallback((productId: number, maxStock: number) => {
    const qty = parseInt(editingQtyValue);
    if (!isNaN(qty) && qty > 0) {
      // Clamp to available stock
      const clampedQty = Math.min(qty, maxStock);
      if (clampedQty < qty) {
        playErrorBuzz();
        toast.warning(`Quantity clamped to ${clampedQty}`, {
          description: `Only ${maxStock} units available in stock`,
        });
      }
      updateQuantity(productId, clampedQty);
    }
    setEditingQtyIndex(null);
    setEditingQtyValue("");
  }, [editingQtyValue, updateQuantity, playErrorBuzz]);

  return (
    <div
      className="w-full h-[calc(100vh-3.5rem)] flex overflow-hidden text-foreground bg-card/70 dark:bg-dark-foreground"
      onClick={handleMainAreaClick}
    >
      {/* Left Panel - Transaction Table (75%) */}
      <div className="flex-[3] flex flex-col h-full overflow-hidden border-r border-border">
        {/* Header with barcode input */}
        <div className="flex-shrink-0 border-b border-border px-4 py-3 bg-card dark:bg-dark-foreground">
          <div className="flex items-center gap-3">
            {/* Mode indicator - now clickable to open camera */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant={isSearchMode ? "secondary" : "outline"}
                    className="gap-1.5 px-3 py-3.5 text-xs border-border rounded-lg font-medium cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setCameraOpen(true)}
                  >
                    {isSearchMode ? (
                      <>
                        <Search className="h-3 w-3" />
                        Search Mode
                      </>
                    ) : (
                      <>
                        <Camera className="h-3 w-3" />
                        Scan
                      </>
                    )}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Click to open camera scanner</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

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
                className="h-11 w-full pl-10 text-lg font-mono bg-card/70 border-2 border-primary/20 focus:border-primary"
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



            {/* View Mode Toggle */}
            <div className="relative flex bg-card border border-border rounded-lg py-1.5 px-1">
              {viewModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setViewMode(mode.id)}
                  className={cn(
                    "relative flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-md z-10 transition-colors duration-200",
                    viewMode === mode.id
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {viewMode === mode.id && (
                    <motion.div
                      layoutId="legacy-view-mode-highlight"
                      className="absolute inset-0 bg-primary rounded-md shadow-sm"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <mode.icon className="h-3.5 w-3.5 relative z-10" />
                  <span className="relative z-10">{mode.label}</span>
                </button>
              ))}
            </div>

         
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
                  <th className="w-32 px-4 py-3 text-center">Qty / Stock</th>
                  <th className="w-28 px-4 py-3 text-right">Total</th>
                  <th className="w-20 px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card">
                <AnimatePresence>
                  {cart.map((item, index) => {
                    const isSelected = index === selectedItemIndex;
                    const isLastAdded = item.product_id === lastAddedItemId;
                    const unitPrice = getCartItemPrice(item);
                    const isEditing = editingQtyIndex === index;

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
                            : isSelected
                              ? "rgba(172, 15, 22, 0.1)"
                              : "transparent",
                        }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{
                          duration: 0.3,
                          backgroundColor: { duration: 1.5, times: [0, 0.3, 0.6, 1] },
                        }}
                        className={cn(
                          "border-b border-border cursor-pointer transition-colors",
                          isSelected && "border-l-4 border-l-primary",
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
                            {/* Editable Quantity - no +/- buttons, keyboard only */}
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editingQtyValue}
                                onChange={(e) => setEditingQtyValue(e.target.value)}
                                onBlur={() => handleQtySubmit(item.product_id, getAvailableStock(item))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleQtySubmit(item.product_id, getAvailableStock(item));
                                  }
                                  if (e.key === "Escape") {
                                    setEditingQtyIndex(null);
                                    setEditingQtyValue("");
                                  }
                                }}
                                className="w-14 h-7 text-center font-mono text-sm p-1"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                min={1}
                                max={getAvailableStock(item)}
                              />
                            ) : (
                              <button
                                type="button"
                                className="min-w-[2.5rem] text-center font-mono text-sm font-semibold hover:bg-primary/10 rounded px-2 py-1 transition-colors border border-transparent hover:border-primary/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingQtyIndex(index);
                                  setEditingQtyValue(item.quantity.toString());
                                }}
                                title="Click to edit quantity"
                              >
                                {item.quantity}
                              </button>
                            )}
                            
                            {/* Stock indicator - shows available stock with reserved indicator */}
                            <span className={cn(
                              "text-[10px] font-mono",
                              getAvailableStock(item) <= item.reorder_level
                                ? "text-secondary"
                                : "text-muted-foreground"
                            )}>
                              /{getAvailableStock(item)}{item.allocated_stock ? ` (${item.allocated_stock}res)` : ""}
                            </span>
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

        {/* Keyboard Shortcuts Reference - Static Display */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Keyboard Shortcuts
          </h3>

          <div className="space-y-1">
            {keyboardShortcuts.map((shortcut) => (
              <div
                key={shortcut.key}
                className="w-full flex items-center justify-between h-8 px-3 rounded-md bg-muted/30"
              >
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <shortcut.icon className="h-3.5 w-3.5" />
                  {shortcut.description}
                </span>
                <kbd className="px-2 py-0.5 rounded bg-background border border-border text-[10px] font-mono text-foreground shadow-sm">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
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

      {/* Void Confirmation Dialog */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Void Transaction?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all <strong>{cart.length} item{cart.length !== 1 ? "s" : ""}</strong> from the current transaction.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => inputRef.current?.focus()}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoidConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Void All Items
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Camera Scanner */}
      <CameraScanner
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onDetected={handleCameraScan}
      />

      {/* Hidden Receipt Template */}
      <ReceiptTemplate ref={receiptRef} data={receiptData} />
    </div>
  );
}
