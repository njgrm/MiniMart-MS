"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  IconPlus,
  IconPackage,
  IconShoppingCart,
  IconArrowRight,
  IconCheck,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { QuickReorderItem } from "@/actions/vendor";

interface QuickReorderRowProps {
  items: QuickReorderItem[];
  onAddToCart?: (item: QuickReorderItem) => void;
}

export function QuickReorderRow({ items, onAddToCart }: QuickReorderRowProps) {
  const router = useRouter();
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleAddToCart = (item: QuickReorderItem) => {
    if (item.current_stock === 0) {
      toast.error(`${item.product_name} is out of stock`);
      return;
    }

    // Navigate to order page with this product
    router.push(`/vendor/order?addProduct=${item.product_id}`);
    
    // Show feedback
    setAddedItems((prev) => new Set([...prev, item.product_id]));
    toast.success(`${item.product_name} will be added to cart`);
    
    // Reset after animation
    setTimeout(() => {
      setAddedItems((prev) => {
        const next = new Set(prev);
        next.delete(item.product_id);
        return next;
      });
    }, 1500);
  };

  // Empty state
  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="text-center py-8">
          <div className="size-12 mx-auto mb-3 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <IconPackage className="size-6 text-zinc-400" />
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">
            No purchase history yet. Start ordering to see your favorites here!
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/vendor/order")}
            className="gap-2"
          >
            Browse Products
            <IconArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h2 className="font-semibold text-[#2d1b1a] dark:text-white">
            Quick Re-order
          </h2>
          <p className="text-xs text-zinc-500">Your most purchased items</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/vendor/order")}
          className="text-[#AC0F16] hover:text-[#8a0c12] gap-1"
        >
          View All
          <IconArrowRight className="size-4" />
        </Button>
      </div>

      {/* Horizontal Scrollable Items */}
      <ScrollArea className="w-full">
        <div className="flex gap-3 p-4">
          {items.map((item) => {
            const isOutOfStock = item.current_stock === 0;
            const isLowStock = item.current_stock > 0 && item.current_stock < 10;
            const wasAdded = addedItems.has(item.product_id);
            const hasSavings = item.wholesale_price < item.retail_price;

            return (
              <div
                key={item.product_id}
                className={cn(
                  "shrink-0 w-[160px] sm:w-[180px] bg-zinc-50 dark:bg-zinc-800/50 rounded-xl overflow-hidden border border-zinc-100 dark:border-zinc-700 transition-all",
                  isOutOfStock && "opacity-60"
                )}
              >
                {/* Product Image */}
                <div className="aspect-square relative bg-zinc-100 dark:bg-zinc-800">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.product_name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <IconPackage className="size-10 text-zinc-300 dark:text-zinc-600" />
                    </div>
                  )}
                  
                  {/* Stock Badge */}
                  {isOutOfStock ? (
                    <Badge className="absolute top-2 right-2 bg-red-500 text-white text-[10px]">
                      Out
                    </Badge>
                  ) : isLowStock ? (
                    <Badge className="absolute top-2 right-2 bg-amber-500 text-white text-[10px]">
                      {item.current_stock} left
                    </Badge>
                  ) : null}

                  {/* Savings Badge */}
                  {hasSavings && !isOutOfStock && (
                    <Badge className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px]">
                      Save {Math.round(((item.retail_price - item.wholesale_price) / item.retail_price) * 100)}%
                    </Badge>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-3">
                  <p className="text-sm font-medium text-[#2d1b1a] dark:text-white line-clamp-2 h-10 leading-tight">
                    {item.product_name}
                  </p>
                  
                  <div className="mt-2 mb-3">
                    <span className="text-base font-bold text-[#AC0F16]">
                      {formatCurrency(item.wholesale_price)}
                    </span>
                    {hasSavings && (
                      <span className="ml-1.5 text-xs text-zinc-400 line-through">
                        {formatCurrency(item.retail_price)}
                      </span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleAddToCart(item)}
                    disabled={isOutOfStock || wasAdded}
                    className={cn(
                      "w-full gap-1.5 text-xs h-8",
                      wasAdded
                        ? "bg-emerald-500 hover:bg-emerald-500"
                        : "bg-[#AC0F16] hover:bg-[#8a0c12]"
                    )}
                  >
                    {wasAdded ? (
                      <>
                        <IconCheck className="size-3.5" />
                        Added!
                      </>
                    ) : (
                      <>
                        <IconPlus className="size-3.5" />
                        Add to Cart
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
