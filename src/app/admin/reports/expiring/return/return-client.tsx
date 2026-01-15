"use client";

import { useState, useTransition, useMemo, useEffect, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { 
  Undo2, 
  Truck, 
  X, 
  Search,
  Plus,
  Package,
  AlertTriangle,
  XCircle,
  Timer,
  Calendar,
  Building2,
  ChevronLeft,
  AlertCircle,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { batchReturnProducts, type BatchReturnItem } from "@/actions/inventory";
import { type ExpiringItem } from "@/actions/reports";
import { createSupplier } from "@/actions/supplier";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BatchReturnClientProps {
  expiringItems: ExpiringItem[];
  suppliers: { id: number; name: string }[];
  preSelectedBatchId: number | null;
}

// Urgency configuration matching expiring-client
const urgencyConfig: Record<
  ExpiringItem["urgency"],
  { label: string; color: string; icon: React.ElementType; badgeClass: string }
> = {
  expired: {
    label: "Expired",
    color: "text-[#AC0F16]",
    icon: XCircle,
    badgeClass: "bg-red-50 text-[#AC0F16] border-red-200",
  },
  critical: {
    label: "Critical",
    color: "text-[#AC0F16]",
    icon: AlertCircle,
    badgeClass: "bg-red-50 text-[#AC0F16] border-red-200",
  },
  warning: {
    label: "Warning",
    color: "text-[#F1782F]",
    icon: AlertTriangle,
    badgeClass: "bg-[#fef3eb] text-[#F1782F] border-[#F1782F]/30",
  },
  caution: {
    label: "Caution",
    color: "text-[#2EAFC5]",
    icon: Timer,
    badgeClass: "bg-[#e6f7fa] text-[#2EAFC5] border-[#2EAFC5]/30",
  },
  advise_return: {
    label: "Advise Return",
    color: "text-[#7c3aed]",
    icon: Calendar,
    badgeClass: "bg-violet-50 text-[#7c3aed] border-violet-200",
  },
};

// Helper: Format peso with normal weight sign
function formatPeso(amount: number) {
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Memoized table row component for performance
const BatchRow = memo(function BatchRow({
  item,
  isSelected,
  onToggle,
}: {
  item: ExpiringItem;
  isSelected: boolean;
  onToggle: (batchId: number) => void;
}) {
  const config = urgencyConfig[item.urgency];

  return (
    <TableRow
      className={cn(
        "cursor-pointer select-none",
        isSelected && "bg-primary/5"
      )}
      onClick={() => onToggle(item.batch_id)}
    >
      <TableCell className="w-10 py-2">
        <Checkbox checked={isSelected} className="pointer-events-none" />
      </TableCell>
      <TableCell className="py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate max-w-[180px] lg:max-w-[220px]">
            {item.product_name}
          </span>
          <Badge className={cn("text-[10px] shrink-0 hidden sm:inline-flex", config.badgeClass)}>
            {config.label}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="py-2 text-xs text-muted-foreground hidden md:table-cell">
        {item.supplier_name || "—"}
      </TableCell>
      <TableCell className="py-2 text-xs font-mono hidden lg:table-cell">
        {format(new Date(item.expiry_date), "MMM d, yyyy")}
      </TableCell>
      <TableCell className="py-2 text-right font-mono text-sm w-16">
        {item.current_quantity}
      </TableCell>
      <TableCell className="py-2 text-right font-mono text-sm text-[#AC0F16] w-24">
        {formatPeso(item.value_at_risk)}
      </TableCell>
    </TableRow>
  );
});

export function BatchReturnClient({
  expiringItems,
  suppliers: initialSuppliers,
  preSelectedBatchId,
}: BatchReturnClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Confirmation dialog
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Supplier dropdown state
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [supplierId, setSupplierId] = useState<string>("");
  const [newSupplierName, setNewSupplierName] = useState("");

  // Return info (shared across all items)
  const [reference, setReference] = useState("");
  
  // Get preselected batch info for initial reason
  const preSelectedBatch = preSelectedBatchId != null 
    ? expiringItems.find(i => i.batch_id === preSelectedBatchId) 
    : null;
  
  const [reason, setReason] = useState(() => {
    if (preSelectedBatch) {
      return preSelectedBatch.urgency === "expired"
        ? "Expired product - returning to supplier"
        : `Near expiry (${preSelectedBatch.days_until_expiry} days) - returning to supplier`;
    }
    return "";
  });

  // Selected items for return - initialize with preselected batch
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<number>>(() => 
    preSelectedBatchId != null ? new Set([preSelectedBatchId]) : new Set()
  );

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");

  // Get unique suppliers from items for filter dropdown
  const itemSuppliers = useMemo(() => {
    const names = new Set<string>();
    expiringItems.forEach(i => {
      if (i.supplier_name) names.add(i.supplier_name);
    });
    return Array.from(names).sort();
  }, [expiringItems]);

  // Auto-match supplier if we have a pre-selected batch with supplier name
  useEffect(() => {
    if (preSelectedBatch?.supplier_name) {
      const match = initialSuppliers.find(
        (s) => s.name.toLowerCase() === preSelectedBatch.supplier_name!.toLowerCase()
      );
      if (match) {
        setSupplierId(String(match.id));
      }
    }
  }, [preSelectedBatch, initialSuppliers]);

  // Filter available items (expired and critical priority)
  const availableItems = useMemo(() => {
    // Sort by urgency (expired first, then critical, warning, caution, advise_return)
    const urgencyOrder: Record<string, number> = { expired: 0, critical: 1, warning: 2, caution: 3, advise_return: 4 };
    return [...expiringItems].sort((a, b) => (urgencyOrder[a.urgency] ?? 5) - (urgencyOrder[b.urgency] ?? 5));
  }, [expiringItems]);

  const filteredItems = useMemo(() => {
    let items = availableItems;
    
    // Apply urgency filter
    if (urgencyFilter !== "all") {
      items = items.filter(i => i.urgency === urgencyFilter);
    }
    
    // Apply supplier filter
    if (supplierFilter !== "all") {
      items = items.filter(i => i.supplier_name === supplierFilter);
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.product_name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.barcode?.toLowerCase().includes(query) ||
        item.batch_number?.toLowerCase().includes(query) ||
        item.supplier_name?.toLowerCase().includes(query)
      );
    }
    
    return items;
  }, [availableItems, searchQuery, supplierFilter, urgencyFilter]);

  // Get selected items
  const selectedItems = useMemo(() => 
    availableItems.filter(item => selectedBatchIds.has(item.batch_id)),
    [availableItems, selectedBatchIds]
  );

  // Calculate totals
  const totalUnits = selectedItems.reduce((sum, i) => sum + i.current_quantity, 0);
  const totalValue = selectedItems.reduce((sum, i) => sum + i.value_at_risk, 0);

  // Toggle item selection - memoized for performance
  const toggleItem = useCallback((batchId: number) => {
    setSelectedBatchIds(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  }, []);

  // Select all expired items - memoized
  const selectAllExpired = useCallback(() => {
    const expiredIds = availableItems
      .filter(i => i.urgency === "expired")
      .map(i => i.batch_id);
    setSelectedBatchIds(new Set(expiredIds));
  }, [availableItems]);

  // Select all visible (filtered) items - memoized
  const selectAllVisible = useCallback(() => {
    const visibleIds = filteredItems.map(i => i.batch_id);
    setSelectedBatchIds(new Set(visibleIds));
  }, [filteredItems]);

  // Clear selection - memoized
  const clearSelection = useCallback(() => {
    setSelectedBatchIds(new Set());
  }, []);

  // Validate and show confirmation
  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedBatchIds.size === 0) {
      setError("Please select at least one batch to return");
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      setError("Please provide a reason (min 3 characters)");
      return;
    }

    // Show confirmation dialog
    setShowConfirmation(true);
  };

  // Actual submission after confirmation
  const handleConfirmedSubmit = async () => {
    setShowConfirmation(false);

    startTransition(async () => {
      // Resolve supplier: create new if needed, or get from selection
      let finalSupplierName: string | undefined;
      let finalSupplierId: number | undefined;

      if (supplierId === "__NEW__" && newSupplierName.trim()) {
        // Create new supplier
        const createResult = await createSupplier({ name: newSupplierName.trim() });
        if (createResult.success && createResult.data) {
          finalSupplierId = createResult.data.id;
          finalSupplierName = newSupplierName.trim();
          // Add to local list
          setSuppliers((prev) => [...prev, { id: createResult.data!.id, name: newSupplierName.trim() }]);
        } else {
          setError(createResult.error || "Failed to create supplier");
          return;
        }
      } else if (supplierId && supplierId !== "__NEW__") {
        finalSupplierId = parseInt(supplierId);
        const selected = suppliers.find((s) => String(s.id) === supplierId);
        if (selected) finalSupplierName = selected.name;
      }

      const items: BatchReturnItem[] = selectedItems.map(item => ({
        batchId: item.batch_id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.current_quantity,
        expiryDate: item.expiry_date,
        supplierName: item.supplier_name,
        costPrice: item.cost_price,
      }));

      const result = await batchReturnProducts({
        items,
        reason: reason.trim(),
        supplierName: finalSupplierName || undefined,
        supplierId: finalSupplierId,
        reference: reference.trim() || undefined,
      });

      if (result.success) {
        const data = result.data!;
        toast.success(`Batch return completed`, {
          description: `Returned ${data.totalUnitsReturned} units (${data.successCount} batches) worth ₱${data.totalValueReturned.toLocaleString()}`,
        });
        // Navigate back to expiring report
        router.push("/admin/reports/expiring");
        router.refresh();
      } else {
        setError(result.error || "Failed to process batch return");
      }
    });
  };

  return (
    <div className="h-full flex flex-col bg-[#FAFAF9]">
      {/* Header */}
      <div className=" border-border border-b bg-card px-4 py-2 h-14 flex items-center justify-between shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="h-8 px-2 gap-1.5 text-xs">
            <Link href="/admin/reports/expiring">
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </Button>
          <div className="h-5 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <Undo2 className="h-4 w-4 text-[#AC0F16]" />
            <span className="font-semibold text-sm sm:text-base">Batch Return</span>
          </div>
        </div>
        {selectedBatchIds.size > 0 && (
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Badge variant="secondary" className="font-mono text-xs">
              {selectedBatchIds.size} batches
            </Badge>
            <span className="text-muted-foreground hidden sm:inline">
              {totalUnits.toLocaleString()} units
            </span>
            <span className="font-medium text-[#AC0F16] font-mono">
              {formatPeso(totalValue)}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Main Content - Responsive Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 bg-card overflow-hidden">
        {/* Left Panel: Return Details Form */}
        <Card className="lg:w-[280px] xl:w-[320px] shrink-0 flex flex-col">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              Return Details
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col px-4 pb-4 pt-0">
            <form id="batch-return-form" onSubmit={handlePreSubmit} className="flex flex-col gap-3 flex-1">
              {/* Supplier */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Supplier
                </Label>
                <Select value={supplierId} onValueChange={(v) => { setSupplierId(v); if (v !== "__NEW__") setNewSupplierName(""); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)} className="text-xs">{s.name}</SelectItem>
                    ))}
                    <SelectItem value="__NEW__" className="text-xs text-primary">
                      <span className="flex items-center gap-1"><Plus className="h-3 w-3" />Add New</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {supplierId === "__NEW__" && (
                  <Input
                    placeholder="New supplier name..."
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="h-8 text-xs"
                    autoFocus
                  />
                )}
              </div>

              {/* Reference */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Reference / RMA #</Label>
                <Input
                  placeholder="e.g., RMA-2026-001"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Reason + Quick Reasons together */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-destructive">Reason for Return *</Label>
                <Input
                  placeholder="e.g., Expired products"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {["Expired", "Near expiry", "Damaged", "Recalled", "Wrong item"].map((r) => (
                    <Button
                      key={r}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setReason(r + " - returning to supplier")}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Spacer to push buttons to bottom */}
              <div className="flex-1 min-h-2" />

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t">
                <Button
                  type="submit"
                  disabled={isPending || selectedBatchIds.size === 0}
                  className="w-full h-9 bg-[#AC0F16] hover:bg-[#8a0c12] text-white text-sm"
                >
                  {isPending ? (
                    <><Package className="h-4 w-4 mr-1.5 animate-pulse" />Processing...</>
                  ) : (
                    <><Undo2 className="h-4 w-4 mr-1.5" />Return {selectedBatchIds.size > 0 ? `${selectedBatchIds.size} Batches` : ""}</>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-8 text-xs"
                  onClick={() => router.push("/admin/reports/expiring")}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Right Panel: Batch Selection Table */}
        <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
          <CardHeader className="pb-3 pt-4 px-4 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-sm">Select Batches ({filteredItems.length})</CardTitle>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={selectAllExpired} className="h-7 text-[10px] px-2">
                  <XCircle className="h-3 w-3 mr-1 text-[#AC0F16]" />Expired
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={selectAllVisible} className="h-7 text-[10px] px-2">
                  All
                </Button>
                {selectedBatchIds.size > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearSelection} className="h-7 text-[10px] px-2 text-muted-foreground">
                    <X className="h-3 w-3 mr-0.5" />Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Search + Filters */}
            <div className="flex gap-2 mt-2 flex-wrap">
              <div className="relative flex-1 min-w-[120px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-10 text-xs"
                />
              </div>
              <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Types</SelectItem>
                  <SelectItem value="expired" className="text-xs text-[#AC0F16]">Expired</SelectItem>
                  <SelectItem value="critical" className="text-xs text-[#AC0F16]">Critical</SelectItem>
                  <SelectItem value="warning" className="text-xs text-[#F1782F]">Warning</SelectItem>
                  <SelectItem value="caution" className="text-xs text-[#2EAFC5]">Caution</SelectItem>
                  <SelectItem value="advise_return" className="text-xs text-violet-600">Advise</SelectItem>
                </SelectContent>
              </Select>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Suppliers</SelectItem>
                  {itemSuppliers.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-auto p-0">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-10 py-2"></TableHead>
                  <TableHead className="py-2 text-xs">Product</TableHead>
                  <TableHead className="py-2 text-xs hidden md:table-cell">Supplier</TableHead>
                  <TableHead className="py-2 text-xs hidden lg:table-cell">Expiry</TableHead>
                  <TableHead className="py-2 text-xs text-right w-16">Qty</TableHead>
                  <TableHead className="py-2 text-xs text-right w-24">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No batches found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <BatchRow
                      key={item.batch_id}
                      item={item}
                      isSelected={selectedBatchIds.has(item.batch_id)}
                      onToggle={toggleItem}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#F1782F]" />
              Confirm Batch Return
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to return <strong>{selectedBatchIds.size} batches</strong> ({totalUnits.toLocaleString()} units) 
                worth <strong className="text-[#AC0F16]">₱{totalValue.toLocaleString()}</strong> to the supplier.
              </p>
              <p className="text-muted-foreground">
                This action will remove these batches from inventory and cannot be undone.
                A stock movement record will be created for each batch.
              </p>
              {reason && (
                <div className="bg-muted/50 p-3 rounded-lg text-sm">
                  <strong>Reason:</strong> {reason}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedSubmit}
              disabled={isPending}
              className="bg-[#AC0F16] hover:bg-[#8a0c12]"
            >
              {isPending ? "Processing..." : "Confirm Return"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
