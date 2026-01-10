"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { format } from "date-fns";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Package,
  Search,
  RotateCcw,
  Archive,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTablePagination } from "@/components/data-table-pagination";
import { cn } from "@/lib/utils";
import type { ArchivedProduct } from "./delete-product-dialog";

interface ArchivedProductsTableProps {
  products: ArchivedProduct[];
  onRestore: (product: ArchivedProduct) => void;
  // View toggle props
  activeTab?: "active" | "archived";
  onTabChange?: (tab: "active" | "archived") => void;
  activeCount?: number;
  archivedCount?: number;
}

export function ArchivedProductsTable({
  products,
  onRestore,
  activeTab = "archived",
  onTabChange,
  activeCount = 0,
  archivedCount = 0,
}: ArchivedProductsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "deletedAt", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns: ColumnDef<ArchivedProduct>[] = useMemo(
    () => [
      {
        accessorKey: "image_url",
        header: "Image",
        cell: ({ row }) => {
          const imageUrl = row.getValue("image_url") as string | null;
          return (
            <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center flex-shrink-0 opacity-60">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={row.original.product_name}
                  width={40}
                  height={40}
                  className="object-cover w-full h-full grayscale"
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
            Product Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-muted-foreground">
              {row.original.product_name}
            </span>
            {row.original.barcode && (
              <span className="text-xs text-muted-foreground/60 font-mono">
                {row.original.barcode}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 h-8 uppercase text-[11px] font-semibold tracking-wider"
          >
            Category
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <Badge variant="secondary" className="opacity-60">
            {row.getValue("category")}
          </Badge>
        ),
      },
      {
        accessorKey: "retail_price",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 h-8 uppercase text-[11px] font-semibold tracking-wider"
          >
            Retail Price
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-sm text-muted-foreground">
            ₱{(row.getValue("retail_price") as number).toFixed(2)}
          </span>
        ),
      },
      {
        accessorKey: "current_stock",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 h-8 uppercase text-[11px] font-semibold tracking-wider"
          >
            Stock
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-sm text-muted-foreground">
            {row.getValue("current_stock")}
          </span>
        ),
      },
      {
        accessorKey: "deletedAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 h-8 uppercase text-[11px] font-semibold tracking-wider"
          >
            Archived Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const deletedAt = row.getValue("deletedAt") as Date | null;
          if (!deletedAt) return <span className="text-muted-foreground">—</span>;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-sm">
                    {format(new Date(deletedAt), "MMM d, yyyy")}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{format(new Date(deletedAt), "PPpp")}</p>
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
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/50 hover:text-green-700 dark:hover:text-green-300"
              onClick={() => onRestore(product)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore
            </Button>
          );
        },
      },
    ],
    [onRestore]
  );

  const globalFilterFn = (
    row: { original: ArchivedProduct },
    _columnId: string,
    filterValue: string
  ): boolean => {
    if (!filterValue) return true;
    const search = filterValue.toLowerCase();
    const product = row.original;
    return (
      product.product_name.toLowerCase().includes(search) ||
      (product.barcode?.toLowerCase().includes(search) ?? false) ||
      product.category.toLowerCase().includes(search)
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
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn,
    state: {
      sorting,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col gap-3">
        {/* Toolbar with toggle */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* View Toggle - Active/Archived */}
          {onTabChange && (
            <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 dark:bg-muted/30 p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => onTabChange("active")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                  activeTab === "active"
                    ? "bg-background dark:bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50 dark:hover:bg-background/20"
                )}
              >
                <Package className="h-3.5 w-3.5" />
                <span>Active</span>
                <span className={cn(
                  "ml-0.5 px-1.5 py-0.5 text-xs rounded-full",
                  activeTab === "active" 
                    ? "bg-primary/10 text-primary dark:bg-primary/20" 
                    : "bg-muted-foreground/10 text-muted-foreground"
                )}>
                  {activeCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onTabChange("archived")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                  activeTab === "archived"
                    ? "bg-background dark:bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50 dark:hover:bg-background/20"
                )}
              >
                <Archive className="h-3.5 w-3.5" />
                <span>Archived</span>
                {archivedCount > 0 && (
                  <span className={cn(
                    "ml-0.5 px-1.5 py-0.5 text-xs rounded-full",
                    activeTab === "archived" 
                      ? "bg-muted-foreground/20 text-foreground" 
                      : "bg-muted-foreground/10 text-muted-foreground"
                  )}>
                    {archivedCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Separator after toggle */}
          {onTabChange && <div className="h-8 w-px bg-border" />}

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search archived products..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 h-10 w-full"
            />
          </div>
          
          <Badge variant="outline" className="h-10 px-3 gap-1.5">
            <Archive className="h-3.5 w-3.5" />
            {products.length} archived
          </Badge>
        </div>

        {/* Empty State */}
        {products.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Archive className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              No Archived Products
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Products you archive will appear here. You can restore them anytime.
            </p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-card">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 dark:bg-muted/30 backdrop-blur-sm z-10">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="hover:bg-transparent">
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="h-11">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
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
                        className="h-14 opacity-75 hover:opacity-100 transition-opacity"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        No results found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="shrink-0">
              <DataTablePagination table={table} />
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
