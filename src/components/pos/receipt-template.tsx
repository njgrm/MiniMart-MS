"use client";

import { forwardRef } from "react";

interface ReceiptItem {
  name: string;
  barcode?: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface ReceiptData {
  receiptNumber: string;
  date: Date;
  cashierName: string;
  customerName?: string;
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
}

/**
 * ReceiptTemplate - Exact format for Christian Minimart thermal receipt
 * Uses monospace font, 80mm width for thermal printers
 * 
 * VAT Calculation Rules:
 * - Total Due (Gross Sales): Sum of all items (Price x Qty) after discount
 * - Vatable Sales (VAT Sales): Total Due ÷ 1.12 (assuming 12% VAT inclusive)
 * - VAT Amount (12%): Total Due - Vatable Sales
 * - Non-VAT Sales: Items with no tax (0 for standard store)
 * - Subtotal: Total before discount
 * - Net Total: After discount (= Total Due)
 */
export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptTemplateProps>(
  ({ data }, ref) => {
    if (!data) return null;

    const formatDate = (date: Date) => {
      const d = new Date(date);
      return d.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "2-digit",
      });
    };

    const formatTime = (date: Date) => {
      const d = new Date(date);
      return d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    };

    const formatCurrency = (amount: number) => {
      return amount.toFixed(2);
    };

    const separator = "─".repeat(40);

    // Total entries count (sum of quantities)
    const totalEntries = data.items.reduce((sum, item) => sum + item.quantity, 0);

    // VAT Calculation (12% VAT inclusive)
    // Since prices include VAT, we calculate backwards:
    // Vatable Sales = Total Due ÷ 1.12
    // VAT = Total Due - Vatable Sales
    const vatSales = data.totalDue / 1.12;
    const vatAmount = data.totalDue - vatSales;
    const nonVatSales = 0; // Standard store - all items are VAT inclusive
    const netSales = data.totalDue;

    return (
      <div
        ref={ref}
        id="receipt-print-area"
        className="hidden print:block font-mono text-[11px] leading-tight text-black bg-white p-2"
        style={{
          width: "80mm",
          maxWidth: "80mm",
          fontSize: "11px",
          lineHeight: "1.3",
          fontFamily: "Consolas, Monaco, 'Courier New', monospace",
        }}
      >
        {/* Store Header - Exact Match */}
        <div className="text-center mb-2">
          <p className="font-bold text-sm">CHRISTIAN MINIMART</p>
          <p>Cor. Fleurdeliz & Concordia Sts.</p>
          <p>Prk. Paghidaet Mansilingan Bacolod City</p>
          <p>Tel No. 09474467550</p>
          <p>TIN: 926-018-860-000 NV</p>
          <p>S/N: DBPDCGU2HVF</p>
          <p>Prop. : Magabilin, Gracyl Gonzales</p>
          <p>Permit No. 014-077-185000-000</p>
          <p>MIN: 140351772</p>
        </div>

        <p>{separator}</p>

        {/* Receipt Info */}
        <div className="my-2">
          <div className="flex justify-between">
            <span>Date: {formatDate(data.date)}</span>
            <span>Time: {formatTime(data.date)}</span>
          </div>
          <p>Cashier: {data.cashierName || "System"}</p>
          <p>Receipt No. {data.receiptNumber.substring(0, 12)}</p>
          <p>Sold to: {data.customerName || "CASH"}</p>
        </div>

        <p>{separator}</p>

        {/* Items List - Exact Format */}
        <div className="my-2 space-y-2">
          {data.items.map((item, index) => (
            <div key={index}>
              <p>[{item.quantity}] {item.name}</p>
              <div className="flex justify-between pl-6">
                <span>{item.barcode || "N/A"}</span>
                <span>{formatCurrency(item.price)}</span>
                <span>{formatCurrency(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        <p>{separator}</p>

        {/* Totals - Exact Format */}
        <div className="my-2">
          <div className="flex justify-between">
            <span>Sub Total:</span>
            <span>{formatCurrency(data.subtotal)}</span>
          </div>
        </div>

        <div className="my-2 space-y-1">
          <p>Terminal No: 01</p>
          <p>Salesman: {data.cashierName || "System"}</p>
          <p>Total No. of Entries: {totalEntries}</p>
          <div className="flex justify-between font-bold">
            <span>Net Total:</span>
            <span>{formatCurrency(data.totalDue)}</span>
          </div>
          {data.discountAmount > 0 && (
            <div className="flex justify-between">
              <span>Disc. ({data.discountPercent}%):</span>
              <span>-{formatCurrency(data.discountAmount)}</span>
            </div>
          )}
          {data.discountAmount === 0 && (
            <div className="flex justify-between">
              <span>Disc.</span>
              <span>{formatCurrency(0)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>C Tend:</span>
            <span>{formatCurrency(data.amountTendered)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Change:</span>
            <span>{formatCurrency(data.change)}</span>
          </div>
        </div>

        <p>{separator}</p>

        {/* VAT Breakdown - Correct 12% VAT calculation */}
        <div className="my-2 space-y-1">
          <div className="flex justify-between">
            <span>Non VAT Sales:</span>
            <span>{formatCurrency(nonVatSales)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT Sales:</span>
            <span>{formatCurrency(vatSales)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT (12%):</span>
            <span>{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Net Sales:</span>
            <span>{formatCurrency(netSales)}</span>
          </div>
        </div>

        <p>{separator}</p>

        {/* Footer - Exact Match */}
        <div className="text-center mt-3 space-y-1">
          <p className="font-bold">THANK YOU, COME AGAIN!</p>
          <p>THIS SERVES AS YOUR OFFICIAL RECEIPT</p>
          <p className="text-[10px] mt-2">POS Retailer Phis Software ver. 1.3</p>
          <p className="text-[10px]">Accred. No. 077-906501861-000338</p>
        </div>

        {/* Extra space at bottom for paper cutting */}
        <div className="h-8" />
      </div>
    );
  }
);

ReceiptTemplate.displayName = "ReceiptTemplate";
