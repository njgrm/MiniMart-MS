"use client";

import { useState, useTransition } from "react";
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
import type { IncomingOrder, OrderStatus } from "@/actions/orders";
import {
  updateOrderStatus,
  cancelOrder,
  completeOrderTransaction,
} from "@/actions/orders";
import { cn } from "@/lib/utils";

interface OrderDetailsSheetProps {
  order: IncomingOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated: () => void;
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
}: OrderDetailsSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

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

  const handleProcessPayment = (paymentMethod: "CASH" | "GCASH") => {
    startTransition(async () => {
      const result = await completeOrderTransaction(order.order_id, paymentMethod);
      if (result.success) {
        toast.success(`Order completed! Receipt: ${result.receiptNo?.substring(0, 8)}...`);
        onOrderUpdated();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to process payment");
      }
    });
    setShowPaymentDialog(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="p-6 pb-0">
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

          <ScrollArea className="flex-1 px-6">
            <div className="space-y-6 pb-6">
              {/* Customer Info */}
              <div className="space-y-3 pt-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Customer Details
                </h3>
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
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
                        "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                        checkedItems.has(item.order_item_id)
                          ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                          : "bg-card border-border hover:bg-muted/50"
                      )}
                      onClick={() => handleToggleItem(item.order_item_id)}
                    >
                      {checkedItems.has(item.order_item_id) ? (
                        <IconSquareCheck className="size-5 text-green-600 dark:text-green-400 shrink-0" />
                      ) : (
                        <IconSquare className="size-5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
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
                      <div className="text-right shrink-0">
                        <p className="font-medium text-sm">×{item.quantity}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>
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
                  <div className="flex items-center justify-between font-semibold">
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
          <div className="p-6 border-t border-border space-y-4 bg-card">
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

      {/* Payment Method Dialog */}
      <AlertDialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Choose how the customer is paying for this order.
              <br />
              <span className="font-semibold text-foreground">
                Total: {formatCurrency(order.total_amount)}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              size="lg"
              className="h-24 flex-col gap-2"
              onClick={() => handleProcessPayment("CASH")}
              disabled={isPending}
            >
              <IconCash className="size-8 text-green-600" />
              <span className="font-semibold">Cash</span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-24 flex-col gap-2"
              onClick={() => handleProcessPayment("GCASH")}
              disabled={isPending}
            >
              <IconDeviceMobile className="size-8 text-blue-600" />
              <span className="font-semibold">GCash</span>
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

