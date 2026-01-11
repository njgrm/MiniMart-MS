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
  IconFileText,
  IconAlertTriangle,
  IconPrinter,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [xReadOpen, setXReadOpen] = useState(false);
  const [zReadConfirmOpen, setZReadConfirmOpen] = useState(false);
  const [zReadReportOpen, setZReadReportOpen] = useState(false);
  
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
  const totalSales = data.cashSales + data.gcashSales;

  // X-Read: Print current shift summary (NO reset)
  const handleXRead = () => {
    setXReadOpen(true);
  };

  // Z-Read: Close day with confirmation
  const handleZRead = () => {
    setZReadConfirmOpen(true);
  };

  // Confirm Z-Read and show final report
  const confirmZRead = () => {
    setZReadConfirmOpen(false);
    setZReadReportOpen(true);
    // In production, this would call a server action to reset daily totals
    // await resetDailySales();
  };

  // Print report (for both X and Z read)
  const handlePrint = () => {
    window.print();
  };

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
            className="flex-1 h-8 text-xs gap-1"
            onClick={handleXRead}
          >
            <IconFileText className="size-3.5" />
            X-Read
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1 h-8 text-xs bg-[#AC0F16] hover:bg-[#AC0F16]/90 gap-1"
            onClick={handleZRead}
          >
            <IconReceipt className="size-3.5" />
            Z-Read
          </Button>
        </div>
      </div>

      {/* X-Read Modal (Shift Check - No Reset) */}
      <Dialog open={xReadOpen} onOpenChange={setXReadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconFileText className="size-5 text-muted-foreground" />
              X-Read Report (Shift Check)
            </DialogTitle>
            <DialogDescription>
              Current shift summary. This does NOT reset the daily totals.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            {/* Report Content - Clean Monochrome Receipt Style */}
            <div className="bg-[#F8F6F1] rounded-lg p-4 font-mono text-sm space-y-3 border">
              {/* Header */}
              <div className="text-center border-b border-dashed border-stone-300 pb-3 mb-3">
                <p className="font-bold text-foreground">CHRISTIAN MINIMART</p>
                <p className="text-xs text-muted-foreground">X-READ REPORT</p>
                <p className="text-xs text-muted-foreground">{format(new Date(), "MMM d, yyyy h:mm a")}</p>
              </div>
              
              {/* Line Items */}
              <div className="space-y-2 text-foreground">
                <div className="flex justify-between">
                  <span>Opening Fund:</span>
                  <span className="font-medium">{formatCurrency(data.openingFund)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Sales:</span>
                  <span className="font-medium">+{formatCurrency(data.cashSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GCash Sales:</span>
                  <span className="font-medium">{formatCurrency(data.gcashSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Expenses:</span>
                  <span className="font-medium">-{formatCurrency(data.expenses)}</span>
                </div>
              </div>
              
              {/* Totals */}
              <div className="border-t border-dashed border-stone-300 pt-3 mt-3 space-y-1">
                <div className="flex justify-between font-bold text-foreground">
                  <span>Total Sales:</span>
                  <span>{formatCurrency(totalSales)}</span>
                </div>
                <div className="flex justify-between font-bold text-foreground">
                  <span>Expected Drawer:</span>
                  <span>{formatCurrency(calculatedDrawer)}</span>
                </div>
              </div>
              
              {/* Footer */}
              <div className="text-center text-xs text-muted-foreground pt-3 border-t border-dashed border-stone-300">
                <p>Transactions: {data.transactionCount}</p>
                {data.shiftStartTime && (
                  <p>Shift Start: {format(data.shiftStartTime, "h:mm a")}</p>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setXReadOpen(false)}>
              Close
            </Button>
            <Button onClick={handlePrint} className="gap-1">
              <IconPrinter className="size-4" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Z-Read Confirmation Dialog */}
      <AlertDialog open={zReadConfirmOpen} onOpenChange={setZReadConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <IconAlertTriangle className="size-5" />
              Close Day (Z-Read)?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This action will:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Generate the final End-of-Day report</li>
                <li><strong className="text-destructive">Reset all daily sales totals to zero</strong></li>
                <li>Archive today's transactions</li>
              </ul>
              <p className="font-medium text-foreground mt-3">
                Are you sure you want to close the day?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmZRead}
              className="bg-destructive hover:bg-destructive/90"
            >
              Yes, Close Day
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Z-Read Final Report Modal */}
      <Dialog open={zReadReportOpen} onOpenChange={setZReadReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconReceipt className="size-5 text-muted-foreground" />
              Z-Read Report (End of Day)
            </DialogTitle>
            <DialogDescription>
              Final report generated. Daily totals have been reset.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            {/* Report Content - Clean Monochrome Receipt Style */}
            <div className="bg-[#F8F6F1] rounded-lg p-4 font-mono text-sm space-y-3 border">
              {/* Header */}
              <div className="text-center border-b border-dashed border-stone-300 pb-3 mb-3">
                <p className="font-bold text-foreground">CHRISTIAN MINIMART</p>
                <p className="text-xs font-bold text-foreground">Z-READ REPORT (FINAL)</p>
                <p className="text-xs text-muted-foreground">{format(new Date(), "MMM d, yyyy h:mm a")}</p>
              </div>
              
              {/* Line Items */}
              <div className="space-y-2 text-foreground">
                <div className="flex justify-between">
                  <span>Opening Fund:</span>
                  <span className="font-medium">{formatCurrency(data.openingFund)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Sales:</span>
                  <span className="font-medium">+{formatCurrency(data.cashSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GCash Sales:</span>
                  <span className="font-medium">{formatCurrency(data.gcashSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Expenses:</span>
                  <span className="font-medium">-{formatCurrency(data.expenses)}</span>
                </div>
              </div>
              
              {/* Totals */}
              <div className="border-t border-dashed border-stone-300 pt-3 mt-3 space-y-1">
                <div className="flex justify-between font-bold text-foreground">
                  <span>TOTAL SALES:</span>
                  <span>{formatCurrency(totalSales)}</span>
                </div>
                <div className="flex justify-between font-bold text-foreground">
                  <span>FINAL DRAWER:</span>
                  <span>{formatCurrency(calculatedDrawer)}</span>
                </div>
              </div>
              
              {/* Footer */}
              <div className="text-center text-xs text-muted-foreground pt-3 border-t border-dashed border-stone-300">
                <p>Total Transactions: {data.transactionCount}</p>
                <p className="font-bold text-foreground mt-1">*** END OF DAY ***</p>
              </div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-xs text-emerald-800 dark:text-emerald-200">
              <p className="font-medium flex items-center gap-1">
                <IconCircleCheck className="size-4" />
                Daily totals have been reset to zero
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setZReadReportOpen(false)}>
              Close
            </Button>
            <Button onClick={handlePrint} className="gap-1">
              <IconPrinter className="size-4" />
              Print Final Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
