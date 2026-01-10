"use client";

import { useState, useMemo, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInDays, isAfter, isBefore, startOfDay } from "date-fns";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
  Archive,
  Search,
  Package,
  X,
  Upload,
  Plus,
  AlertTriangle,
  Boxes,
  Coins,
  Printer,
  PackagePlus,
  ClipboardEdit,
  History,
  Wand2,
  TrendingUp,
  TrendingDown,
  CalendarClock,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTablePagination } from "@/components/data-table-pagination";
import { bulkArchiveProducts } from "@/actions/archive";
import { cn } from "@/lib/utils";
import type { ProductData } from "./inventory-client";

interface ProductsTableProps {
  products: ProductData[];
  onEdit: (product: ProductData) => void;
  onDelete: (product: ProductData) => void;
  onBulkDelete?: (productIds: number[]) => void;
  onImportClick?: () => void;
  onAddClick?: () => void;
  onPrintBarcodes?: (products: ProductData[]) => void;
  onRestock?: (product: ProductData) => void;
  onAdjust?: (product: ProductData) => void;
  onViewHistory?: (product: ProductData) => void;
  // View toggle props
  activeTab?: "active" | "archived";
  onTabChange?: (tab: "active" | "archived") => void;
  activeCount?: number;
  archivedCount?: number;
}

