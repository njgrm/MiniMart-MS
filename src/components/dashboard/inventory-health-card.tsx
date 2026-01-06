"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconPackage,
  IconClock,
  IconPlus,
  IconTag,
  IconShoppingCart,
  IconCalendarDue,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface LowStockItem {
  product_id: number;
  product_name: string;
  current_stock: number;
  reorder_level: number;
  category: string;
  image_url?: string | null;
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
  const stockPercentage = Math.round((item.current_stock / item.reorder_level) * 100);
  const isOutOfStock = item.current_stock === 0;
  const isCritical = item.current_stock <= item.reorder_level * 0.3;

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
            isOutOfStock 
              ? "bg-destructive/20 text-destructive" 
              : isCritical
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
          )}>
            {isOutOfStock ? "Out of Stock" : `${item.current_stock} left`}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Reorder: {item.reorder_level}
          </span>
        </div>
        {/* Stock Bar */}
        {!isOutOfStock && (
          <div className="w-full h-1 bg-muted rounded-full mt-1.5 overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all",
                isCritical ? "bg-destructive" : "bg-[#F1782F]"
              )}
              style={{ width: `${Math.min(stockPercentage, 100)}%` }}
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
  const isUrgent = item.days_until_expiry <= 3;
  const isExpired = item.days_until_expiry <= 0;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
    }).format(new Date(date));
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
              : isUrgent
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
          )}>
            <IconCalendarDue className="size-3" />
            {isExpired 
              ? "Expired" 
              : `${item.days_until_expiry} day${item.days_until_expiry !== 1 ? 's' : ''} left`
            }
          </span>
          <span className="text-[10px] text-muted-foreground">
            {item.current_stock} units
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Expires: {formatDate(item.expiry_date)}
        </p>
      </div>
      
      {/* Action */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); onDiscount(); }}
      >
        <IconTag className="size-3 mr-1" />
        Discount
      </Button>
    </div>
  );
}

export function InventoryHealthCard({ data, className }: InventoryHealthCardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("low-stock");

  const handleAddToPO = (productId: number) => {
    // Navigate to vendor page with product pre-selected for PO
    router.push(`/admin/vendor?addProduct=${productId}`);
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-2 mx-3 mt-2 h-8">
          <TabsTrigger value="low-stock" className="text-xs h-7 data-[state=active]:bg-[#F1782F] data-[state=active]:text-white">
            <IconShoppingCart className="size-3 mr-1.5" />
            Low Stock
            {data.lowStockCount + data.outOfStockCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 text-[9px] px-1">
                {data.lowStockCount + data.outOfStockCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="expiring" className="text-xs h-7 data-[state=active]:bg-[#F1782F] data-[state=active]:text-white">
            <IconClock className="size-3 mr-1.5" />
            Expiring Soon
            {data.expiringCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 text-[9px] px-1">
                {data.expiringCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="low-stock" className="flex-1 mt-0 px-2">
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
        </TabsContent>

        <TabsContent value="expiring" className="flex-1 mt-0 px-2">
          <ScrollArea className="h-[400px]">
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
        </TabsContent>
      </Tabs>

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
