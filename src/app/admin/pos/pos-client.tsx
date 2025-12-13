"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { ScanBarcode, Search, Camera, ShoppingBag, Truck } from "lucide-react";
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
import { usePosLayoutStore } from "@/stores/use-pos-layout-store";
import { ProductGrid } from "@/components/pos/product-grid";
import { CartPanel } from "@/components/pos/cart-panel";
import { CameraScanner } from "@/components/pos/camera-scanner";
import { ResizeHandle } from "@/components/pos/resize-handle";
import { motion } from "framer-motion";

type Props = {
  products: PosProduct[];
  /** GCash QR code URL from store settings */
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

export default function PosClient({ products, gcashQrUrl }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  
  // Container ref for resize calculations
  const containerRef = useRef<HTMLDivElement>(null);

  const { setProducts, addByBarcode, catalogMode, setCatalogMode, cart } = usePosStore();
  const { cartWidth, isResizing } = usePosLayoutStore();

  useEffect(() => {
    setProducts(products);
  }, [products, setProducts]);

  // Keyboard scanner listener (USB gun behaves like keyboard)
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
  }, [addByBarcode]);

  // Filter products based on catalog mode first
  const catalogProducts = useMemo(
    () => filterProductsForCatalog(products, catalogMode),
    [products, catalogMode]
  );

  // Get categories from catalog-filtered products
  const categories = useMemo(() => categoriesFromProducts(catalogProducts), [catalogProducts]);

  // Further filter by search and category
  const filteredProducts = useMemo(() => {
    return catalogProducts.filter((product) => {
      const matchesCategory = category === "all" || product.category === category;
      const matchesSearch =
        product.product_name.toLowerCase().includes(search.toLowerCase()) ||
        (product.barcode ?? "").toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [catalogProducts, category, search]);

  const cartTotal = getCartTotal(cart);

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

            <div className="relative flex-1 bg-background border-border rounded-lg mt-0 mb-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or scan barcode..."
                className="h-9.25 rounded-lg pl-8 pr-10 text-sm"
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
        <div className="flex-1 overflow-y-auto px-4 ml-3 py-1 bg-muted/30">
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
          // Camera stays open for continuous scanning
        }}
        getProductName={(barcode) => {
          const product = products.find((p) => p.barcode === barcode);
          return product?.product_name ?? null;
        }}
      />
    </div>
  );
}