export function ProductsTable({ 
  products, 
  onEdit, 
  onDelete, 
  onBulkDelete,
  onImportClick,
  onAddClick,
  onPrintBarcodes,
  onRestock,
  onAdjust,
  onViewHistory,
  activeTab = "active",
  onTabChange,
  activeCount = 0,
  archivedCount = 0,
}: ProductsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Calculate KPI stats
  const totalProducts = products.length;
  const outOfStockItems = products.filter((p) => p.current_stock === 0).length;
  const lowStockItems = products.filter((p) => p.status === "LOW_STOCK" && p.current_stock > 0).length;
  const inventoryValue = products.reduce(
    (sum, p) => sum + p.retail_price * p.current_stock,
    0
  );

  // Track active filters
  const categoryFilter = columnFilters.find((f) => f.id === "category")?.value as string | undefined;
  const statusFilter = columnFilters.find((f) => f.id === "status")?.value as string | undefined;
  const hasActiveFilters = !!globalFilter || !!categoryFilter || !!statusFilter;

  const resetFilters = () => {
    setGlobalFilter("");
    setColumnFilters([]);
  };

  const columns: ColumnDef<ProductData>[] = useMemo(
    () => [
      // Selection Column
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "image_url",
        header: "Image",
        cell: ({ row }) => {
          const imageUrl = row.getValue("image_url") as string | null;
          return (
            <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={row.original.product_name}
                  width={40}
                  height={40}
                  className="object-cover w-full h-full"
                  unoptimized
                />
              ) : (
                <Package className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "product_name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 h-8 uppercase text-[11px] font-semibold tracking-wider"
          >
            Name
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-sm font-medium text-foreground truncate max-w-[200px]">
            {row.getValue("product_name")}
          </div>
        ),
      },
      {
        accessorKey: "barcode",
        header: "Barcode",
        cell: ({ row }) => {
          const barcode = row.getValue("barcode") as string | null;
          return barcode ? (
            <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded font-mono">
              {barcode}
            </code>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          );
        },
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground capitalize">
            {(row.getValue("category") as string).toLowerCase().replace("_", " ")}
          </span>
        ),
        filterFn: (row, id, value) => {
          return value === "all" || row.getValue(id) === value;
        },
      },
      {
        accessorKey: "retail_price",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 h-8 uppercase text-[11px] font-semibold tracking-wider"
          >
            Retail
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const amount = parseFloat(row.getValue("retail_price"));
          if (!amount || amount === 0) {
            return <span className="text-muted-foreground text-sm">N/A</span>;
          }
          return (
            <div className="text-sm font-normal tracking-wider tabular-nums">
              ₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          );
        },
      },
      {
        accessorKey: "wholesale_price",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 h-8 uppercase text-[11px] font-semibold tracking-wider"
          >
            Wholesale
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const amount = parseFloat(row.getValue("wholesale_price"));
          if (!amount || amount === 0) {
            return <span className="text-muted-foreground text-sm">N/A</span>;
          }
          return (
            <div className="text-sm font-normal tracking-wider tabular-nums">
              ₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          );
        },
      },
      {
        accessorKey: "current_stock",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 h-8 uppercase text-[11px] font-semibold tracking-wider"
          >
            Stock / ROP
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const stock = row.getValue("current_stock") as number;
          const staticReorderLevel = row.original.reorder_level;
          const autoReorder = row.original.auto_reorder;
          const leadTimeDays = row.original.lead_time_days;
          
          // Client-side Dynamic ROP Estimation
          // When auto_reorder is enabled:
          //   Estimated ROP = (staticReorderLevel / 7) * leadTimeDays * 1.3 (30% safety buffer)
          // This is an approximation - the full calculation requires sales velocity data
          const estimatedDynamicROP = autoReorder
            ? Math.ceil((staticReorderLevel / 7) * leadTimeDays * 1.3)
            : staticReorderLevel;
          
          // Determine which ROP to use for display
          const displayROP = autoReorder ? estimatedDynamicROP : staticReorderLevel;
          const isDynamic = autoReorder && estimatedDynamicROP !== staticReorderLevel;
          
          return (
            <div className="flex flex-col gap-0.5">
              <div className={`text-sm font-medium tabular-nums ${stock === 0 ? "text-destructive" : stock <= displayROP ? "text-secondary" : ""}`}>
                {stock.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {isDynamic ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 cursor-help">
                        <span className="text-amber-500 font-medium">⚡{displayROP}</span>
                        <span className="text-muted-foreground/60 line-through">{staticReorderLevel}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-[220px] p-3">
                      <p className="font-medium text-foreground mb-1">Dynamic Reorder Point</p>
                      <div className="space-y-1 text-muted-foreground">
                        <p>Based on {leadTimeDays}-day lead time</p>
                        <p>Original: {staticReorderLevel} → Calculated: {displayROP}</p>
                        <p className="text-amber-600 dark:text-amber-400 font-medium mt-1">
                          ROP adjusts automatically based on sales velocity
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span>ROP: {displayROP.toLocaleString()}</span>
                )}
                {autoReorder && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] border-amber-500/50 text-amber-600 dark:text-amber-400">
                    Auto
                  </Badge>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const stock = row.original.current_stock;
          const reorderLevel = row.original.reorder_level;
          
          // Strict Badge Logic:
          // RED ("Out of Stock"): Stock === 0
          // ORANGE ("Low Stock"): Stock > 0 AND Stock <= ReorderLevel
          // GREEN ("In Stock"): Stock > ReorderLevel
          
          if (stock === 0) {
            return (
              <Badge variant="destructive" className="text-xs">
                Out of Stock
              </Badge>
            );
          }
          
          if (stock <= reorderLevel) {
            return (
              <Badge variant="secondary" className="text-xs">
                Low Stock
              </Badge>
            );
          }
          
          return (
            <Badge variant="accent" className="text-xs">
              In Stock
            </Badge>
          );
        },
        filterFn: (row, id, value) => {
          if (value === "all") return true;
          const stock = row.original.current_stock;
          // Handle OUT_OF_STOCK filter specially
          if (value === "OUT_OF_STOCK") {
            return stock === 0;
          }
          if (value === "LOW_STOCK") {
            return stock > 0 && row.getValue(id) === "LOW_STOCK";
          }
          return row.getValue(id) === value && stock > 0;
        },
        // Custom sort to prioritize: OUT_OF_STOCK > LOW_STOCK > IN_STOCK
        sortingFn: (rowA, rowB) => {
          const stockA = rowA.original.current_stock;
          const stockB = rowB.original.current_stock;
          const statusA = rowA.getValue("status") as string;
          const statusB = rowB.getValue("status") as string;
          
          // Priority: OUT_OF_STOCK (0) > LOW_STOCK > IN_STOCK
          const getPriority = (stock: number, status: string) => {
            if (stock === 0) return 0; // Highest priority
            if (status === "LOW_STOCK") return 1;
            return 2; // IN_STOCK
          };
          
          return getPriority(stockA, statusA) - getPriority(stockB, statusB);
        },
      },
      // Expiry Date Column - 45-Day Supplier Return Policy
      {
        accessorKey: "nearest_expiry_date",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 h-8 uppercase text-[11px] font-semibold tracking-wider"
          >
            <CalendarClock className="mr-1.5 h-3 w-3" />
            Expiry
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const expiryDate = row.original.nearest_expiry_date;
          
          if (!expiryDate) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }

          const expiry = new Date(expiryDate);
          const today = startOfDay(new Date());
          const daysUntilExpiry = differenceInDays(expiry, today);

          // SUPPLIER RETURN POLICY: 45-Day Return Window
          // <= 0 days: EXPIRED (Red) - Cannot return
          // 1-45 days: RETURN TO SUPPLIER (Orange) - Within return window
          // > 45 days: GOOD (Normal display) - No action needed

          // Already expired - Cannot return to supplier
          if (daysUntilExpiry <= 0) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="destructive" className="text-xs font-mono cursor-help">
                    Expired
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[200px]">
                  <p className="text-xs font-medium text-destructive">Cannot return to supplier</p>
                  <p className="text-xs text-muted-foreground">Expired on {format(expiry, "MMM d, yyyy")}</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          // Within 45-day return window - ACTION REQUIRED
          if (daysUntilExpiry <= 45) {
            const urgencyLevel = daysUntilExpiry <= 7 ? "critical" : daysUntilExpiry <= 14 ? "urgent" : "warning";
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs font-mono cursor-help gap-1 ${
                      urgencyLevel === "critical" 
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                        : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                    }`}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {daysUntilExpiry <= 7 
                      ? "Pull Out" 
                      : "Return"
                    } ({daysUntilExpiry}d)
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[220px]">
                  <p className="text-xs font-medium text-secondary">Return to Supplier</p>
                  <p className="text-xs text-muted-foreground">Expires {format(expiry, "MMM d, yyyy")}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {daysUntilExpiry} days left in 45-day return window
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          }

          // > 45 days - Good status, show normal date
          return (
            <span className="text-xs text-muted-foreground font-mono">
              {format(expiry, "MMM d, yyyy")}
            </span>
          );
        },
        sortingFn: (rowA, rowB) => {
          const dateA = rowA.original.nearest_expiry_date ? new Date(rowA.original.nearest_expiry_date).getTime() : Infinity;
          const dateB = rowB.original.nearest_expiry_date ? new Date(rowB.original.nearest_expiry_date).getTime() : Infinity;
          return dateA - dateB;
        },
      },
      // Smart Recommendation Column (AI-Powered)
      {
        id: "recommendation",
        header: () => (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase">
            <Wand2 className="h-3 w-3 text-[#AC0F16]" />
            Smart Tip
          </div>
        ),
        cell: ({ row }) => {
          const product = row.original;
          const stock = product.current_stock;
          const reorderLevel = product.reorder_level;
          
          // Calculate a simple recommendation based on stock levels
          // In production, this would fetch from the forecasting engine
          const daysOfStock = stock / Math.max(1, reorderLevel * 0.5); // Rough estimate
          const isLow = stock <= reorderLevel;
          const isCritical = stock <= reorderLevel * 0.5 || stock === 0;
          
          // Calculate recommended restock quantity
          const recommendedQty = isCritical 
            ? Math.ceil(reorderLevel * 2) 
            : isLow 
            ? Math.ceil(reorderLevel * 1.5 - stock) 
            : 0;
          
          // FIXED: Hide badge for healthy items - show subtle checkmark only
          if (recommendedQty <= 0) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center cursor-help">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                </TooltipTrigger>
                <TooltipContent 
                  side="left" 
                  className="max-w-[200px] p-3"
                >
                  <p className="text-xs">Stock levels are healthy. No restock needed at this time.</p>
                </TooltipContent>
              </Tooltip>
            );
          }
          
          // Determine the reason for recommendation
          const getReason = () => {
            if (isCritical) {
              return "Stock critically low. Immediate restock needed to avoid stockouts.";
            }
            if (isLow) {
              return `Stock below reorder level (${reorderLevel}). Consider restocking soon.`;
            }
            return "Based on current velocity trends.";
          };
          
          const getTrend = () => {
            // Simulated trend - in production, fetch from forecasting
            const rand = product.product_id % 3;
            if (rand === 0) return { icon: TrendingUp, text: "Velocity up 15%", color: "text-green-600" };
            if (rand === 1) return { icon: TrendingDown, text: "Steady demand", color: "text-[#6c5e5d]" };
            return { icon: TrendingUp, text: "Seasonal boost", color: "text-[#F1782F]" };
          };
          
          const trend = getTrend();
          const TrendIcon = trend.icon;
          
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  className={`cursor-help gap-1.5 ${
                    isCritical 
                      ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50" 
                      : "bg-[#AC0F16]/10 text-[#AC0F16] hover:bg-[#AC0F16]/20 dark:bg-[#AC0F16]/20 dark:text-red-400"
                  }`}
                >
                  <Wand2 className="h-3 w-3" />
                  +{recommendedQty}
                </Badge>
              </TooltipTrigger>
              <TooltipContent 
                side="left" 
                className="max-w-[250px] p-3 bg-popover text-popover-foreground border shadow-md"
              >
                <div className="space-y-2">
                  <p className="font-medium text-sm">Restock Recommendation</p>
                  <p className="text-xs text-muted-foreground">{getReason()}</p>
                  <div className="flex items-center gap-1.5 pt-1 border-t">
                    <TrendIcon className={`h-3 w-3 ${trend.color}`} />
                    <span className={`text-xs ${trend.color}`}>{trend.text}</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const product = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Stock Management Actions */}
                <DropdownMenuItem onClick={() => onRestock?.(product)}>
                  <PackagePlus className="mr-2 h-4 w-4 text-green-600" />
                  Restock
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAdjust?.(product)}>
                  <ClipboardEdit className="mr-2 h-4 w-4 text-amber-600" />
                  Adjust Stock
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onViewHistory?.(product)}>
                  <History className="mr-2 h-4 w-4 text-blue-600" />
                  View History
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/admin/inventory/${product.product_id}/batches`}>
                    <Layers className="mr-2 h-4 w-4 text-purple-600" />
                    View Batches
                  </Link>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                {/* Edit/Delete Actions */}
                <DropdownMenuItem onClick={() => onEdit(product)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(product)}
                  variant="destructive"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [onEdit, onDelete, onRestock, onAdjust, onViewHistory]
  );

  // Custom global filter that includes barcode and prices
  const globalFilterFn = (
    row: { original: ProductData },
    _columnId: string,
    filterValue: string
  ): boolean => {
    if (!filterValue) return true;
    const search = filterValue.toLowerCase();
    const product = row.original;
    return (
      product.product_name.toLowerCase().includes(search) ||
      (product.barcode?.toLowerCase().includes(search) ?? false) ||
      product.category.toLowerCase().includes(search) ||
      product.retail_price.toString().includes(search) ||
      product.wholesale_price.toString().includes(search)
    );
  };

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getRowId: (row) => row.product_id.toString(),
    globalFilterFn,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const selectedCount = Object.keys(rowSelection).length;
  const selectedProductIds = Object.keys(rowSelection).map((id) => parseInt(id));

  const handleBulkArchive = () => {
    startTransition(async () => {
      const result = await bulkArchiveProducts(selectedProductIds);
      
      if (result.success) {
        const data = result.data as { archivedCount: number };
        toast.success(`Successfully archived ${data.archivedCount} product${data.archivedCount !== 1 ? "s" : ""}`);
        setRowSelection({});
        onBulkDelete?.(selectedProductIds);
      } else {
        toast.error(result.error || "Failed to archive products");
      }
      
      setShowDeleteDialog(false);
    });
  };

  return (
    <TooltipProvider>
    <div className="h-full flex flex-col gap-3">
      {/* Selection Toolbar - Only visible when items are selected */}
      {selectedCount > 0 && (
        <div className="flex items-center rounded-lg border border-border bg-muted dark:bg-muted px-3 h-10 shrink-0">
          <span className="text-sm text-muted-foreground">
            {selectedCount} product{selectedCount !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => setRowSelection({})}
            >
              Clear
            </Button>
            {onPrintBarcodes && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => {
                  const selectedProducts = products.filter((p) =>
                    selectedProductIds.includes(p.product_id)
                  );
                  onPrintBarcodes(selectedProducts);
                }}
              >
                <Printer className="h-3.5 w-3.5" />
                Print Barcodes
              </Button>
            )}
            <Button
              variant="warning"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Archive className="h-3.5 w-3.5" />
              Archive ({selectedCount})
            </Button>
          </div>
        </div>
      )}

      {/* Table Toolbar - Single Row, No Wrap */}
      <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
        {/* View Toggle - Active/Archived with Primary Colors */}
        {onTabChange && (
          <div className="relative inline-flex items-center rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onTabChange("active")}
              className={cn(
                "relative inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors z-10",
                activeTab === "active"
                  ? "text-white"
                  : "text-primary/70 hover:text-primary dark:text-primary/60 dark:hover:text-primary"
              )}
            >
              <Package className="h-3.5 w-3.5 relative z-10" />
              <span className="relative z-10">Active</span>
              <span className={cn(
                "relative z-10 ml-0.5 px-1.5 py-0.5 text-xs font-semibold rounded-full transition-colors",
                activeTab === "active" 
                  ? "bg-white/20 text-white" 
                  : "bg-primary/15 text-primary dark:bg-primary/25"
              )}>
                {activeCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange("archived")}
              className={cn(
                "relative inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors z-10",
                activeTab === "archived"
                  ? "text-white"
                  : "text-primary/70 hover:text-primary dark:text-primary/60 dark:hover:text-primary"
              )}
            >
              <Archive className="h-3.5 w-3.5 relative z-10" />
              <span className="relative z-10">Archived</span>
              {archivedCount > 0 && (
                <span className={cn(
                  "relative z-10 ml-0.5 px-1.5 py-0.5 text-xs font-semibold rounded-full transition-colors",
                  activeTab === "archived" 
                    ? "bg-white/20 text-white" 
                    : "bg-primary/15 text-primary dark:bg-primary/25"
                )}>
                  {archivedCount}
                </span>
              )}
            </button>
            {/* Animated Background Pill */}
            <motion.div
              className="absolute top-0.5 bottom-0.5 bg-primary rounded-md shadow-sm"
              initial={false}
              animate={{
                left: activeTab === "active" ? "2px" : "50%",
                right: activeTab === "archived" ? "2px" : "50%",
              }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            />
          </div>
        )}

        {/* Separator after toggle */}
        {onTabChange && <div className="h-8 w-px bg-border shrink-0" />}

        {/* Search - Flexible width */}
        <div className="relative flex-1 min-w-[140px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or barcode..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 h-10 w-full"
          />
        </div>

        {/* Category Filter */}
        <Select
          value={categoryFilter ?? "all"}
          onValueChange={(value) =>
            table.getColumn("category")?.setFilterValue(value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="h-10 w-[120px] lg:w-[140px] shrink-0">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="SOFTDRINKS_CASE">Soft Drinks Case</SelectItem>
            <SelectItem value="SODA">Soft Drinks</SelectItem>
            <SelectItem value="SNACK">Snack</SelectItem>
            <SelectItem value="CANNED_GOODS">Canned Goods</SelectItem>
            <SelectItem value="BEVERAGES">Beverages</SelectItem>
            <SelectItem value="DAIRY">Dairy</SelectItem>
            <SelectItem value="BREAD">Bread</SelectItem>
            <SelectItem value="INSTANT_NOODLES">Instant Noodles</SelectItem>
            <SelectItem value="CONDIMENTS">Condiments</SelectItem>
            <SelectItem value="PERSONAL_CARE">Personal Care</SelectItem>
            <SelectItem value="HOUSEHOLD">Household</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={statusFilter ?? "all"}
          onValueChange={(value) =>
            table.getColumn("status")?.setFilterValue(value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="h-10 w-[110px] lg:w-[140px] shrink-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
            <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
            <SelectItem value="IN_STOCK">In Stock</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset Filters - Animated */}
        <AnimatePresence mode="wait">
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={resetFilters}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Reset filters</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Separator */}
        <div className="h-8 w-px bg-border mx-1 shrink-0" />

        {/* KPI Cards - Auto-shrink on smaller screens */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 h-10 px-2 lg:px-3 rounded-md bg-card dark:bg-muted/30 border border-border dark:border-border/40 shadow-warm-sm dark:shadow-none shrink-0">
                <Boxes className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{totalProducts}</span>
                <span className="text-xs text-muted-foreground hidden lg:inline">Products</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="lg:hidden">
              <p>{totalProducts} Products</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Out of Stock Button - Highest Priority */}
        {outOfStockItems > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    table.getColumn("status")?.setFilterValue("OUT_OF_STOCK");
                  }}
                  className="flex items-center gap-1.5 h-10 px-2 lg:px-3 rounded-md bg-destructive dark:bg-destructive/20 border border-destructive dark:border-destructive/40 text-white dark:text-destructive shadow-warm-sm dark:shadow-none hover:bg-destructive/90 dark:hover:bg-destructive/30 transition-colors cursor-pointer shrink-0"
                >
                  <Package className="h-4 w-4" />
                  <span className="text-sm font-medium">{outOfStockItems}</span>
                  <span className="text-xs opacity-90 dark:opacity-80 hidden lg:inline">Out</span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="lg:hidden">
                <p>{outOfStockItems} Out of Stock</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Low Stock Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  table.getColumn("status")?.setFilterValue("LOW_STOCK");
                }}
                className="flex items-center gap-1.5 h-10 px-2 lg:px-3 rounded-md bg-secondary dark:bg-secondary/20 border border-secondary dark:border-secondary/40 text-white dark:text-secondary shadow-warm-sm dark:shadow-none hover:bg-secondary/90 dark:hover:bg-secondary/30 transition-colors cursor-pointer shrink-0"
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">{lowStockItems}</span>
                <span className="text-xs opacity-90 dark:opacity-80 hidden lg:inline">Low</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="lg:hidden">
              <p>{lowStockItems} Low Stock</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 h-10 px-2 lg:px-3 rounded-md bg-accent dark:bg-accent/20 border border-accent dark:border-accent/40 text-white dark:text-accent shadow-warm-sm dark:shadow-none shrink-0">
                <Coins className="h-4 w-4" />
                <span className="text-sm font-medium">₱{inventoryValue.toLocaleString()}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Inventory Value: ₱{inventoryValue.toLocaleString()}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Separator */}
        <div className="h-8 w-px bg-border mx-1 shrink-0" />

        {/* Import CSV - Icon only on smaller screens */}
        {onImportClick && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={onImportClick}
                  className="h-10 gap-1.5 shrink-0"
                >
                  <Upload className="h-4 w-4" />
                 
                </Button>
              </TooltipTrigger>
              <TooltipContent className="xl:hidden">
                <p>Import CSV</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Add Product - Using primary (crimson) color */}
        {onAddClick && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onAddClick}
                  className="h-10 gap-1.5 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden lg:inline">Add Product</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="lg:hidden">
                <p>Add Product</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Table Container with Internal Scroll */}
      <div className="flex-1 min-h-0 rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="h-10 bg-muted/30">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    <p className="text-muted-foreground">No results.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="shrink-0">
        <DataTablePagination table={table} />
      </div>

      {/* Bulk Archive Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive {selectedCount} product{selectedCount !== 1 ? "s" : ""}?
            </AlertDialogTitle>
          <AlertDialogDescription>
            This will archive{" "}
            <span className="font-semibold text-foreground">
              {selectedCount} product{selectedCount !== 1 ? "s" : ""}
            </span>
            . They will be hidden from inventory and POS, but can be restored anytime from the Archived tab.
          </AlertDialogDescription>
        </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkArchive}
              disabled={isPending}
              className="bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:ring-warning/40"
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Archiving...
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive {selectedCount} Product{selectedCount !== 1 ? "s" : ""}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
