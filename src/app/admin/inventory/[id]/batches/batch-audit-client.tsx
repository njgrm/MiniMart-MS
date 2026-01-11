"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, differenceInDays, isBefore, startOfDay } from "date-fns";
import {
  ArrowLeft,
  Package,
  Calendar,
  Truck,
  AlertTriangle,
  Edit,
  Trash2,
  RefreshCw,
  Layers,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  type BatchInfo,
  adjustBatchQuantity,
  deleteBatch,
  editBatchExpiry,
  getProductBatches,
  returnBatchToSupplier,
} from "@/actions/inventory";

interface ProductInfo {
  product_id: number;
  product_name: string;
  category: string;
  current_stock: number;
  nearest_expiry_date: Date | null;
}

interface BatchAuditClientProps {
  product: ProductInfo;
  initialBatches: BatchInfo[];
}

function getExpiryStatus(expiryDate: Date | null): {
  label: string;
  variant: "destructive" | "secondary" | "outline";
  isExpired: boolean;
  isExpiringSoon: boolean;
} {
  if (!expiryDate) {
    return { label: "No Expiry", variant: "outline", isExpired: false, isExpiringSoon: false };
  }

  const today = startOfDay(new Date());
  const expiry = startOfDay(new Date(expiryDate));
  const daysUntilExpiry = differenceInDays(expiry, today);

  if (isBefore(expiry, today)) {
    return { label: "Expired", variant: "destructive", isExpired: true, isExpiringSoon: false };
  }

  if (daysUntilExpiry <= 30) {
    return {
      label: `${daysUntilExpiry}d left`,
      variant: "secondary",
      isExpired: false,
      isExpiringSoon: true,
    };
  }

  return { label: format(expiryDate, "MMM d, yyyy"), variant: "outline", isExpired: false, isExpiringSoon: false };
}

