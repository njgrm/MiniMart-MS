"use client";

import { useState, useEffect, useTransition } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RotateCcw,
  Home,
  ShoppingCart,
  FileSearch,
  X,
  ChevronRight,
  User,
  Calendar,
  Hash,
  Truck,
  FileText,
  DollarSign,
  MessageSquare,
  ImageIcon,
  ZoomIn,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { getStockMovements, type StockMovementRecord } from "@/actions/inventory";
import { cn, formatNumber } from "@/lib/utils";

type MovementType =
  | "RESTOCK"
  | "SALE"
  | "ADJUSTMENT"
  | "DAMAGE"
  | "RETURN"
  | "INTERNAL_USE"
  | "INITIAL_STOCK";

const movementTypeConfig: Record<
  MovementType,
  {
    label: string;
    icon: React.ElementType;
    colorClass: string;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  RESTOCK: {
    label: "Restock",
    icon: Package,
    colorClass: "text-green-600 dark:text-green-400",
    badgeVariant: "default",
  },
  INITIAL_STOCK: {
    label: "Initial",
    icon: Package,
    colorClass: "text-green-600 dark:text-green-400",
    badgeVariant: "default",
  },
  SALE: {
    label: "Sale",
    icon: ShoppingCart,
    colorClass: "text-blue-600 dark:text-blue-400",
    badgeVariant: "secondary",
  },
  ADJUSTMENT: {
    label: "Adjustment",
    icon: FileSearch,
    colorClass: "text-amber-600 dark:text-amber-400",
    badgeVariant: "outline",
  },
  DAMAGE: {
    label: "Damage",
    icon: AlertTriangle,
    colorClass: "text-destructive",
    badgeVariant: "destructive",
  },
  RETURN: {
    label: "Return",
    icon: RotateCcw,
    colorClass: "text-purple-600 dark:text-purple-400",
    badgeVariant: "outline",
  },
  INTERNAL_USE: {
    label: "Internal Use",
    icon: Home,
    colorClass: "text-muted-foreground",
    badgeVariant: "outline",
  },
};

interface StockHistoryViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    product_id: number;
    product_name: string;
    current_stock: number;
  } | null;
}

