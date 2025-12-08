"use client";

import { useState, useMemo, useTransition } from "react";
import Image from "next/image";
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
  Trash2,
  Search,
  Package,
  X,
  Upload,
  Plus,
  AlertTriangle,
  Boxes,
  Coins,
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
import { DataTablePagination } from "@/components/data-table-pagination";
import { bulkDeleteProducts } from "@/actions/product";
import type { ProductData } from "./inventory-client";

interface ProductsTableProps {
  products: ProductData[];
  onEdit: (product: ProductData) => void;
  onDelete: (product: ProductData) => void;
  onBulkDelete?: (productIds: number[]) => void;
  onImportClick?: () => void;
  onAddClick?: () => void;
}

export function ProductsTable({ 
  products, 
  onEdit, 
  onDelete, 
  onBulkDelete,
  onImportClick,
  onAddClick,
}: ProductsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Calculate KPI stats
  const totalProducts = products.length;
  const lowStockItems = products.filter((p) => p.status === "LOW_STOCK").length;
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
            <div className="w-10 h-10 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
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
                <Package className="h-4 w-4 text-zinc-400" />
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
            className="-ml-4 h-8"
          >
            Name
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium truncate max-w-[200px]">{row.getValue("product_name")}</div>
        ),
      },
      {
        accessorKey: "barcode",
        header: "Barcode",
        cell: ({ row }) => {
          const barcode = row.getValue("barcode") as string | null;
          return barcode ? (
            <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono">
              {barcode}
            </code>
          ) : (
            <span className="text-zinc-400 text-xs">—</span>
          );
        },
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize text-xs">
            {(row.getValue("category") as string).toLowerCase().replace("_", " ")}
          </Badge>
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
            className="-ml-4 h-8"
          >
            Retail
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const amount = parseFloat(row.getValue("retail_price"));
          return <div className="tabular-nums">₱{amount.toFixed(2)}</div>;
        },
      },
      {
        accessorKey: "wholesale_price",
        header: "Wholesale",
        cell: ({ row }) => {
          const amount = parseFloat(row.getValue("wholesale_price"));
          return <div className="tabular-nums">₱{amount.toFixed(2)}</div>;
        },
      },
      {
        accessorKey: "current_stock",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 h-8"
          >
            Stock
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const stock = row.getValue("current_stock") as number;
          const reorderLevel = row.original.reorder_level;
          return (
            <div className={`tabular-nums ${stock <= reorderLevel ? "text-amber-600 dark:text-amber-400 font-medium" : ""}`}>
              {stock}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          return (
            <Badge
              variant={status === "LOW_STOCK" ? "destructive" : "default"}
              className={`text-xs ${
                status === "IN_STOCK"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100"
                  : ""
              }`}
            >
              {status === "LOW_STOCK" ? "Low" : "In Stock"}
            </Badge>
          );
        },
        filterFn: (row, id, value) => {
          return value === "all" || row.getValue(id) === value;
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
                <DropdownMenuItem onClick={() => onEdit(product)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(product)}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [onEdit, onDelete]
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

  const handleBulkDelete = () => {
    startTransition(async () => {
      const result = await bulkDeleteProducts(selectedProductIds);
      
      if (result.success) {
        toast.success(`Successfully deleted ${selectedProductIds.length} product${selectedProductIds.length !== 1 ? "s" : ""}`);
        setRowSelection({});
        onBulkDelete?.(selectedProductIds);
      } else {
        toast.error(result.error || "Failed to delete products");
      }
      
      setShowDeleteDialog(false);
    });
  };

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Selection Toolbar - Only visible when items are selected */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 h-10 shrink-0">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
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
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selectedCount})
            </Button>
          </div>
        </div>
      )}

      {/* Table Toolbar - Single Row */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search by name or barcode..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 h-[38px] w-full"
          />
        </div>

        {/* Category Filter */}
        <Select
          value={categoryFilter ?? "all"}
          onValueChange={(value) =>
            table.getColumn("category")?.setFilterValue(value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="h-[38px] w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="SODA">Soda</SelectItem>
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
          <SelectTrigger className="h-[38px] w-[120px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="IN_STOCK">In Stock</SelectItem>
            <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-[38px] px-2"
            onClick={resetFilters}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Reset filters</span>
          </Button>
        )}

        {/* Separator */}
        <div className="h-7 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />

        {/* KPI Cards - Inline single row */}
        <div className="flex items-center gap-2 h-[38px] px-3 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <Boxes className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{totalProducts}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Products</span>
        </div>

        <div className="flex items-center gap-2 h-[38px] px-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">{lowStockItems}</span>
          <span className="text-xs text-amber-600 dark:text-amber-500">Low Stock</span>
        </div>

        <div className="flex items-center gap-2 h-[38px] px-3 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">₱{inventoryValue.toLocaleString()}</span>
        </div>

        {/* Separator */}
        <div className="h-7 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />

        {/* Import CSV */}
        {onImportClick && (
          <Button
            variant="outline"
            onClick={onImportClick}
            className="h-[38px] gap-1.5"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
        )}

        {/* Add Product */}
        {onAddClick && (
          <Button
            onClick={onAddClick}
            className="h-[38px] gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        )}
      </div>

      {/* Table Container with Internal Scroll */}
      <div className="flex-1 min-h-0 rounded-md border border-gray-200 dark:border-[#1F1F23] bg-white dark:bg-[#1A1A1E] overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white dark:bg-[#1A1A1E] z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-gray-200 dark:border-[#1F1F23] hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="text-zinc-500 dark:text-zinc-400 h-10 bg-white dark:bg-[#1A1A1E]">
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
                    className="border-gray-200 dark:border-[#1F1F23] hover:bg-zinc-50 dark:hover:bg-zinc-800/50 data-[state=selected]:bg-zinc-100 dark:data-[state=selected]:bg-zinc-800"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-zinc-900 dark:text-zinc-100 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    <p className="text-zinc-500 dark:text-zinc-400">No results.</p>
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

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white dark:bg-[#1A1A1E] border-gray-200 dark:border-[#1F1F23]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-900 dark:text-zinc-100">
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500 dark:text-zinc-400">
              This action cannot be undone. It will permanently delete{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedCount} product{selectedCount !== 1 ? "s" : ""}
              </span>{" "}
              from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isPending}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Deleting...
                </>
              ) : (
                `Delete ${selectedCount} Product${selectedCount !== 1 ? "s" : ""}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
