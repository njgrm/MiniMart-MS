"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  IconAlertTriangle,
  IconPackage,
  IconClock,
  IconPlus,
  IconTag,
  IconShoppingCart,
  IconCalendarDue,
  IconHelpCircle,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type StockStatus = "OUT_OF_STOCK" | "CRITICAL" | "LOW" | "HEALTHY" | "DEAD_STOCK";

export interface LowStockItem {
  product_id: number;
  product_name: string;
  current_stock: number;
  reorder_level: number;
  category: string;
  image_url?: string | null;
  daily_velocity?: number;
  days_of_stock?: number;
  stock_status?: StockStatus;
}

export interface ExpiringItem {
  product_id: number;
  product_name: string;
  current_stock: number;
  expiry_date: Date;
  days_until_expiry: number;
  category: string;
  image_url?: string | null;
}

export interface InventoryHealthData {
  lowStockItems: LowStockItem[];
  expiringItems: ExpiringItem[];
  outOfStockCount: number;
  lowStockCount: number;
  expiringCount: number;
}

interface InventoryHealthCardProps {
  data: InventoryHealthData;
  className?: string;
}

function LowStockRow({ item, onAddToPO, onClick }: { item: LowStockItem; onAddToPO: () => void; onClick: () => void }) {
  const isOutOfStock = item.current_stock === 0;
  
  // Use velocity-based days of stock from the server action
  const daysOfStock = item.days_of_stock ?? 0;
  const dailyVelocity = item.daily_velocity ?? 0;
  const stockStatus = item.stock_status ?? "LOW";
  
  // Calculate progress bar percentage (7 days = 100%)
  const targetDays = 7;
  const percent = Math.min((daysOfStock / targetDays) * 100, 100);
  
  // Color logic based on stock status (matches analytics)
  const getBarColor = () => {
    if (stockStatus === "OUT_OF_STOCK" || stockStatus === "CRITICAL") return "bg-red-500";
    if (stockStatus === "LOW") return "bg-orange-500";
    return "bg-emerald-500";
  };
  
  const getStatusBadge = () => {
    if (stockStatus === "OUT_OF_STOCK") {
      return { bg: "bg-destructive/20", text: "text-destructive", label: "Critical Restock" };
    }
    if (stockStatus === "CRITICAL") {
      return { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-800 dark:text-red-400", label: `Restock Now (${daysOfStock}d)` };
    }
    return { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-400", label: `Restock Soon (${daysOfStock}d)` };
  };

  const badge = getStatusBadge();

  return (
    <div 
      className="flex items-center gap-3 p-2 hover:bg-muted/50 transition-colors rounded-lg group cursor-pointer"
      onClick={onClick}
    >
      {/* Product Image */}
      <div className="size-10 rounded-lg overflow-hidden bg-muted shrink-0">
        {item.image_url ? (
          <img 
            src={item.image_url} 
            alt={item.product_name}
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full flex items-center justify-center">
            <IconPackage className="size-5 text-muted-foreground/50" />
          </div>
        )}
      </div>
      
      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate text-foreground">{item.product_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded",
            badge.bg,
            badge.text
          )}>
            {badge.label}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {item.current_stock} units • {dailyVelocity.toFixed(1)}/day
          </span>
        </div>
        {/* Days of Supply Progress Bar (matching Analytics) */}
        {!isOutOfStock && (
          <div className="w-full h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all",
                getBarColor()
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
      
      {/* Action */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); onAddToPO(); }}
      >
        <IconPlus className="size-3 mr-1" />
        Add to PO
      </Button>
    </div>
  );
}

