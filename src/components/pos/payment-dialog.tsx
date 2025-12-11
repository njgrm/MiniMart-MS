"use client";

import { useState, useEffect, useRef } from "react";
import { CreditCard, Banknote, Smartphone, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: "CASH" | "GCASH", amountTendered: number) => Promise<void>;
  // Transaction summary
  itemCount: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxAmount: number;
  totalDue: number;
}

export function PaymentDialog({
  open,
  onClose,
  onConfirm,
  itemCount,
  subtotal,
  discountPercent,
  discountAmount,
  taxAmount,
  totalDue,
}: PaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "GCASH">("CASH");
  const [amountTendered, setAmountTendered] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus amount input when dialog opens
  useEffect(() => {
    if (open) {
      setAmountTendered("");
      setPaymentMethod("CASH");
      // Small delay to ensure dialog is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const tenderedAmount = parseFloat(amountTendered || "0");
  const change = tenderedAmount - totalDue;
  const canConfirm = tenderedAmount >= totalDue && !isProcessing;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setIsProcessing(true);
    try {
      await onConfirm(paymentMethod, tenderedAmount);
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick amount buttons
  const quickAmounts = [50, 100, 200, 500, 1000];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 bg-primary/5 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CreditCard className="h-5 w-5 text-primary" />
            Confirm Payment
          </DialogTitle>
        </DialogHeader>

        {/* Content - Two Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Left Column - Transaction Summary */}
          <div className="p-6 border-r border-border bg-muted/30">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4">
              Transaction Summary
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Items</span>
                <span className="font-medium">{itemCount}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">₱{subtotal.toFixed(2)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Discount ({discountPercent}%)
                  </span>
                  <span className="font-mono text-secondary">
                    -₱{discountAmount.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT (12%)</span>
                <span className="font-mono">₱{taxAmount.toFixed(2)}</span>
              </div>

              <Separator />

              <div className="flex justify-between items-center pt-2">
                <span className="text-base font-medium">Total Due</span>
                <span className="font-mono text-2xl font-medium text-primary">
                  ₱{totalDue.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column - Payment Inputs */}
          <div className="p-4 space-y-5">
            {/* Payment Method */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Payment Method
              </label>
              <Tabs
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as "CASH" | "GCASH")}
                className="w-full"
              >
                <TabsList className="w-full grid grid-cols-2 h-12">
                  <TabsTrigger value="CASH" className="gap-2 text-sm h-10">
                    <Banknote className="h-4 w-4" />
                    Cash
                  </TabsTrigger>
                  <TabsTrigger value="GCASH" className="gap-2 text-sm h-10">
                    <Smartphone className="h-4 w-4" />
                    GCash
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Amount Tendered */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Amount Tendered
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                  ₱
                </span>
                <Input
                  ref={inputRef}
                  type="number"
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                  placeholder="0.00"
                  className="h-14 pl-8 text-2xl font-mono text-right pr-4"
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex gap-2 mt-3">
                {quickAmounts.map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 font-mono text-xs"
                    onClick={() => setAmountTendered(amount.toString())}
                  >
                    {amount}
                  </Button>
                ))}
              </div>

              {/* Exact Amount Button */}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full mt-2 font-medium font-mono"
                onClick={() => setAmountTendered(totalDue.toFixed(2))}
              >
                Exact Amount (₱{totalDue.toFixed(2)})
              </Button>
            </div>

            {/* Change Due */}
            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Change Due
                </span>
                <span
                  className={cn(
                    "font-mono text-2xl font-medium",
                    change < 0 ? "text-muted-foreground" : "text-primary"
                  )}
                >
                  ₱{Math.abs(change).toFixed(2)}
                  {change < 0 && (
                    <span className="text-xs ml-1 font-normal">(short)</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {isProcessing ? (
              "Processing..."
            ) : (
              <>
                <Check className="h-4 w-4" />
                Confirm & Print Receipt
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



