"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type SupplierInfo, toggleSupplierStatus, backfillSuppliersFromBatches } from "@/actions/supplier";
import { AddSupplierDialog } from "./add-supplier-dialog";
import { toast } from "sonner";

interface SuppliersClientProps {
  initialSuppliers: SupplierInfo[];
}

export function SuppliersClient({ initialSuppliers }: SuppliersClientProps) {
  const router = useRouter();
  const [suppliers] = useState(initialSuppliers);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const matchesSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || s.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [suppliers, searchQuery, statusFilter]);

  // Summary stats
  const activeCount = suppliers.filter((s) => s.status === "ACTIVE").length;
  const archivedCount = suppliers.filter((s) => s.status === "ARCHIVED").length;
  const totalDeliveries = suppliers.reduce((sum, s) => sum + s.total_batches, 0);
  const totalReturns = suppliers.reduce((sum, s) => sum + s.total_returns, 0);

  const handleToggleStatus = async (supplier: SupplierInfo) => {
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
  };

  const handleBackfill = async () => {
    const result = await backfillSuppliersFromBatches();
    if (result.success) {
      toast.success("Backfill complete", {
        description: `Created ${result.data!.created} suppliers, linked ${result.data!.linked} batches`,
      });
      router.refresh();
    } else {
      toast.error(result.error || "Failed to backfill");
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2d1b1a] flex items-center gap-2">
            <Building2 className="h-6 w-6 text-[#AC0F16]" />
            Suppliers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage vendor relationships and track delivery history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleBackfill}>
            Sync from Batches
          </Button>
          <Button onClick={() => setAddDialogOpen(true)} className="bg-[#AC0F16] hover:bg-[#8a0c12]">
            <Plus className="h-4 w-4 mr-2" />
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#2EAFC5]" />
              <span className="text-sm text-muted-foreground">Active Suppliers</span>
            </div>
            <p className="text-2xl font-bold font-mono mt-2">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Archived</span>
            </div>
            <p className="text-2xl font-bold font-mono mt-2 text-muted-foreground">{archivedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-[#2EAFC5]" />
              <span className="text-sm text-muted-foreground">Total Deliveries</span>
            </div>
            <p className="text-2xl font-bold font-mono mt-2">{totalDeliveries}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Undo2 className="h-4 w-4 text-[#F1782F]" />
              <span className="text-sm text-muted-foreground">Total Returns</span>
            </div>
            <p className="text-2xl font-bold font-mono mt-2 text-[#F1782F]">{totalReturns}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                Supplier
              </TableHead>
              <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                Contact
              </TableHead>
              <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide text-center">
                Deliveries
              </TableHead>
              <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide text-center">
                Returns
              </TableHead>
              <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                Last Delivery
              </TableHead>
              <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide text-center">
                Status
              </TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center text-muted-foreground">
                    <Building2 className="h-12 w-12 mb-2 opacity-50" />
                    <p>No suppliers found</p>
                    <p className="text-sm">Add your first supplier to get started</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id} className="group">
                  <TableCell>
                    <Link
                      href={`/admin/suppliers/${supplier.id}`}
                      className="font-medium text-foreground hover:text-[#AC0F16] hover:underline"
                    >
                      {supplier.name}
                    </Link>
                    {supplier.address && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {supplier.address}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {supplier.contact_person && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {supplier.contact_person}
                        </div>
                      )}
                      {supplier.contact_number && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {supplier.contact_number}
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {supplier.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-mono text-sm">{supplier.total_batches}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-mono text-sm text-[#F1782F]">{supplier.total_returns}</span>
                  </TableCell>
                  <TableCell>
                    {supplier.last_delivery_date ? (
                      <span className="text-sm font-mono">
                        {format(new Date(supplier.last_delivery_date), "MMM d, yyyy")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={
                        supplier.status === "ACTIVE"
                          ? "bg-[#e6f7fa] text-[#2EAFC5] border-[#2EAFC5]/30"
                          : "bg-stone-100 text-stone-500 border-stone-300"
                      }
                    >
                      {supplier.status === "ACTIVE" ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <Archive className="h-3 w-3 mr-1" />
                      )}
                      {supplier.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[160px]">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/suppliers/${supplier.id}`}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleToggleStatus(supplier)}>
                          {supplier.status === "ACTIVE" ? (
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add Supplier Dialog */}
      <AddSupplierDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