function ExpiringRow({ item, onDiscount, onClick }: { item: ExpiringItem; onDiscount: () => void; onClick: () => void }) {
  // 45-Day Supplier Return Policy:
  // <= 0 days: EXPIRED (Red) - Cannot return
  // 1-7 days: CRITICAL - Pull Out Now (Red-ish)
  // 8-45 days: RETURN TO SUPPLIER (Orange)
  // > 45 days: Should not appear in this list
  
  const isExpired = item.days_until_expiry <= 0;
  const isCritical = item.days_until_expiry > 0 && item.days_until_expiry <= 7;
  const isInReturnWindow = item.days_until_expiry > 0 && item.days_until_expiry <= 45;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
    }).format(new Date(date));
  };

  // Determine action label based on urgency
  const getActionLabel = () => {
    if (isExpired) return "Expired";
    if (isCritical) return "Pull Out";
    return "Return to Supplier";
  };

  return (
    <div 
      className="flex items-center gap-3 p-2 hover:bg-muted/50 transition-colors rounded-lg group cursor-pointer"
      onClick={onClick}
    >
      {/* Product Image */}
      <div className="size-10 rounded-lg overflow-hidden bg-muted shrink-0">
        {item.image_url ? (
          <img 
            src={item.image_url} 
            alt={item.product_name}
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full flex items-center justify-center">
            <IconPackage className="size-5 text-muted-foreground/50" />
          </div>
        )}
      </div>
      
      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate text-foreground">{item.product_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1",
            isExpired 
              ? "bg-destructive/20 text-destructive" 
              : isCritical
                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
          )}>
            <IconCalendarDue className="size-3" />
            {isExpired 
              ? "Expired" 
              : `${getActionLabel()} (${item.days_until_expiry}d)`
            }
          </span>
          <span className="text-[10px] text-muted-foreground">
            {item.current_stock} units
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {isExpired ? "Expired" : "Expires"}: {formatDate(item.expiry_date)}
        </p>
      </div>
      
      {/* Action - Context-aware button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); onDiscount(); }}
      >
        {isInReturnWindow && !isExpired ? (
          <>
            <IconPackage className="size-3 mr-1" />
            Return
          </>
        ) : (
          <>
            <IconTag className="size-3 mr-1" />
            Discount
          </>
        )}
      </Button>
    </div>
  );
}

export function InventoryHealthCard({ data, className }: InventoryHealthCardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("low-stock");

  const handleAddToPO = (productId: number) => {
    // Navigate to analytics dashboard with product pre-selected for PO
    router.push(`/admin/analytics?addToPO=${productId}`);
  };

  const handleDiscount = (productId: number) => {
    // Navigate to inventory page to edit product price
    router.push(`/admin/inventory?edit=${productId}`);
  };

  const totalAlerts = data.outOfStockCount + data.lowStockCount + data.expiringCount;

  return (
    <div className={cn("bg-card rounded-xl border flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <div className="flex items-center gap-2">
          <div className="relative">
            <IconAlertTriangle className="size-4 text-[#F1782F]" />
            {totalAlerts > 0 && (
              <span className="absolute -top-1.5 -right-1.5 size-4 flex items-center justify-center rounded-full bg-[#F1782F] text-[9px] font-bold text-white">
                {totalAlerts > 9 ? "9+" : totalAlerts}
              </span>
            )}
          </div>
          <h3 className="font-medium text-sm">Inventory Health</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => router.push("/admin/inventory")}
        >
          View All
        </Button>
      </div>

      {/* Animated Tab Toggle */}
      <div className="flex-1 flex flex-col">
        <div className="mx-3 mt-2">
          <div className="relative grid grid-cols-2 bg-muted rounded-lg p-0.5 h-9">
            {/* Animated Indicator */}
            <motion.div
              className="absolute inset-y-0.5 rounded-md bg-[#F1782F] shadow-sm"
              initial={false}
              animate={{
                x: activeTab === "low-stock" ? "2px" : "calc(100% - 2px)",
                width: "calc(50% - 2px)",
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
              }}
            />
            
            {/* Low Stock Tab */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveTab("low-stock")}
                    className={cn(
                      "relative z-10 flex items-center justify-center text-xs h-8 rounded-md transition-colors",
                      activeTab === "low-stock" 
                        ? "text-white font-medium" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <IconShoppingCart className="size-3 mr-1.5" />
                    Low Stock
                    {data.lowStockCount + data.outOfStockCount > 0 && (
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "ml-1.5 h-4 text-[9px] px-1",
                          activeTab === "low-stock" && "bg-white/20 text-white border-white/30"
                        )}
                      >
                        {data.lowStockCount + data.outOfStockCount}
                      </Badge>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  <p className="font-medium">Items below reorder point</p>
                  <p className="text-muted-foreground">Less than 2 days of supply based on sales velocity</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Return Window Tab */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveTab("expiring")}
                    className={cn(
                      "relative z-10 flex items-center justify-center text-xs h-8 rounded-md transition-colors",
                      activeTab === "expiring" 
                        ? "text-white font-medium" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <IconClock className="size-3 mr-1.5" />
                    Return Window
                    {data.expiringCount > 0 && (
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "ml-1.5 h-4 text-[9px] px-1",
                          activeTab === "expiring" && "bg-white/20 text-white border-white/30"
                        )}
                      >
                        {data.expiringCount}
                      </Badge>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  <p className="font-medium">45-Day Supplier Return Window</p>
                  <p className="text-muted-foreground">Items expiring within 45 days - return to supplier or discount</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 mt-2 px-2">
          {activeTab === "low-stock" ? (
            <ScrollArea className="h-[57vh]">
              {data.lowStockItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                  <IconPackage className="size-8 mb-2 opacity-30" />
                  <p className="text-xs">All items well stocked!</p>
                  <p className="text-[10px] text-muted-foreground/70">No restock needed</p>
                </div>
              ) : (
                <div className="space-y-1 py-2">
                  {data.lowStockItems.map((item) => (
                    <LowStockRow 
                      key={item.product_id} 
                      item={item} 
                      onAddToPO={() => handleAddToPO(item.product_id)}
                      onClick={() => router.push(`/admin/inventory?edit=${item.product_id}`)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          ) : (
            <ScrollArea className="h-[57vh]">
              {data.expiringItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                  <IconClock className="size-8 mb-2 opacity-30" />
                  <p className="text-xs">No items expiring soon</p>
                  <p className="text-[10px] text-muted-foreground/70">Inventory is fresh</p>
                </div>
              ) : (
                <div className="space-y-1 py-2">
                  {data.expiringItems.map((item) => (
                    <ExpiringRow 
                      key={item.product_id} 
                      item={item} 
                      onDiscount={() => handleDiscount(item.product_id)}
                      onClick={() => router.push(`/admin/inventory?edit=${item.product_id}`)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Footer Summary */}
      <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          {data.outOfStockCount > 0 && (
            <span className="flex items-center gap-1 text-destructive font-medium">
              <div className="size-2 rounded-full bg-destructive" />
              {data.outOfStockCount} out of stock
            </span>
          )}
          {data.lowStockCount > 0 && (
            <span className="flex items-center gap-1">
              <div className="size-2 rounded-full bg-[#F1782F]" />
              {data.lowStockCount} low stock
            </span>
          )}
        </div>
        <span className="font-medium">Restock Alert</span>
      </div>
    </div>
  );
}
