"use client";

import { forwardRef } from "react";

interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface ReceiptData {
  receiptNumber: string;
  date: Date;
  cashierName: string;
  items: ReceiptItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxAmount: number;
  totalDue: number;
  amountTendered: number;
  change: number;
  paymentMethod: "CASH" | "GCASH";
}

interface ReceiptTemplateProps {
  data: ReceiptData | null;
  // Store info - could come from settings
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
}

/**
 * ReceiptTemplate - Hidden component formatted for 58mm/80mm thermal printers
 * Uses monospace font, simple black/white styling
 * Only visible when printing via @media print CSS
 */
export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptTemplateProps>(
  (
    {
      data,
      storeName = "CHRISTIAN MINIMART",
      storeAddress = "123 Main Street, Barangay Centro",
      storePhone = "Tel: (02) 8123-4567",
    },
    ref
  ) => {
    if (!data) return null;

    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat("en-PH", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(date);
    };

    const formatCurrency = (amount: number) => {
      return amount.toFixed(2);
    };

    // Truncate item names to fit receipt width
    const truncateName = (name: string, maxLength: number = 20) => {
      if (name.length <= maxLength) return name.padEnd(maxLength);
      return name.substring(0, maxLength - 3) + "...";
    };

    const separator = "─".repeat(32);
    const doubleSeparator = "═".repeat(32);

    return (
      <div
        ref={ref}
        id="receipt-print-area"
        className="hidden print:block font-mono text-xs leading-tight text-black bg-white p-2"
        style={{
          width: "80mm",
          maxWidth: "80mm",
          fontSize: "12px",
          lineHeight: "1.4",
        }}
      >
        {/* Store Header */}
        <div className="text-center mb-2">
          <p className="font-bold text-sm">{storeName}</p>
          <p className="text-[10px]">{storeAddress}</p>
          <p className="text-[10px]">{storePhone}</p>
        </div>

        <p className="text-center">{separator}</p>

        {/* Receipt Info */}
        <div className="my-2">
          <p>Receipt #: {data.receiptNumber}</p>
          <p>Date: {formatDate(data.date)}</p>
          <p>Cashier: {data.cashierName}</p>
          <p>Payment: {data.paymentMethod}</p>
        </div>

        <p>{separator}</p>

        {/* Items Header */}
        <div className="flex justify-between my-1">
          <span>Item</span>
          <span>Amount</span>
        </div>

        <p>{separator}</p>

        {/* Items List */}
        <div className="my-1 space-y-1">
          {data.items.map((item, index) => (
            <div key={index}>
              <p>{truncateName(item.name, 28)}</p>
              <div className="flex justify-between pl-2">
                <span>
                  {item.quantity} x ₱{formatCurrency(item.price)}
                </span>
                <span>₱{formatCurrency(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        <p>{separator}</p>

        {/* Totals */}
        <div className="my-2 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>₱{formatCurrency(data.subtotal)}</span>
          </div>

          {data.discountAmount > 0 && (
            <div className="flex justify-between">
              <span>Discount ({data.discountPercent}%):</span>
              <span>-₱{formatCurrency(data.discountAmount)}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span>VAT (12%):</span>
            <span>₱{formatCurrency(data.taxAmount)}</span>
          </div>

          <p>{doubleSeparator}</p>

          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL:</span>
            <span>₱{formatCurrency(data.totalDue)}</span>
          </div>

          <p>{separator}</p>

          <div className="flex justify-between">
            <span>Cash Tendered:</span>
            <span>₱{formatCurrency(data.amountTendered)}</span>
          </div>

          <div className="flex justify-between font-bold">
            <span>Change:</span>
            <span>₱{formatCurrency(data.change)}</span>
          </div>
        </div>

        <p>{separator}</p>

        {/* Footer */}
        <div className="text-center mt-3 space-y-1">
          <p className="font-bold">Thank you for shopping!</p>
          <p className="text-[10px]">Please come again</p>
          <p className="text-[10px] mt-2">
            This serves as your Official Receipt
          </p>
        </div>

        {/* Extra space at bottom for paper cutting */}
        <div className="h-8" />
      </div>
    );
  }
);

ReceiptTemplate.displayName = "ReceiptTemplate";





