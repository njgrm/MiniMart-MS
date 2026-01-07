"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  IconCash,
  IconWallet,
  IconMinus,
  IconEqual,
  IconCircleCheck,
  IconClock,
  IconPlus,
  IconReceipt,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CashRegisterData {
  openingFund: number;
  cashSales: number;
  gcashSales: number;
  expenses: number;
  expectedDrawer: number;
  transactionCount: number;
  shiftStartTime?: Date;
  isShiftActive: boolean;
}

interface CashRegisterCardProps {
  data: CashRegisterData;
  className?: string;
}

export function CashRegisterCard({ data, className }: CashRegisterCardProps) {
  const router = useRouter();
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Calculate expected drawer: Opening + Cash Sales - Expenses
  const calculatedDrawer = data.openingFund + data.cashSales - data.expenses;

  return (
    <div className={cn("bg-card rounded-xl border flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <div className="flex items-center gap-2 mb-0.75">
          <IconCash className="mt-1.5 size-4 text-[#2EAFC5]" />
          <h3 className="font-medium text-sm mt-1.5">Cash Register</h3>
        </div>
        <Badge 
          variant="outline" 
          className={cn(
            "text-[10px] px-2 py-0.5",
            data.isShiftActive 
              ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700"
              : "bg-muted text-muted-foreground"
          )}
        >
          {data.isShiftActive ? (
            <>
              <IconCircleCheck className="size-3 mr-1" />
              Shift Active
            </>
          ) : (
            <>
              <IconClock className="size-3 mr-1" />
              Drawer Closed
            </>
          )}
        </Badge>
      </div>

      {/* Cash Breakdown - Compact spacing */}
      <div className="flex-1 p-3 space-y-1">
        {/* Opening Fund */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <IconWallet className="size-3.5" />
            <span>Opening Fund</span>
          </div>
          <span className="text-xs font-medium tabular-nums text-foreground">
            {formatCurrency(data.openingFund)}
          </span>
        </div>

        {/* Divider with Plus */}
        <div className="flex items-center gap-2 text-muted-foreground/50">
          <div className="flex-1 border-t border-dashed" />
          <IconPlus className="size-2.5" />
          <div className="flex-1 border-t border-dashed" />
        </div>

        {/* Cash Sales */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <IconCash className="size-3.5 text-emerald-500" />
            <span>Cash Sales</span>
            <span className="text-[10px] text-muted-foreground/70">
              ({data.transactionCount} txns)
            </span>
          </div>
          <span className="text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            +{formatCurrency(data.cashSales)}
          </span>
        </div>

        {/* GCash Sales (not in drawer but shown for reference) */}
        <div className="flex items-center justify-between py-1 opacity-60">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <IconReceipt className="size-3.5 text-blue-500" />
            <span>GCash Sales</span>
            <span className="text-[10px] text-muted-foreground/70">(digital)</span>
          </div>
          <span className="text-xs font-medium tabular-nums text-blue-600 dark:text-blue-400">
            {formatCurrency(data.gcashSales)}
          </span>
        </div>

        {/* Divider with Minus */}
        <div className="flex items-center gap-2 text-muted-foreground/50">
          <div className="flex-1 border-t border-dashed" />
          <IconMinus className="size-2.5" />
          <div className="flex-1 border-t border-dashed" />
        </div>

        {/* Expenses/Payouts */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <IconMinus className="size-3.5 text-destructive" />
            <span>Expenses/Payouts</span>
          </div>
          <span className="text-xs font-medium tabular-nums text-destructive">
            -{formatCurrency(data.expenses)}
          </span>
        </div>

        {/* Divider with Equal */}
        <div className="flex items-center gap-2 text-muted-foreground/50">
          <div className="flex-1 border-t border-dashed" />
          <IconEqual className="size-2.5" />
          <div className="flex-1 border-t border-dashed" />
        </div>

        {/* Expected Drawer Total - Clear Focal Point */}
        <div className="flex items-center justify-between py-2.5 bg-[#AC0F16]/10 rounded-lg px-3 -mx-1 mt-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#AC0F16]">
            <IconCash className="size-4" />
            <span>Expected Drawer</span>
          </div>
          <span className="text-base font-bold tabular-nums text-[#AC0F16]">
            {formatCurrency(calculatedDrawer)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t bg-muted/20">
        {data.shiftStartTime && (
          <p className="text-[10px] text-muted-foreground text-center mb-2">
            Shift started: {format(data.shiftStartTime, "h:mm a")}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => router.push("/admin/sales")}
          >
            View Sales
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1 h-7 text-xs bg-[#2EAFC5] hover:bg-[#2EAFC5]/90"
            onClick={() => router.push("/admin/sales/financial")}
          >
            End of Day
          </Button>
        </div>
      </div>
    </div>
  );
}
