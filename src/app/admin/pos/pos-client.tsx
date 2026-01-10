"use client";

import { useEffect, useMemo, useState } from "react";
import { ScanBarcode, Search, Camera, ShoppingBag, Truck, Monitor, Smartphone, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { 
  usePosStore, 
  type PosProduct, 
  type CatalogMode,
  getCartTotal,
  filterProductsForCatalog 
} from "@/stores/use-pos-store";
import { usePosLayoutStore, type PosViewMode } from "@/stores/use-pos-layout-store";
import { ProductGrid } from "@/components/pos/product-grid";
import { CartPanel } from "@/components/pos/cart-panel";
import { CameraScanner } from "@/components/pos/camera-scanner";
import { LegacyPOSLayout } from "@/components/pos/legacy-pos-layout";
import { usePosAudio } from "@/hooks/use-pos-audio";
import { motion } from "framer-motion";
import { toast } from "sonner";

type Props = {
  products: PosProduct[];
  gcashQrUrl?: string | null;
};

const categoriesFromProducts = (products: PosProduct[]) => {
  const set = new Set<string>();
  products.forEach((p) => {
    if (p.category) set.add(p.category);
  });
  return ["all", ...Array.from(set)];
};

const formatCategoryLabel = (value: string) => {
  if (value === "all") return "All";
  return value
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : ""))
    .join(" ")
    .trim();
};

/** Catalog mode options for the segmented control */
const catalogModes: { id: CatalogMode; label: string; icon: React.ElementType }[] = [
  { id: "retail", label: "Retail", icon: ShoppingBag },
  { id: "wholesale", label: "Wholesale", icon: Truck },
];

/** View mode options */
const viewModes: { id: PosViewMode; label: string; icon: React.ElementType }[] = [
  { id: "touch", label: "Touch", icon: Smartphone },
  { id: "legacy", label: "Legacy", icon: Monitor },
];