export function StockHistoryView({
  open,
  onOpenChange,
  product,
}: StockHistoryViewProps) {
  const [movements, setMovements] = useState<StockMovementRecord[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<StockMovementRecord | null>(null);
  const [imageZoom, setImageZoom] = useState(false);

  useEffect(() => {
    if (open && product) {
      setError(null);
      setSelectedMovement(null);
      startTransition(async () => {
        try {
          const result = await getStockMovements(product.product_id);
          setMovements(result);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load stock history");
        }
      });
    } else {
      setMovements([]);
      setSelectedMovement(null);
    }
  }, [open, product]);

  if (!product) return null;

  const isExpanded = selectedMovement !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "h-[90vh] flex flex-col p-0 overflow-hidden transition-all duration-300",
          isExpanded ? "max-w-[1400px]" : "max-w-[900px]",
          isExpanded && "[&>button]:hidden" // Hide default dialog close button when drawer is open
        )}
      >
        <div className="flex h-full min-h-[500px]">
          {/* Main table panel */}
          <motion.div
            className="flex flex-col h-full overflow-hidden border-r border-border"
            animate={{
              width: isExpanded ? "55%" : "100%",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <DialogHeader className="px-6 py-3 border-b flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Stock History
              </DialogTitle>
              <DialogDescription>
                Movement history for <strong>{product.product_name}</strong> | Current stock: <strong>{formatNumber(product.current_stock)}</strong> units.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto">
              {error ? (
                <div className="m-6 bg-destructive/10 text-destructive text-sm p-4 rounded-md">
                  {error}
                </div>
              ) : isPending ? (
                <div className="p-6 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : movements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    No stock movements recorded yet.
                  </p>
                  <p className="text-sm text-muted-foreground/70">
                    Stock changes will appear here once you start restocking or adjusting inventory.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px] sticky top-0 bg-background">Date and TIME</TableHead>
                      <TableHead className="w-[90px] sticky top-0 bg-background">Type</TableHead>
                      <TableHead className="w-[60px] text-right sticky top-0 bg-background">Before</TableHead>
                      <TableHead className="w-[70px] text-right sticky top-0 bg-background">Change</TableHead>
                      <TableHead className="w-[60px] text-right sticky top-0 bg-background">After</TableHead>
                      {!isExpanded && <TableHead className="sticky top-0 bg-background">Details</TableHead>}
                      <TableHead className="w-[40px] sticky top-0 bg-background"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((movement) => {
                      const config = movementTypeConfig[movement.movement_type as MovementType] || movementTypeConfig.ADJUSTMENT;
                      const Icon = config.icon;
                      const isPositive = movement.quantity_change > 0;
                      const isSelected = selectedMovement?.id === movement.id;

                      return (
                        <TableRow
                          key={movement.id}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isSelected
                              ? "bg-primary/10 border-l-2 border-l-primary"
                              : "hover:bg-muted/50"
                          )}
                          onClick={() => setSelectedMovement(isSelected ? null : movement)}
                        >
                          <TableCell className="font-mono text-xs py-3">
                            {format(new Date(movement.created_at), "MMM dd yyyy |")}{" "}

                            <span className="text-muted-foreground">
                              {format(new Date(movement.created_at), "hh:mm a")}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge
                              variant={config.badgeVariant}
                              className={cn("flex items-center gap-1 w-fit text-[10px]", {
                                "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400":
                                  movement.movement_type === "RESTOCK" || movement.movement_type === "INITIAL_STOCK",
                              })}
                            >
                              <Icon className="h-2.5 w-2.5" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground py-3">
                            {formatNumber(movement.previous_stock)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold py-3">
                            <span
                              className={cn(
                                "flex items-center justify-end gap-1",
                                isPositive
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-destructive"
                              )}
                            >
                              {isPositive ? "+" : ""}
                              {formatNumber(movement.quantity_change)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold py-3">
                            {formatNumber(movement.new_stock)}
                          </TableCell>
                          {!isExpanded && (
                            <TableCell className="py-3">
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {movement.reason || movement.supplier_name || "—"}
                              </p>
                            </TableCell>
                          )}
                          <TableCell className="py-3">
                            <ChevronRight
                              className={cn(
                                "h-4 w-4 text-muted-foreground transition-transform",
                                isSelected && "rotate-90 text-primary"
                              )}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Footer removed - using dialog X button instead */}
          </motion.div>

          {/* Detail drawer panel - slides in from right */}
          <AnimatePresence>
            {isExpanded && selectedMovement && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "45%", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="bg-muted/20 overflow-hidden flex flex-col"
              >
                <MovementDetailPanel
                  movement={selectedMovement}
                  onClose={() => setSelectedMovement(null)}
                  onImageZoom={() => setImageZoom(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Image Zoom Modal */}
        {imageZoom && selectedMovement?.receipt_image_url && (
          <Dialog open={imageZoom} onOpenChange={setImageZoom}>
            <DialogContent className="max-w-4xl p-2">
              <DialogTitle className="sr-only">Receipt Image Preview</DialogTitle>
              <img
                src={selectedMovement.receipt_image_url}
                alt="Receipt"
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Detail panel component for expanded movement view
 */
function MovementDetailPanel({
  movement,
  onClose,
  onImageZoom,
}: {
  movement: StockMovementRecord;
  onClose: () => void;
  onImageZoom: () => void;
}) {
  const config = movementTypeConfig[movement.movement_type as MovementType] || movementTypeConfig.ADJUSTMENT;
  const Icon = config.icon;
  const isPositive = movement.quantity_change > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3.25 border-b border-border bg-background">
        <div className="flex items-center justify-between">
          <Badge
            variant={config.badgeVariant}
            className={cn("flex items-center gap-1", {
              "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400":
                movement.movement_type === "RESTOCK" || movement.movement_type === "INITIAL_STOCK",
            })}
          >
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Stock change highlight */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Before</p>
            <p className="text-xl font-mono font-semibold">{formatNumber(movement.previous_stock)}</p>
          </div>
          <div className={cn(
            "flex items-center gap-1 px-3 py-1 rounded-full font-mono font-bold",
            isPositive
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? "+" : ""}{formatNumber(movement.quantity_change)}
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase">After</p>
            <p className="text-xl font-mono font-semibold text-primary">{formatNumber(movement.new_stock)}</p>
          </div>
        </div>
      </div>

      {/* Details - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Receipt Image */}
        {movement.receipt_image_url && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ImageIcon className="h-3 w-3" />
              Receipt Image
            </div>
            <div 
              className="relative rounded-lg border border-border overflow-hidden cursor-pointer group"
              onClick={onImageZoom}
            >
              <img
                src={movement.receipt_image_url}
                alt="Receipt"
                className="w-full h-40 object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ZoomIn className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
        )}

        {/* Date & Time */}
        <DetailRow
          icon={Calendar}
          label="Date & Time"
          value={format(new Date(movement.created_at), "MMMM dd, yyyy 'at' hh:mm a")}
        />

        {/* Performed By */}
        <DetailRow
          icon={User}
          label="Performed By"
          value={movement.user?.username || "System"}
        />

        <Separator />

        {/* Reason */}
        {movement.reason && (
          <DetailRow
            icon={MessageSquare}
            label="Reason / Notes"
            value={movement.reason}
            multiline
          />
        )}

        {/* Supplier */}
        {movement.supplier_name && (
          <DetailRow
            icon={Truck}
            label="Supplier"
            value={movement.supplier_name}
          />
        )}

        {/* Reference */}
        {movement.reference && (
          <DetailRow
            icon={FileText}
            label="Reference #"
            value={movement.reference}
            mono
          />
        )}

        {/* Cost Price */}
        {movement.cost_price && (
          <DetailRow
            icon={DollarSign}
            label="Cost Price"
            value={`₱${movement.cost_price.toFixed(2)} per unit`}
          />
        )}

        <Separator />
        
        {/* Movement ID */}
        <DetailRow
          icon={Hash}
          label="Movement ID"
          value={`#${movement.id}`}
          mono
          muted
        />
      </div>
    </div>
  );
}

/**
 * Helper component for detail rows
 */
function DetailRow({
  icon: IconComponent,
  label,
  value,
  mono,
  muted,
  multiline,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <IconComponent className="h-3 w-3" />
        {label}
      </div>
      <p
        className={cn(
          "text-sm",
          mono && "font-mono",
          muted && "text-muted-foreground",
          multiline && "whitespace-pre-wrap"
        )}
      >
        {value}
      </p>
    </div>
  );
}
