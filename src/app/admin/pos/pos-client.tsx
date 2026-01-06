"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { ScanBarcode, Search, Camera, ShoppingBag, Truck, Monitor, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
import { ResizeHandle } from "@/components/pos/resize-handle";
import { LegacyPOSLayout } from "@/components/pos/legacy-pos-layout";
import { usePosAudio } from "@/hooks/use-pos-audio";
import { motion, AnimatePresence } from "framer-motion";
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
  
  // Container ref for resize calculations
  const containerRef = useRef<HTMLDivElement>(null);

  const { setProducts, addByBarcode, catalogMode, setCatalogMode, cart } = usePosStore();
  const { cartWidth, isResizing, viewMode, setViewMode, initializeViewMode, setLastAddedItemId } = usePosLayoutStore();
  const { playSuccessBeep, playErrorBuzz } = usePosAudio();

  // Initialize view mode based on device type (only once)
  useEffect(() => {
    initializeViewMode();
  }, [initializeViewMode]);

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

  // If in Legacy Mode, render the LegacyPOSLayout (mode toggle is now inside the layout)
  if (viewMode === "legacy") {
    return <LegacyPOSLayout products={products} gcashQrUrl={gcashQrUrl} />;
  }

  // Touch Mode (original layout) continues below...

  return (
    <div 
      ref={containerRef}
      className={cn(
        "w-full h-[calc(100vh-3.5rem)] flex overflow-hidden text-foreground",
        isResizing && "select-none"
      )}
    >
      {/* Left panel - Product area (uses flex-1 and min-w-0 for proper shrinking) */} 
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
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
                      "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition shrink-0",
                      cat === category
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
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
        <div className="flex-1 overflow-y-auto px-4 ml-0 py-1 bg-card/70">
          <div className="flex items-center justify-between mb-3">
            
          </div>
          <ProductGrid products={filteredProducts} />
        </div>
      </div>

      {/* Resize Handle */}
      <ResizeHandle containerRef={containerRef} />

      {/* Right panel - Cart (resizable) */}
      <motion.div 
        className="h-full flex flex-col bg-card flex-shrink-0 overflow-hidden"
        style={{ width: cartWidth }}
        animate={{ width: cartWidth }}
        transition={{ 
          type: isResizing ? "tween" : "spring",
          duration: isResizing ? 0 : 0.2,
          stiffness: 300,
          damping: 30
        }}
      >
        <CartPanel gcashQrUrl={gcashQrUrl} />
      </motion.div>

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
