"use client";

import { useState } from "react";
import { Receipt, Eye, Calendar, CreditCard, User, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface TransactionSheetProps {
  transaction: {
    transaction_id: number;
    receipt_no: string;
    created_at: Date;
    total_amount: number;
    status: string;
    itemsCount: number;
    payment_method: string | null;
    amount_tendered: number | null;
    change: number | null;
    items: {
      product_name: string;
      barcode: string | null;
      quantity: number;
      price_at_sale: number;
      cost_at_sale: number;
      subtotal: number;
    }[];
    user?: {
      username: string;
    };
  };
}

export function TransactionSheet({ transaction }: TransactionSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

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

  // Calculate subtotal (sum of all item subtotals)
  const calculateSubtotal = () => {
    return transaction.items.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const calculateTotalCost = () => {
    return transaction.items.reduce((sum, item) => sum + (item.cost_at_sale * item.quantity), 0);
  };

  const calculateTotalProfit = () => {
    return calculateSubtotal() - calculateTotalCost();
  };

  // Total entries count (sum of quantities, not item count)
  const totalEntries = transaction.items.reduce((sum, item) => sum + item.quantity, 0);

  // VAT Calculation (12% VAT inclusive)
  // Since prices include VAT, we calculate backwards:
  // Vatable Sales = Total Due ÷ 1.12
  // VAT = Total Due - Vatable Sales
  const subtotal = calculateSubtotal();
  const netTotal = transaction.total_amount; // This is the gross total after any adjustments
  const vatSales = netTotal / 1.12;
  const vatAmount = netTotal - vatSales;
  const nonVatSales = 0; // Standard store - all items are VAT inclusive

  // Payment info - use actual values from transaction or fallback
  const amountTendered = transaction.amount_tendered ?? netTotal;
  const changeAmount = transaction.change ?? 0;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt #${transaction.receipt_no.substring(0, 8)}</title>
            <style>
              @media print {
                body { margin: 0; padding: 0; }
                .no-print { display: none !important; }
              }
              
              body { 
                font-family: 'Courier New', Consolas, monospace; 
                margin: 0; 
                padding: 10px;
                background: white;
              }
              
              .receipt-container {
                width: 80mm;
                max-width: 80mm;
                margin: 0 auto;
                padding: 0;
                font-size: 11px;
                line-height: 1.3;
              }
              
              .header { 
                text-align: center; 
                margin-bottom: 10px; 
              }
              
              .header h2 {
                margin: 0;
                font-size: 14px;
              }
              
              .header p {
                margin: 1px 0;
                font-size: 10px;
              }
              
              .separator {
                border-top: 1px dashed #000;
                margin: 8px 0;
              }
              
              .info-line {
                display: flex;
                justify-content: space-between;
                margin: 2px 0;
              }
              
              .item {
                margin: 5px 0;
              }
              
              .item-name {
                font-weight: normal;
              }
              
              .item-detail {
                display: flex;
                justify-content: space-between;
                padding-left: 20px;
                font-size: 10px;
              }
              
              .totals {
                margin-top: 10px;
              }
              
              .total-line {
                display: flex;
                justify-content: space-between;
                margin: 2px 0;
              }
              
              .total-bold {
                font-weight: bold;
              }
              
              .footer {
                text-align: center;
                margin-top: 10px;
                font-size: 10px;
              }
              
              .footer p {
                margin: 2px 0;
              }
            </style>
          </head>
          <body>
            <div class="receipt-container">
              <div class="header">
                <h2>CHRISTIAN MINIMART</h2>
                <p>Cor. Fleurdeliz & Concordia Sts.</p>
                <p>Prk. Paghidaet Mansilingan Bacolod City</p>
                <p>Tel No. 09474467550</p>
                <p>TIN: 926-018-860-000 NV</p>
                <p>S/N: DBPDCGU2HVF</p>
                <p>Prop. : Magabilin, Gracyl Gonzales</p>
                <p>Permit No. 014-077-185000-000</p>
                <p>MIN: 140351772</p>
              </div>
              
              <div class="separator"></div>
              
              <div class="info-line">
                <span>Date: ${formatDate(transaction.created_at)}</span>
                <span>Time: ${formatTime(transaction.created_at)}</span>
              </div>
              <p style="margin: 2px 0;">Cashier: ${transaction.user?.username || "System"}</p>
              <p style="margin: 2px 0;">Receipt No. ${transaction.receipt_no.substring(0, 12)}</p>
              <p style="margin: 2px 0;">Sold to: CASH</p>
              
              <div class="separator"></div>
              
              ${transaction.items.map(item => `
                <div class="item">
                  <div class="item-name">[${item.quantity}] ${item.product_name}</div>
                  <div class="item-detail">
                    <span>${item.barcode || "N/A"}</span>
                    <span>${item.price_at_sale.toFixed(2)}</span>
                    <span>${item.subtotal.toFixed(2)}</span>
                  </div>
                </div>
              `).join('')}
              
              <div class="separator"></div>
              
              <div class="total-line">
                <span>Sub Total:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              
              <div class="totals">
                <p style="margin: 2px 0;">Terminal No: 01</p>
                <p style="margin: 2px 0;">Salesman: ${transaction.user?.username || "System"}</p>
                <p style="margin: 2px 0;">Total No. of Entries: ${totalEntries}</p>
                
                <div class="total-line total-bold">
                  <span>Net Total:</span>
                  <span>${netTotal.toFixed(2)}</span>
                </div>
                <div class="total-line">
                  <span>Disc.</span>
                  <span>0.00</span>
                </div>
                <div class="total-line">
                  <span>C Tend:</span>
                  <span>${amountTendered.toFixed(2)}</span>
                </div>
                <div class="total-line total-bold">
                  <span>Change:</span>
                  <span>${changeAmount.toFixed(2)}</span>
                </div>
              </div>
              
              <div class="separator"></div>
              
              <div class="total-line">
                <span>Non VAT Sales:</span>
                <span>${nonVatSales.toFixed(2)}</span>
              </div>
              <div class="total-line">
                <span>VAT Sales:</span>
                <span>${vatSales.toFixed(2)}</span>
              </div>
              <div class="total-line">
                <span>VAT (12%):</span>
                <span>${vatAmount.toFixed(2)}</span>
              </div>
              <div class="total-line total-bold">
                <span>Net Sales:</span>
                <span>${netTotal.toFixed(2)}</span>
              </div>
              
              <div class="separator"></div>
              
              <div class="footer">
                <p style="font-weight: bold;">THANK YOU, COME AGAIN!</p>
                <p>THIS SERVES AS YOUR OFFICIAL RECEIPT</p>
                <p style="margin-top: 5px;">Enyaw POS Software ver. 1.0</p>
                <p>Accred. No. 077-906501861-000338</p>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const getPaymentMethodBadge = (method: string | null) => {
    if (!method) return null;
    
    return method === "CASH" ? (
      <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
        CASH
      </Badge>
    ) : (
      <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
        GCASH
      </Badge>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">View</span>
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-[600px] bg-card p-0 flex flex-col h-full">
        <SheetHeader className="p-4 sm:p-6 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-foreground text-lg">
            <Receipt className="h-5 w-5" />
            Receipt #{transaction.receipt_no.substring(0, 8)}...
          </SheetTitle>
          <SheetDescription className="text-sm">
            Transaction details and receipt preview
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-4 sm:space-y-6">
            {/* Thermal Receipt Style */}
            <div className="bg-white dark:bg-neutral-100 border rounded-lg p-3 sm:p-4 font-mono text-xs sm:text-sm shadow-sm max-w-sm mx-auto text-black">
              {/* Header */}
              <div className="text-center mb-3">
                <h2 className="font-bold text-sm sm:text-base">CHRISTIAN MINIMART</h2>
                <p className="text-[9px] sm:text-[10px]">Cor. Fleurdeliz & Concordia Sts.</p>
                <p className="text-[9px] sm:text-[10px]">Prk. Paghidaet Mansilingan Bacolod City</p>
                <p className="text-[9px] sm:text-[10px]">Tel No. 09474467550</p>
                <p className="text-[9px] sm:text-[10px]">TIN: 926-018-860-000 NV</p>
                <p className="text-[9px] sm:text-[10px]">S/N: DBPDCGU2HVF</p>
                <p className="text-[9px] sm:text-[10px]">Prop. : Magabilin, Gracyl Gonzales</p>
                <p className="text-[9px] sm:text-[10px]">Permit No. 014-077-185000-000</p>
                <p className="text-[9px] sm:text-[10px]">MIN: 140351772</p>
              </div>

              <Separator className="my-2 border-dashed border-black/30" />

              {/* Info */}
              <div className="space-y-0.5 text-[10px] sm:text-xs">
                <div className="flex justify-between">
                  <span>Date: {formatDate(transaction.created_at)}</span>
                  <span>Time: {formatTime(transaction.created_at)}</span>
                </div>
                <p>Cashier: {transaction.user?.username || "System"}</p>
                <p>Receipt No. {transaction.receipt_no.substring(0, 12)}</p>
                <p>Sold to: CASH</p>
              </div>

              <Separator className="my-2 border-dashed border-black/30" />

              {/* Items */}
              <div className="space-y-1.5">
                {transaction.items.map((item, index) => (
                  <div key={index}>
                    <div className="text-[10px] sm:text-xs">[{item.quantity}] {item.product_name}</div>
                    <div className="flex justify-between pl-4 text-[9px] sm:text-[10px] text-gray-600">
                      <span>{item.barcode || "N/A"}</span>
                      <span>{item.price_at_sale.toFixed(2)}</span>
                      <span>{item.subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-2 border-dashed border-black/30" />

              {/* Totals */}
              <div className="space-y-0.5 text-[10px] sm:text-xs">
                <div className="flex justify-between">
                  <span>Sub Total:</span>
                  <span>{subtotal.toFixed(2)}</span>
                </div>
                <p>Terminal No: 01</p>
                <p>Salesman: {transaction.user?.username || "System"}</p>
                <p>Total No. of Entries: {totalEntries}</p>
                <div className="flex justify-between font-bold">
                  <span>Net Total:</span>
                  <span>{netTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Disc.</span>
                  <span>0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>C Tend:</span>
                  <span>{amountTendered.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Change:</span>
                  <span>{changeAmount.toFixed(2)}</span>
                </div>
              </div>

              <Separator className="my-2 border-dashed border-black/30" />

              {/* VAT */}
              <div className="space-y-0.5 text-[10px] sm:text-xs">
                <div className="flex justify-between">
                  <span>Non VAT Sales:</span>
                  <span>{nonVatSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT Sales:</span>
                  <span>{vatSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT (12%):</span>
                  <span>{vatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Net Sales:</span>
                  <span>{netTotal.toFixed(2)}</span>
                </div>
              </div>

              <Separator className="my-2 border-dashed border-black/30" />

              {/* Footer */}
              <div className="text-center text-[9px] sm:text-[10px]">
                <p className="font-bold">THANK YOU, COME AGAIN!</p>
                <p>THIS SERVES AS YOUR OFFICIAL RECEIPT</p>
                <p className="mt-1 text-gray-500">Enyaw POS Software ver. 1.0</p>
                <p className="text-gray-500">Accred. No. 077-906501861-000338</p>
              </div>
            </div>

            {/* Show Details Button */}
            <Button 
              onClick={() => setShowDetails(!showDetails)} 
              variant="outline" 
              className="w-full"
            >
              {showDetails ? "Hide" : "Show"} Profit & Margin Details
            </Button>

            {/* Section C: Detailed View (Hidden by Default) */}
            {showDetails && (
              <div className="space-y-4 sm:space-y-6">
                <Separator />
                
                {/* Transaction Header */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-xs sm:text-sm">Date & Time</p>
                      <p className="text-muted-foreground text-xs truncate">{formatDate(transaction.created_at)} {formatTime(transaction.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium text-xs sm:text-sm">Payment</p>
                      <div>{getPaymentMethodBadge(transaction.payment_method)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium text-xs sm:text-sm">Cashier</p>
                      <p className="text-muted-foreground text-xs">{transaction.user?.username || "System"}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium text-xs sm:text-sm">Status</p>
                      <Badge variant={transaction.status === "COMPLETED" ? "default" : "destructive"} className="text-xs">
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div>
                  <h3 className="font-semibold mb-3 text-sm sm:text-base">Items ({transaction.itemsCount})</h3>
                  <div className="space-y-2 sm:space-y-3">
                    {transaction.items.map((item, index) => (
                      <div key={index} className="border rounded-lg p-3 bg-card">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-sm line-clamp-2">{item.product_name}</h4>
                          <span className="text-xs text-muted-foreground ml-2">#{index + 1}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                          <div>
                            <p className="text-muted-foreground">Qty</p>
                            <p className="font-medium">{item.quantity}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Price</p>
                            <p className="font-medium">{formatCurrency(item.price_at_sale)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Cost</p>
                            <p>{formatCurrency(item.cost_at_sale)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Subtotal</p>
                            <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                          </div>
                        </div>
                        
                        <Separator className="my-2" />
                        
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Profit: {formatCurrency((item.price_at_sale - item.cost_at_sale) * item.quantity)}
                          </span>
                          <span className="text-muted-foreground">
                            Margin: {(((item.price_at_sale - item.cost_at_sale) / item.price_at_sale) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                  <h3 className="font-semibold mb-3 text-sm sm:text-base">Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Revenue:</span>
                      <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cost:</span>
                      <span className="text-rose-600 dark:text-rose-400">{formatCurrency(calculateTotalCost())}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Profit:</span>
                      <span className={`font-medium ${calculateTotalProfit() >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {formatCurrency(calculateTotalProfit())}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Margin:</span>
                      <span>
                        {calculateSubtotal() > 0 
                          ? ((calculateTotalProfit() / calculateSubtotal()) * 100).toFixed(1)
                          : "0"
                        }%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handlePrint} className="flex-1 gap-2" variant="outline">
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button 
                onClick={() => setIsOpen(false)} 
                className="flex-1 gap-2" 
                variant="secondary"
              >
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
