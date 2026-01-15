"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  User,
  Package,
  Undo2,
  Edit,
  Archive,
  CheckCircle2,
  Calendar,
  DollarSign,
  FileText,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type SupplierDetails, toggleSupplierStatus } from "@/actions/supplier";
import { EditSupplierDialog } from "./edit-supplier-dialog";
import { toast } from "sonner";

interface SupplierDetailsClientProps {
  supplier: SupplierDetails;
}

// Helper: Format peso
function formatPeso(amount: number) {
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function SupplierDetailsClient({ supplier }: SupplierDetailsClientProps) {
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Calculate stats
  const totalDeliveryValue = supplier.deliveries.reduce(
    (sum, d) => sum + (d.cost_price || 0) * d.quantity,
    0
  );
  const totalDeliveryUnits = supplier.deliveries.reduce((sum, d) => sum + d.quantity, 0);
  const totalReturnUnits = supplier.returns.reduce(
    (sum, r) => sum + Math.abs(r.quantity_change),
    0
  );

  const handleToggleStatus = async () => {
    const result = await toggleSupplierStatus(supplier.id);
    if (result.success) {
      toast.success(
        result.data!.status === "ARCHIVED"
          ? "Supplier archived"
          : "Supplier reactivated"
      );
      router.refresh();
    } else {
      toast.error(result.error || "Failed to update status");
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/suppliers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#2d1b1a] flex items-center gap-2">
                <Building2 className="h-6 w-6 text-[#AC0F16]" />
                {supplier.name}
              </h1>
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
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Supplier since {format(new Date(supplier.created_at), "MMMM yyyy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/suppliers/${supplier.id}/analytics`}>
            <Button variant="outline">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
          </Link>
          <Button variant="outline" onClick={handleToggleStatus}>
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
          </Button>
          <Button onClick={() => setEditDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contact Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {supplier.contact_person && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{supplier.contact_person}</span>
              </div>
            )}
            {supplier.contact_number && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{supplier.contact_number}</span>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{supplier.email}</span>
              </div>
            )}
            {supplier.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-sm">{supplier.address}</span>
              </div>
            )}
            {!supplier.contact_person &&
              !supplier.contact_number &&
              !supplier.email &&
              !supplier.address && (
                <p className="text-sm text-muted-foreground">No contact info</p>
              )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Delivery Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-[#2EAFC5]" />
                <span className="text-sm">Total Deliveries</span>
              </div>
              <span className="font-mono font-medium">{supplier.total_batches}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-[#2EAFC5]" />
                <span className="text-sm">Total Value</span>
              </div>
              <span className="font-mono font-medium">{formatPeso(totalDeliveryValue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Last Delivery</span>
              </div>
              <span className="font-mono text-sm">
                {supplier.last_delivery_date
                  ? format(new Date(supplier.last_delivery_date), "MMM d, yyyy")
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Returns Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Returns Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Undo2 className="h-4 w-4 text-[#F1782F]" />
                <span className="text-sm">Total Returns</span>
              </div>
              <span className="font-mono font-medium text-[#F1782F]">
                {supplier.total_returns}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-[#F1782F]" />
                <span className="text-sm">Units Returned</span>
              </div>
              <span className="font-mono font-medium text-[#F1782F]">
                {totalReturnUnits}
              </span>
            </div>
            {supplier.notes && (
              <div className="pt-2 border-t">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-xs text-muted-foreground">{supplier.notes}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Deliveries & Returns */}
      <Tabs defaultValue="deliveries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="deliveries" className="gap-2">
            <Package className="h-4 w-4" />
            Deliveries ({supplier.total_batches})
          </TabsTrigger>
          <TabsTrigger value="returns" className="gap-2">
            <Undo2 className="h-4 w-4" />
            Returns ({supplier.total_returns})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deliveries">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                    Date
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                    Product
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                    Batch #
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide text-right">
                    Quantity
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide text-right">
                    Cost
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                    Expiry
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.deliveries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No deliveries recorded</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  supplier.deliveries.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(delivery.received_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">{delivery.product_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {delivery.batch_number || `#${delivery.id}`}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {delivery.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {delivery.cost_price ? formatPeso(delivery.cost_price) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {delivery.expiry_date
                          ? format(new Date(delivery.expiry_date), "MMM d, yyyy")
                          : "No expiry"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="returns">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                    Date
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                    Product
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide text-right">
                    Quantity
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                    Reason
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.returns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <div className="text-muted-foreground">
                        <Undo2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No returns recorded</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  supplier.returns.map((ret) => (
                    <TableRow key={ret.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(ret.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">{ret.product_name}</TableCell>
                      <TableCell className="text-right font-mono text-[#F1782F]">
                        {Math.abs(ret.quantity_change).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {ret.reason || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <EditSupplierDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        supplier={supplier}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
