"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconAlertTriangle, IconAlertCircle, IconArrowRight, IconX } from "@tabler/icons-react";
import { getInventoryAlerts } from "@/actions/inventory";

interface StockAlerts {
  outOfStock: number;
  lowStock: number;
}

/**
 * Global Stock Alerts Component
 * Displays floating toast-style alerts for stock issues
 * Visible across all admin pages
 */
export function StockAlerts() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<StockAlerts>({ outOfStock: 0, lowStock: 0 });
  const [dismissed, setDismissed] = useState<{ outOfStock: boolean; lowStock: boolean }>({
    outOfStock: false,
    lowStock: false,
  });
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const fetchAlerts = async () => {
      try {
        const result = await getInventoryAlerts();
        if (result) {
          setAlerts(result);
          setError(false);
        }
      } catch (err) {
        console.error("Failed to fetch inventory alerts:", err);
        setError(true);
      }
    };
    
    // Fetch alerts on mount
    fetchAlerts();
    
    // Refresh alerts every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);

    return () => clearInterval(interval);
  }, []);

  if (!mounted || error) return null;

  const hasOutOfStock = alerts.outOfStock > 0 && !dismissed.outOfStock;
  const hasLowStock = alerts.lowStock > 0 && !dismissed.lowStock;

  if (!hasOutOfStock && !hasLowStock) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 animate-in slide-in-from-right-5 duration-300">
      {hasOutOfStock && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 shadow-lg hover:shadow-xl transition-shadow">
          <button
            onClick={() => router.push("/admin/inventory?status=out")}
            className="flex items-center gap-2 flex-1"
          >
            <IconAlertTriangle className="size-4 text-destructive" />
            <span className="text-xs font-medium text-destructive">{alerts.outOfStock} out of stock</span>
            <IconArrowRight className="size-3 text-destructive/70" />
          </button>
          <button
            onClick={() => setDismissed(prev => ({ ...prev, outOfStock: true }))}
            className="p-0.5 rounded hover:bg-destructive/20 transition-colors"
          >
            <IconX className="size-3 text-destructive/70" />
          </button>
        </div>
      )}
      
      {hasLowStock && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F1782F]/10 border border-[#F1782F]/30 shadow-lg hover:shadow-xl transition-shadow">
          <button
            onClick={() => router.push("/admin/inventory?status=low")}
            className="flex items-center gap-2 flex-1"
          >
            <IconAlertCircle className="size-4 text-[#F1782F]" />
            <span className="text-xs font-medium text-[#F1782F]">{alerts.lowStock} low stock</span>
            <IconArrowRight className="size-3 text-[#F1782F]/70" />
          </button>
          <button
            onClick={() => setDismissed(prev => ({ ...prev, lowStock: true }))}
            className="p-0.5 rounded hover:bg-[#F1782F]/20 transition-colors"
          >
            <IconX className="size-3 text-[#F1782F]/70" />
          </button>
        </div>
      )}
    </div>
  );
}
