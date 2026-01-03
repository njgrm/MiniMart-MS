"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  IconX,
  IconClock,
  IconUser,
  IconPhone,
  IconMail,
  IconPackage,
  IconCheck,
  IconPlayerPlay,
  IconCash,
  IconDeviceMobile,
  IconAlertTriangle,
  IconArrowRight,
  IconSquareCheck,
  IconSquare,
  IconPrinter,
  IconTrash,
  IconAlertCircle,
} from "@tabler/icons-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrderPaymentDialog } from "./order-payment-dialog";
import type { IncomingOrder, OrderStatus, OrderReceiptData, ShortageReason } from "@/actions/orders";
import {
  updateOrderStatus,
  cancelOrder,
  completeOrderTransaction,
  markOrderItemUnavailable,
} from "@/actions/orders";
import { getStoreSettings } from "@/actions/settings";
import { cn } from "@/lib/utils";

interface OrderDetailsSheetProps {
  order: IncomingOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated: () => void;
  gcashQrUrl?: string | null;
}

const statusConfig: Record<
  OrderStatus,
  { label: string; className: string; nextStatus?: OrderStatus; nextLabel?: string }
> = {
  PENDING: {
    label: "Pending",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    nextStatus: "PREPARING",
    nextLabel: "Start Packing",
  },
  PREPARING: {
    label: "Preparing",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    nextStatus: "READY",
    nextLabel: "Mark Ready for Pickup",
  },
  READY: {
    label: "Ready for Pickup",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    nextLabel: "Process Payment",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-muted text-muted-foreground",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive",
  },
};