export function BatchAuditClient({ product, initialBatches }: BatchAuditClientProps) {
  const router = useRouter();
  const [batches, setBatches] = useState<BatchInfo[]>(initialBatches);
  const [isPending, startTransition] = useTransition();
  
  // Edit quantity dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchInfo | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editReason, setEditReason] = useState("");
  
  // Edit expiry dialog state
  const [expiryDialogOpen, setExpiryDialogOpen] = useState(false);
  const [editingExpiryBatch, setEditingExpiryBatch] = useState<BatchInfo | null>(null);
  const [newExpiryDate, setNewExpiryDate] = useState("");
  const [expiryReason, setExpiryReason] = useState("");
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState<BatchInfo | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  // Return to supplier dialog state
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returningBatch, setReturningBatch] = useState<BatchInfo | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnSupplier, setReturnSupplier] = useState("");

  const refreshBatches = async () => {
    startTransition(async () => {
      const newBatches = await getProductBatches(product.product_id);
      setBatches(newBatches);
      router.refresh();
    });
  };

  const openEditDialog = (batch: BatchInfo) => {
    setEditingBatch(batch);
    setEditQuantity(batch.quantity.toString());
    setEditReason("");
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingBatch) return;

    const newQty = parseInt(editQuantity, 10);
    if (isNaN(newQty) || newQty < 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    if (!editReason.trim() || editReason.trim().length < 3) {
      toast.error("Please provide a reason (min 3 characters)");
      return;
    }

    startTransition(async () => {
      const result = await adjustBatchQuantity({
        batchId: editingBatch.id,
        newQuantity: newQty,
        reason: editReason.trim(),
      });

      if (result.success) {
        toast.success("Batch quantity adjusted");
        setEditDialogOpen(false);
        await refreshBatches();
      } else {
        toast.error(result.error || "Failed to adjust batch");
      }
    });
  };

  // Edit expiry handlers
  const openExpiryDialog = (batch: BatchInfo) => {
    setEditingExpiryBatch(batch);
    setNewExpiryDate(batch.expiry_date ? format(new Date(batch.expiry_date), "yyyy-MM-dd") : "");
    setExpiryReason("");
    setExpiryDialogOpen(true);
  };

  const handleExpirySubmit = async () => {
    if (!editingExpiryBatch) return;

    if (!expiryReason.trim() || expiryReason.trim().length < 3) {
      toast.error("Please provide a reason (min 3 characters)");
      return;
    }

    startTransition(async () => {
      const result = await editBatchExpiry({
        batchId: editingExpiryBatch.id,
        newExpiryDate: newExpiryDate ? new Date(newExpiryDate) : null,
        reason: expiryReason.trim(),
      });

      if (result.success) {
        toast.success("Expiry date updated");
        setExpiryDialogOpen(false);
        await refreshBatches();
      } else {
        toast.error(result.error || "Failed to update expiry date");
      }
    });
  };

  const openDeleteDialog = (batch: BatchInfo) => {
    setDeletingBatch(batch);
    setDeleteReason("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingBatch) return;

    if (!deleteReason.trim() || deleteReason.trim().length < 3) {
      toast.error("Please provide a reason (min 3 characters)");
      return;
    }

    startTransition(async () => {
      const result = await deleteBatch(deletingBatch.id, deleteReason.trim());

      if (result.success) {
        toast.success(`Removed ${deletingBatch.quantity} units (batch deleted)`);
        setDeleteDialogOpen(false);
        await refreshBatches();
      } else {
        toast.error(result.error || "Failed to delete batch");
      }
    });
  };

  // Return to supplier handlers
  const openReturnDialog = (batch: BatchInfo) => {
    setReturningBatch(batch);
    setReturnReason("");
    setReturnSupplier(batch.supplier_name || "");
    setReturnDialogOpen(true);
  };

  const handleReturnConfirm = async () => {
    if (!returningBatch) return;

    if (!returnReason.trim() || returnReason.trim().length < 3) {
      toast.error("Please provide a reason (min 3 characters)");
      return;
    }

    startTransition(async () => {
      const result = await returnBatchToSupplier(
        returningBatch.id, 
        returnReason.trim(),
        returnSupplier.trim() || undefined
      );

      if (result.success) {
        toast.success(`Returned ${returningBatch.quantity} units to supplier`);
        setReturnDialogOpen(false);
        await refreshBatches();
      } else {
        toast.error(result.error || "Failed to return batch to supplier");
      }
    });
  };

  // Calculate totals
  const totalBatches = batches.length;
  const totalUnits = batches.reduce((sum, b) => sum + b.quantity, 0);
  const expiredBatches = batches.filter(b => getExpiryStatus(b.expiry_date).isExpired);
  const expiringSoonBatches = batches.filter(b => getExpiryStatus(b.expiry_date).isExpiringSoon);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/inventory">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#2d1b1a] flex items-center gap-2">
              <Layers className="h-6 w-6 text-[#AC0F16]" />
              Batch Inventory
            </h1>
            <p className="text-muted-foreground">
              {product.product_name} • {product.category}
            </p>
          </div>
        </div>
        <Button onClick={refreshBatches} variant="outline" disabled={isPending}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#F9F6F0] border border-[#EDE5D8] rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Package className="h-4 w-4" />
            Total Stock
          </div>
          <p className="text-2xl font-bold text-[#2d1b1a] font-mono">{totalUnits}</p>
        </div>
        <div className="bg-[#F9F6F0] border border-[#EDE5D8] rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Layers className="h-4 w-4" />
            Total Batches
          </div>
          <p className="text-2xl font-bold text-[#2d1b1a] font-mono">{totalBatches}</p>
        </div>
        <div className="bg-[#F9F6F0] border border-[#EDE5D8] rounded-lg p-4">
          <div className="flex items-center gap-2 text-[#F1782F] text-sm">
            <AlertTriangle className="h-4 w-4" />
            Expiring Soon
          </div>
          <p className="text-2xl font-bold text-[#F1782F] font-mono">{expiringSoonBatches.length}</p>
        </div>
        <div className="bg-[#F9F6F0] border border-[#EDE5D8] rounded-lg p-4">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4" />
            Expired
          </div>
          <p className="text-2xl font-bold text-destructive font-mono">{expiredBatches.length}</p>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-[#F9F6F0] border border-[#EDE5D8] rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#EDE5D8]">
              <TableHead className="font-semibold">Batch ID</TableHead>
              <TableHead className="font-semibold">Quantity</TableHead>
              <TableHead className="font-semibold">Expiry Date</TableHead>
              <TableHead className="font-semibold">Received</TableHead>
              <TableHead className="font-semibold">Supplier</TableHead>
              <TableHead className="font-semibold">Cost Price</TableHead>
              <TableHead className="font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No batches found. Restock this product to create batches.
                </TableCell>
              </TableRow>
            ) : (
              batches.map((batch) => {
                const expiryStatus = getExpiryStatus(batch.expiry_date);
                return (
                  <TableRow
                    key={batch.id}
                    className={cn(
                      expiryStatus.isExpired && "bg-destructive/5",
                      expiryStatus.isExpiringSoon && "bg-[#F1782F]/5"
                    )}
                  >
                    <TableCell className="font-mono text-sm">#{batch.id}</TableCell>
                    <TableCell className="font-mono font-semibold">
                      {batch.quantity}
                      {batch.quantity === 0 && (
                        <Badge variant="outline" className="ml-2 text-xs">Empty</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={expiryStatus.variant}>
                        {expiryStatus.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {format(new Date(batch.received_date), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {batch.supplier_name ? (
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                          {batch.supplier_name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {batch.supplier_ref && (
                        <span className="text-xs text-muted-foreground block">
                          Ref: {batch.supplier_ref}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      {batch.cost_price ? `₱${batch.cost_price.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(batch)}
                          disabled={isPending}
                          title="Edit Quantity"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openExpiryDialog(batch)}
                          disabled={isPending}
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-950/50"
                          title="Edit Expiry Date"
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => openDeleteDialog(batch)}
                          disabled={isPending}
                          title="Delete Batch"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={getExpiryStatus(batch.expiry_date).isExpired 
                            ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50" 
                            : "text-muted-foreground hover:text-foreground"
                          }
                          onClick={() => openReturnDialog(batch)}
                          disabled={isPending}
                          title="Return to Supplier"
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* FEFO Explanation */}
      <div className="bg-[#2EAFC5]/10 border border-[#2EAFC5]/30 rounded-lg p-4">
        <h3 className="font-semibold text-[#2d1b1a] mb-2">How FEFO Works</h3>
        <p className="text-sm text-muted-foreground">
          <strong>First Expired, First Out (FEFO)</strong>: When items are sold at the POS, stock is
          automatically deducted from the batch with the earliest expiry date first. This minimizes
          spoilage and ensures older stock is sold before newer deliveries.
        </p>
      </div>

      {/* Edit Quantity Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Adjust Batch Quantity</DialogTitle>
            <DialogDescription>
              {editingBatch && (
                <>
                  Batch #{editingBatch.id} • Current: {editingBatch.quantity} units
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-quantity">New Quantity</Label>
              <Input
                id="edit-quantity"
                type="number"
                min="0"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-reason">Reason for Adjustment *</Label>
              <Textarea
                id="edit-reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="e.g., Physical count correction, damaged items removed..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Expiry Dialog */}
      <Dialog open={expiryDialogOpen} onOpenChange={setExpiryDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <Calendar className="h-5 w-5" />
              Edit Expiry Date
            </DialogTitle>
            <DialogDescription>
              {editingExpiryBatch && (
                <>
                  Batch #{editingExpiryBatch.id} • Current expiry:{" "}
                  {editingExpiryBatch.expiry_date
                    ? format(new Date(editingExpiryBatch.expiry_date), "MMM d, yyyy")
                    : "No expiry set"}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded-lg p-3 text-sm text-orange-800 dark:text-orange-300">
              <strong>⚠️ High Risk Action:</strong> Changing expiry dates is a critical operation
              and will be recorded in the audit log.
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-expiry">New Expiry Date</Label>
              <Input
                id="new-expiry"
                type="date"
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to remove expiry date (no expiry)
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expiry-reason">Reason for Change *</Label>
              <Textarea
                id="expiry-reason"
                value={expiryReason}
                onChange={(e) => setExpiryReason(e.target.value)}
                placeholder="e.g., Supplier correction, data entry error, label mismatch..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExpiryDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExpirySubmit}
              disabled={isPending}
              className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-500"
            >
              {isPending ? "Saving..." : "Update Expiry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Remove Batch
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingBatch && (
                <>
                  This will permanently remove Batch #{deletingBatch.id} with{" "}
                  <strong>{deletingBatch.quantity} units</strong> from inventory. This action cannot
                  be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="delete-reason">Reason for Removal *</Label>
            <Textarea
              id="delete-reason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g., Spoiled, damaged, expired and discarded..."
              rows={2}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Removing..." : "Remove Batch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return to Supplier Dialog */}
      <AlertDialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <Undo2 className="h-5 w-5" />
              Return to Supplier
            </AlertDialogTitle>
            <AlertDialogDescription>
              {returningBatch && (
                <>
                  Return Batch #{returningBatch.id} with{" "}
                  <strong>{returningBatch.quantity} units</strong> to supplier.
                  {getExpiryStatus(returningBatch.expiry_date).isExpired && (
                    <span className="block mt-1 text-destructive font-medium">
                      ⚠️ This batch has expired ({returningBatch.expiry_date ? new Date(returningBatch.expiry_date).toLocaleDateString() : "N/A"})
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="return-supplier">Supplier Name</Label>
              <Input
                id="return-supplier"
                value={returnSupplier}
                onChange={(e) => setReturnSupplier(e.target.value)}
                placeholder="e.g., ABC Distributors, Direct Supplier..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="return-reason">Reason for Return *</Label>
              <Textarea
                id="return-reason"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="e.g., Expired stock, damaged on arrival, wrong item delivered..."
                rows={2}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReturnConfirm}
              disabled={isPending}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {isPending ? "Processing..." : "Return to Supplier"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