export default function PosClient({ products, gcashQrUrl }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { setProducts, addByBarcode, catalogMode, setCatalogMode, cart } = usePosStore();
  const { viewMode, setViewMode, initializeViewMode, setLastAddedItemId } = usePosLayoutStore();
  const { playSuccessBeep, playErrorBuzz } = usePosAudio();

  // Initialize view mode based on device type (only once)
  useEffect(() => {
    initializeViewMode();
  }, [initializeViewMode]);

  // Detect mobile/tablet viewport for cart FAB
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setProducts(products);
  }, [products, setProducts]);

  // Keyboard scanner listener (USB gun behaves like keyboard) with audio feedback
  useEffect(() => {
    let buffer = "";
    let lastTime = 0;
    const handler = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastTime > 80) {
        buffer = "";
      }
      if (e.key === "Enter") {
        if (buffer.trim()) {
          const found = addByBarcode(buffer.trim());
          if (found) {
            playSuccessBeep();
            setLastAddedItemId(found.product_id);
            setTimeout(() => setLastAddedItemId(null), 1500);
          } else {
            playErrorBuzz();
            toast.error(`Product not found: ${buffer.trim()}`);
          }
          setLastScan(found ? buffer.trim() : null);
          setScanError(found ? null : `No product for barcode: ${buffer.trim()}`);
        }
        buffer = "";
        return;
      }
      if (e.key.length === 1) {
        buffer += e.key;
      }
      lastTime = now;
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addByBarcode, playSuccessBeep, playErrorBuzz, setLastAddedItemId]);

  // Filter products based on catalog mode first
  const catalogProducts = useMemo(
    () => filterProductsForCatalog(products, catalogMode),
    [products, catalogMode]
  );

  // Then filter by search/category
  const filteredProducts = useMemo(() => {
    let result = catalogProducts;
    if (category !== "all") {
      result = result.filter((p) => p.category === category);
    }
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.product_name.toLowerCase().includes(lower) ||
          (p.barcode && p.barcode.toLowerCase().includes(lower))
      );
    }
    return result;
  }, [catalogProducts, category, search]);

  const categories = useMemo(() => categoriesFromProducts(products), [products]);

  const handleCameraScan = (barcode: string) => {
    const found = addByBarcode(barcode);
    if (found) {
      playSuccessBeep();
      setLastAddedItemId(found.product_id);
      setTimeout(() => setLastAddedItemId(null), 1500);
      setLastScan(barcode);
      setScanError(null);
      toast.success(`Added: ${found.product_name}`);
    } else {
      playErrorBuzz();
      setScanError(`No product for barcode: ${barcode}`);
      toast.error(`Product not found: ${barcode}`);
    }
    setCameraOpen(false);
  };

  // Get cart total
  const cartTotal = getCartTotal(cart);
  const itemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // If in Legacy Mode, render the LegacyPOSLayout (mode toggle is now inside the layout)
  if (viewMode === "legacy") {
    return <LegacyPOSLayout products={products} gcashQrUrl={gcashQrUrl} />;
  }

  // Touch Mode - Fixed Split Layout (no draggable panels)
  // Desktop/Tablet Landscape: grid-cols-[1fr_350px] for fixed split
  // Mobile/Portrait: Full-width grid with FAB cart

  return (
    <div 
      className={cn(
        "w-full h-[calc(100vh-3.5rem)] text-foreground",
        // Fixed split grid for tablet/desktop, single column for mobile
        isMobile 
          ? "flex flex-col overflow-hidden" 
          : "grid grid-cols-[1fr_350px] overflow-hidden"
      )}
    >
      {/* Left panel - Product area */} 
      <div className="flex flex-col h-full overflow-hidden min-w-0">
        {/* Top bar - Search & Categories */}
        <div className="flex-shrink-0 border-b w-full border-border px-4 bg-card">
          {/* Search row */}
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Catalog Mode Toggle - Segmented Control */}
            <div className="relative flex bg-light-foreground dark:bg-dark-foreground border border-border rounded-lg px-1 py-1 flex-shrink-0">
              {catalogModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setCatalogMode(mode.id)}
                  className={cn(
                    "relative flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md z-10 transition-colors duration-200",
                    catalogMode === mode.id
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {catalogMode === mode.id && (
                    <motion.div
                      layoutId="catalog-mode-highlight"
                      className="absolute inset-0 bg-primary rounded-md shadow-sm"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <mode.icon className="h-3.5 w-3.5 relative z-10" />
                  <span className="relative z-10 hidden sm:inline">{mode.label}</span>
                </button>
              ))}
            </div>

            <div className="relative flex-1 bg-card/70 border-border rounded-lg mt-0 mb-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or scan barcode..."
                className="h-9.25 rounded-lg pl-8 pr-10 text-sm bg-card/70 focus:ring-0 w-full"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setCameraOpen(true)}
              >
                <ScanBarcode className="h-4 w-4" />
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9.25 gap-1.5 px-3 flex-shrink-0"
              onClick={() => setCameraOpen(true)}
            >
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline">Scan</span>
            </Button>

            {/* Status badges */}
            {lastScan && (
              <Badge variant="outline" className="h-7 rounded-full border-primary text-primary px-2.5 text-xs hidden md:flex">
                {lastScan}
              </Badge>
            )}
            {scanError && (
              <Badge variant="destructive" className="h-7 rounded-full px-2.5 text-xs hidden md:flex">
                {scanError}
              </Badge>
            )}

            {/* View Mode Toggle */}
            <div className="relative flex bg-card border border-border rounded-lg px-1 py-1 flex-shrink-0 ml-2">
              {viewModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setViewMode(mode.id)}
                  className={cn(
                    "relative flex items-center justify-center gap-1.5 py-1.5 px-2.5 text-xs font-medium rounded-md z-10 transition-colors duration-200",
                    viewMode === mode.id
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {viewMode === mode.id && (
                    <motion.div
                      layoutId="view-mode-highlight-touch"
                      className="absolute inset-0 bg-primary rounded-md shadow-sm"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <mode.icon className="h-3.5 w-3.5 relative z-10" />
                  <span className="relative z-10 hidden lg:inline">{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Category pills row */}
          <div className="px-3 pb-2">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={cn(
                      "whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium transition shrink-0 min-h-[44px] touch-manipulation",
                      cat === category
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted"
                    )}
                    onClick={() => setCategory(cat)}
                  >
                    {formatCategoryLabel(cat)}
                  </button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="h-1.5" />
            </ScrollArea>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto px-3 py-2 bg-card/70">
          <ProductGrid products={filteredProducts} />
        </div>
      </div>

      {/* Right panel - Cart (Fixed 350px width, always visible on tablet/desktop) */}
      {!isMobile && (
        <div className="h-full flex flex-col bg-card border-l border-border overflow-hidden">
          <CartPanel gcashQrUrl={gcashQrUrl} />
        </div>
      )}

      {/* Mobile/Tablet: Floating Action Button (FAB) for Cart */}
      {isMobile && (
        <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
          <SheetTrigger asChild>
            <Button
              className={cn(
                "fixed bottom-6 right-6 h-14 rounded-full shadow-lg z-50 gap-2 px-5",
                "bg-primary hover:bg-primary/90 text-primary-foreground",
                "min-h-[56px] touch-manipulation",
                "transition-all duration-200 active:scale-95"
              )}
              size="lg"
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="font-semibold">
                {itemCount > 0 ? (
                  <>
                    Cart ({itemCount}) • ₱{cartTotal.toFixed(2)}
                  </>
                ) : (
                  "Cart"
                )}
              </span>
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-secondary text-secondary-foreground text-xs flex items-center justify-center font-bold">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent 
            side="right" 
            className="w-full sm:w-[400px] p-0 flex flex-col"
          >
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Shopping Cart
                {itemCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {itemCount} items
                  </Badge>
                )}
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">
              <CartPanel gcashQrUrl={gcashQrUrl} />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <CameraScanner
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onDetected={(code) => {
          const found = addByBarcode(code);
          setLastScan(found ? code : null);
          setScanError(found ? null : `No product for barcode: ${code}`);
          setCameraOpen(false);
        }}
      />
    </div>
  );
}
