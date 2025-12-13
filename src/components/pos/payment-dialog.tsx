"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import { CreditCard, Banknote, Smartphone, Check, Upload, QrCode, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { uploadImageRaw } from "@/actions/upload";
import { updateGcashQr } from "@/actions/settings";
import { toast } from "sonner";

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    paymentMethod: "CASH" | "GCASH",
    amountTendered: number,
    gcashRefNo?: string
  ) => Promise<void>;
  // Transaction summary
  itemCount: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxAmount: number;
  totalDue: number;
  /** Initial GCash QR code URL from database */
  initialGcashQrUrl?: string | null;
}

// Payment method options
const paymentMethods = [
  { id: "CASH" as const, label: "Cash", icon: Banknote },
  { id: "GCASH" as const, label: "GCash", icon: Smartphone },
];

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
  initialGcashQrUrl,
}: PaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "GCASH">("CASH");
  const [amountTendered, setAmountTendered] = useState<string>("");
  const [gcashRefNo, setGcashRefNo] = useState<string>("");
  const [gcashQrImage, setGcashQrImage] = useState<string>(initialGcashQrUrl || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with initial QR URL when it changes
  useEffect(() => {
    if (initialGcashQrUrl) {
      setGcashQrImage(initialGcashQrUrl);
    }
  }, [initialGcashQrUrl]);

  // Auto-focus amount input when dialog opens
  useEffect(() => {
    if (open) {
      setAmountTendered("");
      setGcashRefNo("");
      setPaymentMethod("CASH");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const tenderedAmount = parseFloat(amountTendered || "0");
  const change = tenderedAmount - totalDue;
  
  // For GCash, we need both tendered amount >= total AND reference number
  const canConfirmCash = paymentMethod === "CASH" && tenderedAmount >= totalDue && !isProcessing;
  const canConfirmGcash = paymentMethod === "GCASH" && tenderedAmount >= totalDue && gcashRefNo.trim().length > 0 && !isProcessing;
  const canConfirm = canConfirmCash || canConfirmGcash;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setIsProcessing(true);
    try {
      await onConfirm(paymentMethod, tenderedAmount, paymentMethod === "GCASH" ? gcashRefNo : undefined);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle QR code image upload - saves to server and database
  const handleQrUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingQr(true);
    try {
      // Upload the image to the server (without background removal for QR codes)
      const result = await uploadImageRaw(file);
      
      if (!result.success || !result.path) {
        toast.error("Failed to upload QR code image");
        return;
      }
      
      // Save the path to the database
      const saveResult = await updateGcashQr(result.path);
      
      if (!saveResult.success) {
        toast.error("Failed to save QR code to settings");
        return;
      }
      
      // Update local state
      setGcashQrImage(result.path);
      toast.success("GCash QR code updated successfully");
    } catch (error) {
      console.error("Error uploading QR code:", error);
      toast.error("An error occurred while uploading the QR code");
    } finally {
      setIsUploadingQr(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Quick amount buttons
  const quickAmounts = [20, 50, 100, 500, 1000];

  const isGcash = paymentMethod === "GCASH";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className={cn(
          "p-0 gap-0 overflow-hidden transition-all duration-300",
          isGcash ? "sm:max-w-[900px]" : "sm:max-w-[600px]"
        )}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 bg-primary/5 dark:bg-card border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CreditCard className="h-5 w-5 text-primary dark:text-foreground" />
            Confirm Payment
          </DialogTitle>
        </DialogHeader>

        {/* Content - Horizontal Flex Layout */}
        <div className="flex flex-col md:flex-row">
          {/* Left Panel - Fixed: Transaction Summary + Payment Inputs */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {/* Transaction Summary */}
              <div className="p-5 border-r border-border bg-muted/30">
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
                    <span className="font-mono text-2xl font-medium text-primary dark:text-foreground">
                      ₱{totalDue.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Inputs */}
              <div className="p-4 space-y-4">
                {/* Payment Method - Segmented Control with Sliding Highlight */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Payment Method
                  </label>
                  <div className="relative flex bg-muted rounded-lg p-1">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={cn(
                          "relative flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-md z-10 transition-colors duration-200",
                          paymentMethod === method.id
                            ? "text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {/* Sliding background highlight */}
                        {paymentMethod === method.id && (
                          <motion.div
                            layoutId="payment-method-highlight"
                            className="absolute inset-0 bg-primary rounded-md shadow-sm"
                            transition={{ type: "tween", stiffness: 1000, damping: 10 }}
                          />
                        )}
                        <method.icon className="h-4 w-4 relative z-10" />
                        <span className="relative z-10">{method.label}</span>
                      </button>
                    ))}
                  </div>
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
                      Change:
                    </span>
                    <span
                      className={cn(
                        "font-mono text-2xl font-medium",
                        change < 0 
                          ? "text-muted-foreground" 
                          : "text-primary dark:text-foreground"
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
          </div>

          {/* Right Panel - Collapsible: GCash QR Section */}
          <AnimatePresence mode="wait">
            {isGcash && (
              <motion.div
                key="gcash-panel"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 300, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 30,
                  opacity: { duration: 0.2 }
                }}
                className="border-l border-border bg-muted/20 overflow-hidden flex-shrink-0"
              >
                <div className="w-[300px] p-3 flex flex-col items-center">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 w-full text-center">
                    Scan to Pay
                  </h3>

                  {/* QR Code Display - Larger */}
                  <div className="relative group w-56 h-56 rounded-xl border-2 border-dashed border-border bg-white dark:bg-card flex items-center justify-center overflow-hidden shadow-sm">
                    {isUploadingQr ? (
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <span className="text-sm">Uploading...</span>
                      </div>
                    ) : gcashQrImage ? (
                      <img
                        src={gcashQrImage}
                        alt="GCash QR Code"
                        className="w-full h-full object-contain p-3"
                        onError={() => setGcashQrImage("")}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <QrCode className="h-16 w-16" />
                        <span className="text-sm">No QR uploaded</span>
                      </div>
                    )}

                    {/* Upload Overlay - Admin Feature (hidden while uploading) */}
                    {!isUploadingQr && (
                      <div
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-xl"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="flex flex-col items-center gap-2 text-white">
                          <Upload className="h-8 w-8" />
                          <span className="text-sm font-medium">Upload QR</span>
                        </div>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleQrUpload}
                      className="hidden"
                      aria-label="Upload GCash QR Code"
                      title="Upload GCash QR Code"
                      disabled={isUploadingQr}
                    />
                  </div>

                  {/* Reference Number Input - Mandatory */}
                  <div className="w-full mt-5">
                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                      Reference No. <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      value={gcashRefNo}
                      onChange={(e) => setGcashRefNo(e.target.value)}
                      placeholder="Enter GCash reference number"
                      className="h-11 font-mono text-sm"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
