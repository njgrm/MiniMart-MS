"use client";

import { useState } from "react";
import { Receipt, Eye, Calendar, CreditCard, User, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetOverlay } from "@/components/ui/sheet";
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
    items: {
      product_name: string;
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  // VAT-Inclusive Calculations (Standard PH Retail)
  const calculateTotalDue = () => {
    return transaction.items.reduce((sum, item) => sum + (item.price_at_sale * item.quantity), 0);
  };

  const calculateVatableSales = () => {
    return calculateTotalDue() / 1.12;
  };

  const calculateVAT = () => {
    return calculateTotalDue() - calculateVatableSales();
  };

  const calculateTotalCost = () => {
    return transaction.items.reduce((sum, item) => sum + (item.cost_at_sale * item.quantity), 0);
  };

  const calculateTotalProfit = () => {
    return calculateTotalDue() - calculateTotalCost();
  };

  const handlePrint = () => {
    // Create print window with thermal receipt styling
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
                .print-container { 
                  width: 80mm !important; 
                  max-width: 80mm !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
              }
              
              body { 
                font-family: 'Courier New', monospace; 
                margin: 20px; 
                background: white;
              }
              
              .receipt-container {
                width: 80mm;
                max-width: 80mm;
                margin: 0 auto;
                padding: 0;
                font-size: 12px;
                line-height: 1.4;
              }
              
              .header { 
                text-align: center; 
                margin-bottom: 15px; 
                border-bottom: 1px dashed #000;
                padding-bottom: 10px;
              }
              
              .items { 
                margin: 15px 0; 
              }
              
              .item { 
                display: flex; 
                justify-content: space-between; 
                margin: 3px 0; 
                font-size: 11px;
              }
              
              .totals { 
                border-top: 1px dashed #000; 
                padding-top: 10px; 
                margin-top: 10px; 
              }
              
              .total-line { 
                display: flex; 
                justify-content: space-between; 
                margin: 3px 0; 
              }
              
              .total-due {
                font-size: 14px;
                font-weight: bold;
                border-top: 2px dashed #000;
                padding-top: 8px;
                margin-top: 8px;
              }
              
              .vat-breakdown {
                font-size: 10px;
                color: #666;
                margin: 5px 0;
              }
            </style>
          </head>
          <body>
            <div class="receipt-container print-container">
              <div class="header">
                <h2 style="margin: 0; font-size: 16px;">CHRISTIAN MINIMART</h2>
                <p style="margin: 2px 0; font-size: 10px;">Official Receipt</p>
                <p style="margin: 2px 0; font-size: 10px;">Receipt #: ${transaction.receipt_no.substring(0, 8)}</p>
                <p style="margin: 2px 0; font-size: 10px;">${formatDate(transaction.created_at)}</p>
                <p style="margin: 2px 0; font-size: 10px;">Cashier: ${transaction.user?.username || "System"}</p>
              </div>
              
              <div class="items">
                ${transaction.items.map(item => `
                  <div class="item">
                    <span>${item.quantity}x ${item.product_name.substring(0, 20)}${item.product_name.length > 20 ? '...' : ''}</span>
                    <span>${formatCurrency(item.subtotal)}</span>
                  </div>
                `).join('')}
              </div>
              
              
                
                <div class="vat-breakdown">
                  <div class="total-line">
                    <span>Vatable Sales:</span>
                    <span>${formatCurrency(calculateVatableSales())}</span>
                  </div>
                  <div class="total-line">
                    <span>VAT (12%):</span>
                    <span>${formatCurrency(calculateVAT())}</span>
                  </div>
                </div>

                <div class="totals">
                <div class="total-line total-due">
                  <span>TOTAL DUE:</span>
                  <span>${formatCurrency(calculateTotalDue())}</span>
                </div>
                
                <div style="border-top: 1px dashed #000; margin: 10px 0; padding-top: 10px;">
                  <div class="total-line">
                    <span>Payment Method:</span>
                    <span>${transaction.payment_method || 'N/A'}</span>
                  </div>
                  <div class="total-line">
                    <span>Amount Tendered:</span>
                    <span>${formatCurrency(calculateTotalDue())}</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px;">
                <p style="margin: 2px 0; font-size: 11px;">Thank you for your purchase!</p>
                <p style="margin: 2px 0; font-size: 10px;">Please come again</p>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      
      // Wait for content to load, then print
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const getPaymentMethodBadge = (method: string | null) => {
    if (!method) return null;
    
    return method === "CASH" ? (
      <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
        CASH
      </Badge>
    ) : (
      <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
        GCASH
      </Badge>
    );
  };

  const [showDetails, setShowDetails] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Eye className="h-4 w-4" />
          View
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-[600px] bg-card p-0 flex flex-col h-full">
        <SheetHeader className="p-6 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Receipt className="h-5 w-5" />
            Receipt #{transaction.receipt_no.substring(0, 8)}...
          </SheetTitle>
          <SheetDescription>
            Transaction details and item breakdown
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Section A: The Receipt (Default View) */}
          <div className="space-y-6">
            {/* Thermal Receipt Style */}
            <div className="bg-white border rounded-lg p-4 font-mono text-sm shadow-sm max-w-sm mx-auto">
              {/* Header */}
              <div className="text-center mb-4">
                <h2 className="font-bold text-lg">CHRISTIAN MINIMART</h2>
                <p className="text-xs text-muted-foreground">Official Receipt</p>
                <p className="text-xs">{formatDate(transaction.created_at)}</p>
                <p className="text-xs">Receipt #{transaction.receipt_no.substring(0, 8)}...</p>
                <p className="text-xs">Cashier: {transaction.user?.username || "System"}</p>
              </div>

              <Separator className="my-3 border-dashed" />

              {/* Items */}
              <div className="space-y-1">
                {transaction.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.quantity}x {item.product_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{formatCurrency(item.subtotal)}</div>
                    </div>
                  </div>
                ))}
              </div>

              

              {/* VAT-Inclusive Calculations - Correct Display Order */}
              <div className="space-y-2">
                {/* Total Due (Large, Bold) */}
              

                <Separator className="my-2 border-dashed" />

                {/* VAT Breakdown (Subtext) */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Vatable Sales:</span>
                    <span>{formatCurrency(calculateVatableSales())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT (12%):</span>
                    <span>{formatCurrency(calculateVAT())}</span>
                  </div>
                </div>
              </div>

              

              <div className="flex justify-between items-center text-lg font-bold border-t-2 border-dashed pt-2 mt-2">
                  <span>TOTAL DUE:</span>
                  <span>{formatCurrency(calculateTotalDue())}</span>
                </div>

              {/* Payment */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span>{transaction.payment_method || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Tendered:</span>
                  <span>{formatCurrency(calculateTotalDue())}</span>
                </div>
                <div className="flex justify-between">
                  <span>Change:</span>
                  <span>{formatCurrency(0)}</span>
                </div>
              </div>

              <div className="text-center mt-4 text-xs text-muted-foreground border-t border-dashed pt-3">
                <p>Thank you for your purchase!</p>
                <p>Please come again.</p>
              </div>
            </div>

            {/* Show Details Button */}
            <Button 
              onClick={() => setShowDetails(!showDetails)} 
              variant="outline" 
              className="w-95 flex justify-center bg-card items-center mx-auto"
            >
              {showDetails ? "Hide" : "Show"} Profit & Margin Details
            </Button>

            {/* Section C: Detailed View (Hidden by Default) */}
            {showDetails && (
              <div className="space-y-6">
                <Separator />
                
                {/* Transaction Header */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Date & Time</p>
                      <p className="text-muted-foreground">{formatDate(transaction.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Payment Method</p>
                      <div>{getPaymentMethodBadge(transaction.payment_method)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Cashier</p>
                      <p className="text-muted-foreground">{transaction.user?.username || "System"}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Status</p>
                      <Badge variant={transaction.status === "COMPLETED" ? "default" : "destructive"}>
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div>
                  <h3 className="font-semibold mb-4">Items Purchased ({transaction.itemsCount})</h3>
                  <div className="space-y-3">
                    {transaction.items.map((item, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-card">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium">{item.product_name}</h4>
                          <span className="text-sm text-muted-foreground">#{index + 1}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Quantity</p>
                            <p className="font-medium">{item.quantity}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Unit Price</p>
                            <p className="font-medium">{formatCurrency(item.price_at_sale)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Cost Price</p>
                            <p className="text-sm">{formatCurrency(item.cost_at_sale)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Subtotal</p>
                            <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                          </div>
                        </div>
                        
                        <Separator className="my-2" />
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Profit: {formatCurrency((item.price_at_sale - item.cost_at_sale) * item.quantity)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Margin: {(((item.price_at_sale - item.cost_at_sale) / item.price_at_sale) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Transaction Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Revenue:</span>
                      <span className="font-medium">{formatCurrency(calculateTotalDue())}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Cost:</span>
                      <span>{formatCurrency(calculateTotalCost())}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Net Profit:</span>
                      <span className={`font-medium ${calculateTotalProfit() >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(calculateTotalProfit())}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Profit Margin:</span>
                      <span>
                        {calculateTotalDue() > 0 
                          ? ((calculateTotalProfit() / calculateTotalDue()) * 100).toFixed(1)
                          : "0"
                        }%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button onClick={handlePrint} className="gap-2" variant="outline">
                <Printer className="h-4 w-4" />
                Print Receipt
              </Button>
              <Button 
                onClick={() => setIsOpen(false)} 
                className="gap-2" 
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
