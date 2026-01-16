"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { motion } from "framer-motion";
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
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  User,
  ExternalLink,
  MoreHorizontal,
  Archive,
  CheckCircle2,
  Package,
  Undo2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { SortableHeader } from "@/components/ui/sortable-header";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTablePagination } from "@/components/data-table-pagination";
import { type SupplierInfo, toggleSupplierStatus, backfillSuppliersFromBatches } from "@/actions/supplier";
import { AddSupplierDialog } from "./add-supplier-dialog";
import { ImportSupplierDialog } from "./import-supplier-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SuppliersClientProps {
  initialSuppliers: SupplierInfo[];
}

export function SuppliersClient({ initialSuppliers }: SuppliersClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [suppliers] = useState(initialSuppliers);
  const [globalFilter, setGlobalFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);

  // Filter suppliers by status tab
  const filteredByStatus = useMemo(() => {
    return suppliers.filter((s) => {
      return activeTab === "active" ? s.status === "ACTIVE" : s.status === "ARCHIVED";
    });
  }, [suppliers, activeTab]);

  // Summary stats
  const activeCount = suppliers.filter((s) => s.status === "ACTIVE").length;
  const archivedCount = suppliers.filter((s) => s.status === "ARCHIVED").length;
  const totalDeliveries = suppliers.reduce((sum, s) => sum + s.total_batches, 0);
  const totalReturns = suppliers.reduce((sum, s) => sum + s.total_returns, 0);

  const handleToggleStatus = async (supplier: SupplierInfo) => {
    startTransition(async () => {
      const result = await toggleSupplierStatus(supplier.id);
      if (result.success) {
        toast.success(
          result.data!.status === "ARCHIVED"
            ? `${supplier.name} archived`
            : `${supplier.name} reactivated`
        );
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update status");
      }
    });
  };

  const handleBackfill = async () => {
    startTransition(async () => {
      const result = await backfillSuppliersFromBatches();
      if (result.success) {
        toast.success("Backfill complete", {
          description: `Created ${result.data!.created} suppliers, linked ${result.data!.linked} batches`,
        });
        router.refresh();
      } else {
        toast.error(result.error || "Failed to backfill");
      }
    });
  };

  // Column definitions
  const columns: ColumnDef<SupplierInfo>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <SortableHeader column={column}>
          Supplier
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <div>
          <Link
            href={`/admin/suppliers/${row.original.id}`}
            className="font-medium text-foreground hover:text-[#AC0F16] hover:underline"
          >
            {row.original.name}
          </Link>
          {row.original.address && (
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {row.original.address}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "contact_person",
      header: "Contact",
      cell: ({ row }) => (
        <div className="space-y-0.5">
          {row.original.contact_person && (
            <div className="flex items-center gap-1.5 text-sm">
              <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{row.original.contact_person}</span>
            </div>
          )}
          {row.original.contact_number && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span>{row.original.contact_number}</span>
            </div>
          )}
          {row.original.email && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate max-w-[150px]">{row.original.email}</span>
            </div>
          )}
          {!row.original.contact_person && !row.original.contact_number && !row.original.email && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "total_batches",
      header: ({ column }) => (
        <SortableHeader column={column} className="justify-center">
          Deliveries
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="text-center">
          <span className="font-mono text-sm">{row.original.total_batches}</span>
        </div>
      ),
    },
    {
      accessorKey: "total_returns",
      header: ({ column }) => (
        <SortableHeader column={column} className="justify-center">
          Returns
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="text-center">
          <span className={cn(
            "font-mono text-sm",
            row.original.total_returns > 0 && "text-[#F1782F]"
          )}>
            {row.original.total_returns}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "last_delivery_date",
      header: ({ column }) => (
        <SortableHeader column={column}>
          Last Delivery
        </SortableHeader>
      ),
      cell: ({ row }) => (
        row.original.last_delivery_date ? (
          <span className="text-sm font-mono">
            {format(new Date(row.original.last_delivery_date), "MMM d, yyyy")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )
      ),
      sortingFn: (rowA, rowB) => {
        const dateA = rowA.original.last_delivery_date ? new Date(rowA.original.last_delivery_date).getTime() : 0;
        const dateB = rowB.original.last_delivery_date ? new Date(rowB.original.last_delivery_date).getTime() : 0;
        return dateA - dateB;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn(
            "text-xs",
            row.original.status === "ACTIVE"
              ? "bg-[#e6f7fa] text-[#2EAFC5] border-[#2EAFC5]/30"
              : "bg-stone-100 text-stone-500 border-stone-300"
          )}
        >
          {row.original.status === "ACTIVE" ? (
            <CheckCircle2 className="h-3 w-3 mr-1" />
          ) : (
            <Archive className="h-3 w-3 mr-1" />
          )}
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[160px]">
            <DropdownMenuItem asChild>
              <Link href={`/admin/suppliers/${row.original.id}`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleToggleStatus(row.original)}>
              {row.original.status === "ACTIVE" ? (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Reactivate
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      size: 60,
    },
  ], []);

  const table = useReactTable({
    data: filteredByStatus,
    columns,
    state: {
      globalFilter,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col gap-3 p-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* View Toggle - Active/Archived */}
          <div className="relative inline-flex items-center rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={cn(
                "relative inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors z-10",
                activeTab === "active"
                  ? "text-white"
                  : "text-primary/70 hover:text-primary dark:text-primary/60 dark:hover:text-primary"
              )}
            >
              <Building2 className="h-3.5 w-3.5 relative z-10" />
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
              onClick={() => setActiveTab("archived")}
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

          {/* Separator */}
          <div className="h-8 w-px bg-border shrink-0" />

          {/* Search */}
          <div className="relative flex-1 min-w-[160px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 h-10 w-full"
            />
          </div>

          {/* Stats Badges */}
          <div className="hidden md:flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="h-10.25 rounded-lg px-3 gap-1.5 cursor-default">
                  <Package className="h-3.5 w-3.5 text-[#2EAFC5]" />
                  <span className="font-mono">{totalDeliveries}</span>
                  <span className="text-muted-foreground">deliveries</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Total deliveries across all suppliers</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="h-10.25 rounded-lg px-3 gap-1.5 cursor-default">
                  <Undo2 className="h-3.5 w-3.5 text-[#F1782F]" />
                  <span className="font-mono">{totalReturns}</span>
                  <span className="text-muted-foreground">returns</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Total returns to suppliers</TooltipContent>
            </Tooltip>
          </div>

          {/* Separator */}
          <div className="h-8 w-px bg-border shrink-0 hidden md:block" />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={() => setImportDialogOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import suppliers from CSV</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-10"
                  onClick={handleBackfill}
                  disabled={isPending}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
                  Sync
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sync suppliers from existing batch data</TooltipContent>
            </Tooltip>
            <Button 
              onClick={() => setAddDialogOpen(true)} 
              className="bg-[#AC0F16] hover:bg-[#8a0c12] h-10"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden">
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                      <TableHead 
                        key={header.id}
                        className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide h-10"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-32 text-center">
                      <div className="flex flex-col items-center text-muted-foreground">
                        <Building2 className="h-12 w-12 mb-2 opacity-30" />
                        <p className="font-medium">No suppliers found</p>
                        <p className="text-sm">
                          {activeTab === "active" 
                            ? "Add your first supplier to get started" 
                            : "No archived suppliers"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="group">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Pagination */}
        <div className="shrink-0">
          <DataTablePagination table={table} />
        </div>

        {/* Add Supplier Dialog */}
        <AddSupplierDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onSuccess={() => router.refresh()}
        />

        {/* Import Supplier Dialog */}
        <ImportSupplierDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onSuccess={() => router.refresh()}
        />
      </div>
    </TooltipProvider>
  );
}
