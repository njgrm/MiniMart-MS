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
        className="hidden print:block font-mono text-black bg-white"
        style={{
          width: "58mm",
          maxWidth: "58mm",
          fontSize: "10pt",
          lineHeight: "1.2", // Slightly looser for readability with bold text
          fontFamily: '"Lucida Console", Consolas, monospace',
          // fontWeight: "bold", -- Removed global bold
          fontWeight: "normal",
          WebkitFontSmoothing: "none",
          padding: "0",
          margin: "0"
        }}
      >
        {/* Store Header - Exact Match */}
        <div className="text-center" style={{ marginBottom: "2mm" }}>
          <div className="flex justify-center mb-1">
            <img 
              src="/christian_minimart_logo.png" 
              alt="Logo" 
              style={{ width: "50mm", height: "auto", filter: "grayscale(100%)" }} 
            />
          </div>
          <p style={{ fontWeight: "bold", fontSize: "14pt" }}>CHRISTIAN MINIMART</p>
          <p>Cor. Fleurdeliz & Concordia Sts.</p>
          <p>Prk. Paghidaet Mansilingan Bacolod City</p>
          
          <div className="flex justify-between mt-1">
            <span>Tel No.</span>
            <span>09474467550</span>
          </div>
          <div className="flex justify-between">
            <span>TIN:</span>
            <span>926-018-860-000 NV</span>
          </div>
          <div className="flex justify-between">
            <span>S/N:</span>
            <span>DBPDCGU2HVF</span>
          </div>
          <div className="flex justify-between">
            <span>Prop.:</span>
            <span>Magabilin, Gracyl</span>
          </div>
          <div className="flex justify-between">
            <span>Permit No.:</span>
            <span>014-077-185000</span>
          </div>
          <div className="flex justify-between">
            <span>MIN:</span>
            <span>140351772</span>
          </div>
        </div>

        <div className="w-full border-b-2 border-black my-0.5 border-solid"></div>

        {/* Receipt Info */}
        <div className="my-1 text-[11pt]">
          <div className="flex justify-between">
            <span><span className="font-bold">Date:</span> {formatDate(data.date)}</span>
            <span>{formatTime(data.date)}</span>
          </div>
          <p><span className="font-bold">Cashier:</span> {data.cashierName || "System"}</p>
          <p><span className="font-bold">Rcpt #:</span> {data.receiptNumber.substring(0, 15)}</p>
          <p><span className="font-bold">Sold to:</span> {data.customerName || "CASH"}</p>
        </div>

        <div className="w-full border-b-2 border-black my-0.5 border-solid"></div>

        {/* Items List - Exact Format */}
        <div className="my-1 space-y-1">
          {data.items.map((item, index) => (
            <div key={index}>
              <p className="font-bold leading-tight">{item.quantity} x {item.name}</p>
              <div className="flex justify-between">
                <span>@{formatCurrency(item.price)}</span>
                <span>{formatCurrency(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="w-full border-b-2 border-black my-0.5 border-solid"></div>

        {/* Totals - Exact Format */}
        <div className="my-1">
          <div className="flex justify-between">
            <span>Sub Total:</span>
            <span>{formatCurrency(data.subtotal)}</span>
          </div>
        </div>

        <div className="my-1 space-y-0.5">
          <p>Items: {totalEntries}</p>
          <div className="flex justify-between font-bold text-xl items-end mt-1">
            <span>TOTAL:</span>
            <span style={{ transform: "scaleX(1.1)", transformOrigin: "right", display: "inline-block" }}>
              P{formatCurrency(data.totalDue)}
            </span>
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
            <span>CASH:</span>
            <span>{formatCurrency(data.amountTendered)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>CHANGE:</span>
            <span>{formatCurrency(data.change)}</span>
          </div>
        </div>

        <div className="w-full border-b-2 border-black my-0.5 border-solid"></div>

        {/* VAT Breakdown - Compact */}
        <div className="my-1 space-y-0.5 text-[10pt]">
          <div className="flex justify-between">
            <span>VAT Sales:</span>
            <span>{formatCurrency(vatSales)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT (12%):</span>
            <span>{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Exempt:</span>
            <span>{formatCurrency(nonVatSales)}</span>
          </div>
        </div>

        <div className="w-full border-b-2 border-black my-0.5 border-solid"></div>

        {/* Footer - Exact Match */}
        <div className="text-center mt-2 space-y-0.5">
          <p className="font-bold">THANK YOU!</p>
          <p className="text-[10pt]">OFFICIAL RECEIPT</p>
          <p className="text-[9pt] mt-1">Enyaw POS Ver. 1.0</p>
          <p className="text-[9pt]">Accred: 077-906501861-000338</p>
        </div>

        {/* Extra space at bottom for paper cutting */}
        <div className="h-4" />
      </div>
    );
  }
);

ReceiptTemplate.displayName = "ReceiptTemplate";