export function OrderDetailsSheet({
  order,
  open,
  onOpenChange,
  onOrderUpdated,
  gcashQrUrl: initialGcashQrUrl,
}: OrderDetailsSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [gcashQrUrl, setGcashQrUrl] = useState<string | null>(initialGcashQrUrl || null);
  
  // Mark Unavailable dialog state
  const [showUnavailableDialog, setShowUnavailableDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    orderItemId: number;
    productName: string;
    quantity: number;
    price: number;
  } | null>(null);
  const [unavailableQty, setUnavailableQty] = useState(1);
  const [unavailableReason, setUnavailableReason] = useState<ShortageReason>("DAMAGE");
  const [unavailableNotes, setUnavailableNotes] = useState("");

  // Fetch GCash QR URL on mount if not provided
  useEffect(() => {
    if (!initialGcashQrUrl && open) {
      getStoreSettings().then((settings) => {
        setGcashQrUrl(settings.gcash_qr_image_url);
      }).catch(console.error);
    }
  }, [initialGcashQrUrl, open]);

  if (!order) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const timeElapsed = formatDistanceToNow(new Date(order.order_date), { addSuffix: true });
  const orderDate = format(new Date(order.order_date), "MMM d, yyyy h:mm a");
  const status = statusConfig[order.status];
  const allItemsChecked = checkedItems.size === order.items.length;

  const handleToggleItem = (itemId: number) => {
    const newSet = new Set(checkedItems);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setCheckedItems(newSet);
  };

  const handleStatusUpdate = () => {
    if (!status.nextStatus) return;

    startTransition(async () => {
      const result = await updateOrderStatus(order.order_id, status.nextStatus!);
      if (result.success) {
        toast.success(`Order status updated to ${statusConfig[status.nextStatus!].label}`);
        onOrderUpdated();
        setCheckedItems(new Set());
      } else {
        toast.error(result.error || "Failed to update status");
      }
    });
  };

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelOrder(order.order_id);
      if (result.success) {
        toast.success("Order cancelled");
        onOrderUpdated();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to cancel order");
      }
    });
    setShowCancelDialog(false);
  };

  // Handler for opening the "Mark Unavailable" dialog
  const handleOpenUnavailableDialog = (item: {
    order_item_id: number;
    product: { product_name: string };
    quantity: number;
    price: number;
  }) => {
    setSelectedItem({
      orderItemId: item.order_item_id,
      productName: item.product.product_name,
      quantity: item.quantity,
      price: item.price,
    });
    setUnavailableQty(1);
    setUnavailableReason("DAMAGE");
    setUnavailableNotes("");
    setShowUnavailableDialog(true);
  };

  // Handler for confirming item unavailability
  const handleMarkUnavailable = () => {
    if (!selectedItem) return;

    startTransition(async () => {
      const result = await markOrderItemUnavailable(
        order.order_id,
        selectedItem.orderItemId,
        unavailableQty,
        unavailableReason,
        unavailableNotes || undefined
      );

      if (result.success) {
        const reasonText = unavailableReason.toLowerCase().replace("_", " ");
        toast.success(
          result.itemRemoved 
            ? `"${result.productName}" removed from order and marked as ${reasonText} in inventory.`
            : `${unavailableQty}x "${result.productName}" marked as ${reasonText}. Order updated.`,
          {
            description: `New order total: ${formatCurrency(result.newTotal || 0)}`,
            duration: 5000,
          }
        );
        onOrderUpdated();
        setShowUnavailableDialog(false);
        setSelectedItem(null);
      } else {
        toast.error(result.error || "Failed to mark item unavailable");
      }
    });
  };

  const handleProcessPayment = async (
    paymentMethod: "CASH" | "GCASH",
    amountTendered: number,
    gcashRefNo?: string
  ) => {
    const result = await completeOrderTransaction(
      order.order_id,
      paymentMethod,
      1, // userId - TODO: get from session
      amountTendered,
      amountTendered - order.total_amount, // change
      gcashRefNo
    );
    
    if (result.success && result.receiptData) {
      toast.success(`Order completed! Receipt: ${result.receiptNo?.substring(0, 8)}...`, {
        description: "Printing receipt...",
        duration: 3000,
      });
      
      // Auto-print receipt with tendered and change info
      printOrderReceipt({
        ...result.receiptData,
        amountTendered,
        change: amountTendered - order.total_amount,
        gcashRefNo,
      });
      
      onOrderUpdated();
      onOpenChange(false);
      setShowPaymentDialog(false);
    } else {
      toast.error(result.error || "Failed to process payment");
      throw new Error(result.error || "Failed to process payment");
    }
  };

  // Auto-print function for order receipts
  // Uses standardized 48mm printable width for 58mm thermal paper
  const printOrderReceipt = (data: OrderReceiptData & { amountTendered?: number; change?: number; gcashRefNo?: string }) => {
    const vatSales = data.totalDue / 1.12;
    const vatAmount = data.totalDue - vatSales;
    const amountTendered = data.amountTendered || data.totalDue;
    const change = data.change || 0;
    
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${data.receiptNo}</title>
          <style>
            @page { margin: 0 5mm; size: 58mm auto; }
            body { 
              font-family: 'Lucida Console', 'Consolas', 'Courier New', monospace; 
              font-size: 9pt; 
              line-height: 1.15;
              padding: 0;
              width: 48mm;
              max-width: 48mm;
              margin: 0;
              background: white;
              color: black;
              -webkit-font-smoothing: none;
              overflow: hidden;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            * { box-sizing: border-box; }
            .center { text-align: center; }
            .bold { font-weight: 700; }
            .separator { border-bottom: 0.5mm dashed #000; margin: 1mm 0; }
            .flex { display: flex; justify-content: space-between; gap: 1mm; }
            .mt-1 { margin-top: 2mm; }
            .item-line { margin: 1mm 0; word-wrap: break-word; overflow-wrap: break-word; }
            .item-name { word-wrap: break-word; overflow-wrap: break-word; max-width: 100%; }
            .logo-container { display: flex; justify-content: center; margin-bottom: 2mm; }
            .logo { width: 40mm; max-width: 40mm; height: auto; filter: grayscale(100%); }
            .total-section { font-weight: 700; font-size: 11pt; align-items: flex-end; margin-top: 2mm; }
            .store-name { font-size: 11pt; font-weight: 700; }
            .small-text { font-size: 8pt; }
          </style>
        </head>
        <body>
          <div class="center" style="margin-bottom: 2mm;">
            <div class="logo-container">
              <img src="${window.location.origin}/christian_minimart_logo.png" alt="Logo" class="logo" />
            </div>
            <div class="store-name">CHRISTIAN MINIMART</div>
            <div class="small-text item-name">Cor. Fleurdeliz & Concordia Sts.</div>
            <div class="small-text item-name">Prk. Paghidaet Mansilingan Bacolod City</div>
            
            <div class="flex mt-1 small-text"><span>Tel No.</span><span>09474467550</span></div>
            <div class="flex small-text"><span>TIN:</span><span>926-018-860-000 NV</span></div>
            <div class="flex small-text"><span>S/N:</span><span>DBPDCGU2HVF</span></div>
            <div class="flex small-text"><span>Prop.:</span><span>Magabilin, Gracyl</span></div>
            <div class="flex small-text"><span>Permit:</span><span>014-077-185000</span></div>
            <div class="flex small-text"><span>MIN:</span><span>140351772</span></div>
          </div>

          <div class="separator"></div>

          <div style="margin: 2mm 0;">
            <div class="flex">
              <span><span class="bold">Date:</span> ${format(new Date(data.date), "MM/dd/yy")}</span>
              <span>${format(new Date(data.date), "HH:mm")}</span>
            </div>
            <div class="item-name"><span class="bold">Cashier:</span> ${data.cashierName}</div>
            <div class="item-name"><span class="bold">Rcpt #:</span> ${data.receiptNo.substring(0, 12)}</div>
            <div class="item-name"><span class="bold">Sold to:</span> ${data.customerName}</div>
          </div>

          <div class="separator"></div>

          <div style="margin: 2mm 0;">
            ${data.items.map(item => `
              <div class="item-line">
                <div class="bold item-name">${item.quantity} x ${item.name}</div>
                <div class="flex">
                  <span>@${item.price.toFixed(2)}</span>
                  <span>${item.subtotal.toFixed(2)}</span>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="separator"></div>

          <div style="margin: 2mm 0;">
            <div class="flex"><span>Sub Total:</span><span>${data.subtotal.toFixed(2)}</span></div>
          </div>

          <div style="margin-top: 1mm;">
            <div>Items: ${data.items.reduce((sum, i) => sum + i.quantity, 0)}</div>
            <div class="flex total-section">
              <span>TOTAL:</span>
              <span>P${data.totalDue.toFixed(2)}</span>
            </div>
            <div class="flex"><span>${data.paymentMethod}:</span><span>${amountTendered.toFixed(2)}</span></div>
            <div class="flex bold"><span>CHANGE:</span><span>${change.toFixed(2)}</span></div>
            ${data.gcashRefNo ? `<div class="flex small-text"><span>Ref #:</span><span>${data.gcashRefNo}</span></div>` : ''}
          </div>

          <div class="separator"></div>

          <div style="margin: 2mm 0;" class="small-text">
            <div class="flex"><span>VAT Sales:</span><span>${vatSales.toFixed(2)}</span></div>
            <div class="flex"><span>VAT (12%):</span><span>${vatAmount.toFixed(2)}</span></div>
            <div class="flex"><span>Exempt:</span><span>0.00</span></div>
          </div>

          <div class="separator"></div>

          <div class="center" style="margin-top: 3mm;">
            <div class="bold">THANK YOU!</div>
            <div class="small-text">OFFICIAL RECEIPT</div>
            <div style="font-size: 7pt; margin-top: 2mm;">Enyaw POS Ver. 1.0</div>
            <div style="font-size: 7pt;">Accred: 077-906501861-000338</div>
          </div>
          <div style="height: 10mm;"></div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=320,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0 h-full bg-card dark:bg-background">
          {/* Fixed Header */}
          <SheetHeader className="p-6 pb-4 border-b border-border shrink-0 bg-card">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-xl">Order #{order.order_id}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 mt-1">
                  <IconClock className="size-4" />
                  {orderDate} ({timeElapsed})
                </SheetDescription>
              </div>
              <Badge className={cn("text-sm px-3 py-1", status.className)}>
                {status.label}
              </Badge>
            </div>
          </SheetHeader>

          {/* Scrollable Content - uses calc to account for header (~100px) and footer (~200px) */}
          <ScrollArea className="flex-1 h-[calc(100vh-300px)]">
            <div className="space-y-6 pb-6 px-6">
              {/* Customer Info */}
              <div className="space-y-3 pt-0">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Customer Details
                </h3>
                <div className="bg-card rounded-lg p-4 space-y-2 border border-border">
                  <div className="flex items-center gap-3">
                    <IconUser className="size-5 text-primary" />
                    <span className="font-medium">{order.customer.name}</span>
                  </div>
                  {order.customer.contact_details && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <IconPhone className="size-4" />
                      <span>{order.customer.contact_details}</span>
                    </div>
                  )}
                  {order.customer.email && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <IconMail className="size-4" />
                      <span>{order.customer.email}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Packing List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Packing List
                  </h3>
                  <span className="text-sm text-muted-foreground">
                    {checkedItems.size}/{order.items.length} checked
                  </span>
                </div>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div
                      key={item.order_item_id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        checkedItems.has(item.order_item_id)
                          ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                          : "bg-card border-border hover:bg-muted/50"
                      )}
                    >
                      {/* Checkbox - clickable */}
                      <button
                        onClick={() => handleToggleItem(item.order_item_id)}
                        className="shrink-0"
                      >
                        {checkedItems.has(item.order_item_id) ? (
                          <IconSquareCheck className="size-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <IconSquare className="size-5 text-muted-foreground hover:text-foreground" />
                        )}
                      </button>
                      
                      {/* Item info - clickable to toggle */}
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleToggleItem(item.order_item_id)}
                      >
                        <p className={cn(
                          "font-medium text-sm truncate",
                          checkedItems.has(item.order_item_id) && "line-through text-muted-foreground"
                        )}>
                          {item.product.product_name}
                        </p>
                        {item.product.barcode && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {item.product.barcode}
                          </p>
                        )}
                      </div>
                      
                      {/* Quantity and price */}
                      <div className="text-right shrink-0 mr-2">
                        <p className="font-medium text-sm">×{item.quantity}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>
                      
                      {/* Mark Unavailable button - only show for PENDING/PREPARING orders */}
                      {(order.status === "PENDING" || order.status === "PREPARING") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenUnavailableDialog(item);
                          }}
                          title="Mark as unavailable"
                        >
                          <IconAlertCircle className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Order Summary */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Order Summary
                </h3>
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Items</span>
                    <span>{totalItems}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono">{formatCurrency(order.total_amount)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between font-medium">
                    <span>Total</span>
                    <span className="font-mono text-lg text-primary">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Action Buttons */}
          <div className="py-2 px-6 border-t border-border space-y-2 bg-card">
            {/* Progress indicator */}
            {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
              <div className="flex items-center justify-center gap-2 text-sm pb-2">
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full",
                  order.status === "PENDING" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-medium" : "text-muted-foreground"
                )}>
                  <span className="size-2 rounded-full bg-current" />
                  Pending
                </div>
                <IconArrowRight className="size-4 text-muted-foreground" />
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full",
                  order.status === "PREPARING" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium" : "text-muted-foreground"
                )}>
                  <span className="size-2 rounded-full bg-current" />
                  Packing
                </div>
                <IconArrowRight className="size-4 text-muted-foreground" />
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full",
                  order.status === "READY" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium" : "text-muted-foreground"
                )}>
                  <span className="size-2 rounded-full bg-current" />
                  Ready
                </div>
              </div>
            )}

            {/* Instruction text based on status */}
            {order.status === "PENDING" && (
              <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                <p className="text-sm text-orange-700 dark:text-orange-400">
                  <strong>New order!</strong> Click &quot;Start Packing&quot; to begin preparing this order.
                </p>
              </div>
            )}
            
            {order.status === "PREPARING" && !allItemsChecked && (
              <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  <strong>Packing in progress!</strong> Check off all items above, then click &quot;Mark Ready&quot;.
                </p>
              </div>
            )}
            
            {order.status === "PREPARING" && allItemsChecked && (
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-400">
                  <strong>All items checked!</strong> Click &quot;Mark Ready for Pickup&quot; to notify the customer.
                </p>
              </div>
            )}

            {/* Primary Action */}
            {order.status === "READY" ? (
              <Button
                className="w-full gap-2 h-12 text-base"
                size="lg"
                onClick={() => setShowPaymentDialog(true)}
                disabled={isPending}
              >
                <IconCash className="size-5" />
                Process Payment & Complete
              </Button>
            ) : status.nextStatus ? (
              <Button
                className={cn(
                  "w-full gap-2 h-12 text-base",
                  order.status === "PENDING" && "bg-orange-500 hover:bg-orange-600 text-white",
                  order.status === "PREPARING" && allItemsChecked && "bg-green-500 hover:bg-green-600 text-white"
                )}
                size="lg"
                onClick={handleStatusUpdate}
                disabled={isPending || (!allItemsChecked && order.status === "PREPARING")}
              >
                {isPending ? (
                  <>
                    <span className="size-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Updating...
                  </>
                ) : order.status === "PENDING" ? (
                  <>
                    <IconPlayerPlay className="size-5" />
                    Start Packing
                  </>
                ) : (
                  <>
                    <IconCheck className="size-5" />
                    Mark Ready for Pickup
                  </>
                )}
              </Button>
            ) : null}

            {/* Secondary Actions */}
            {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowCancelDialog(true)}
                disabled={isPending}
              >
                <IconX className="size-4" />
                Cancel Order
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconAlertTriangle className="size-5 text-destructive" />
              Cancel Order?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The order will be marked as cancelled
              and the customer will need to place a new order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog - Full-featured with change calculation */}
      <OrderPaymentDialog
        open={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        onConfirm={handleProcessPayment}
        order={order}
        initialGcashQrUrl={gcashQrUrl}
      />

      {/* Mark Item Unavailable Dialog */}
      <AlertDialog open={showUnavailableDialog} onOpenChange={setShowUnavailableDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconAlertCircle className="size-5 text-orange-500" />
              Mark Item Unavailable
            </AlertDialogTitle>
            <AlertDialogDescription>
              Report a shortage for this item. The inventory will be adjusted and the order total will be recalculated.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedItem && (
            <div className="space-y-4 py-2">
              {/* Item Info */}
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium text-sm">{selectedItem.productName}</p>
                <p className="text-xs text-muted-foreground">
                  Order has {selectedItem.quantity} × {formatCurrency(selectedItem.price)} = {formatCurrency(selectedItem.quantity * selectedItem.price)}
                </p>
              </div>

              {/* Quantity Selection */}
              <div className="space-y-2">
                <Label htmlFor="unavailable-qty" className="text-sm font-medium">
                  Quantity Unavailable
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setUnavailableQty(Math.max(1, unavailableQty - 1))}
                    disabled={unavailableQty <= 1}
                  >
                    -
                  </Button>
                  <Input
                    id="unavailable-qty"
                    type="number"
                    min={1}
                    max={selectedItem.quantity}
                    value={unavailableQty}
                    onChange={(e) => setUnavailableQty(Math.min(selectedItem.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-20 text-center"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setUnavailableQty(Math.min(selectedItem.quantity, unavailableQty + 1))}
                    disabled={unavailableQty >= selectedItem.quantity}
                  >
                    +
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    of {selectedItem.quantity}
                  </span>
                </div>
              </div>

              {/* Reason Selection */}
              <div className="space-y-2">
                <Label htmlFor="unavailable-reason" className="text-sm font-medium">
                  Reason
                </Label>
                <Select value={unavailableReason} onValueChange={(v) => setUnavailableReason(v as ShortageReason)}>
                  <SelectTrigger id="unavailable-reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAMAGE">Damaged / Spoiled</SelectItem>
                    <SelectItem value="MISSING">Missing / Not Found</SelectItem>
                    <SelectItem value="INTERNAL_USE">Internal Use</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Optional Notes */}
              <div className="space-y-2">
                <Label htmlFor="unavailable-notes" className="text-sm font-medium">
                  Notes (Optional)
                </Label>
                <Input
                  id="unavailable-notes"
                  placeholder="e.g., Expired, broken packaging..."
                  value={unavailableNotes}
                  onChange={(e) => setUnavailableNotes(e.target.value)}
                />
              </div>

              {/* Impact Preview */}
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-sm">
                <p className="font-medium text-orange-700 dark:text-orange-400">What will happen:</p>
                <ul className="text-xs text-orange-600 dark:text-orange-300 mt-1 space-y-0.5">
                  <li>• {unavailableQty === selectedItem.quantity ? "Item will be removed from order" : `Quantity reduced by ${unavailableQty}`}</li>
                  <li>• Order total reduced by {formatCurrency(unavailableQty * selectedItem.price)}</li>
                  <li>• Inventory adjusted: -{unavailableQty} ({unavailableReason.toLowerCase().replace("_", " ")})</li>
                </ul>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedItem(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkUnavailable}
              disabled={isPending}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              {isPending ? "Processing..." : "Confirm & Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

