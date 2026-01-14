"use client";

import { useState, useTransition } from "react";
import { format, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  Trash2,
  Undo2,
  AlertTriangle,
  Package,
  DollarSign,
  Calendar,
  Search,
  RefreshCw,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  ReportShell,
  ReportSummaryCard,
  ReportSection,
} from "@/components/reports/report-shell";
import {
  getSpoilageReport,
  type SpoilageReportResult,
  type SpoilageItem,
} from "@/actions/reports";

interface SpoilageReportClientProps {
  initialData: SpoilageReportResult;
}

const movementTypeLabels: Record<string, { label: string; color: string }> = {
  DAMAGE: { label: "Damaged", color: "bg-red-100 text-red-700" },
  SUPPLIER_RETURN: { label: "Returned to Supplier", color: "bg-orange-100 text-orange-700" },
  ADJUSTMENT: { label: "Adjusted Out", color: "bg-slate-100 text-slate-700" },
};

export function SpoilageReportClient({ initialData }: SpoilageReportClientProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<SpoilageReportResult>(initialData);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const handleDateChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      startTransition(async () => {
        const result = await getSpoilageReport({ from: range.from!, to: range.to! });
        setData(result);
      });
    }
  };

  const handleRefresh = () => {
    if (dateRange?.from && dateRange?.to) {
      startTransition(async () => {
        const result = await getSpoilageReport({ from: dateRange.from!, to: dateRange.to! });
        setData(result);
      });
    }
  };

  // Filter items by search query
  const filteredItems = data.items.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.product_name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.barcode?.toLowerCase().includes(query) ||
      item.reason?.toLowerCase().includes(query)
    );
  });

  // Excel export configuration
  const excelExport = {
    filename: "spoilage_wastage_report",
    sheetName: "Spoilage Report",
    getData: async () => ({
      columns: [
        { header: "Date", key: "date", width: 12 },
        { header: "Product", key: "product_name", width: 30 },
        { header: "Category", key: "category", width: 15 },
        { header: "Barcode", key: "barcode", width: 15 },
        { header: "Type", key: "movement_type", width: 18 },
        { header: "Qty Lost", key: "quantity_lost", width: 10 },
        { header: "Cost/Unit", key: "cost_price", width: 12 },
        { header: "Est. Loss", key: "estimated_loss", width: 12 },
        { header: "Reason", key: "reason", width: 30 },
        { header: "Supplier", key: "supplier_name", width: 20 },
        { header: "Logged By", key: "logged_by", width: 15 },
      ],
      rows: filteredItems.map((item) => ({
        date: format(item.logged_at, "yyyy-MM-dd"),
        product_name: item.product_name,
        category: item.category,
        barcode: item.barcode || "",
        movement_type: movementTypeLabels[item.movement_type]?.label || item.movement_type,
        quantity_lost: item.quantity_lost,
        cost_price: item.cost_price,
        estimated_loss: item.estimated_loss,
        reason: item.reason || "",
        supplier_name: item.supplier_name || "",
        logged_by: item.logged_by,
      })),
    }),
  };

  return (
    <ReportShell
      title="Spoilage & Wastage Report"
      description="Track stock losses from damage, expiry, and supplier returns. Critical for loss prevention and FEFO validation."
      dateRange={dateRange?.from && dateRange?.to ? { from: dateRange.from, to: dateRange.to } : undefined}
      generatedBy="Admin"
      excelExport={excelExport}
    >
      {/* Filters - Screen Only */}
      <div className="flex flex-col sm:flex-row gap-3 print-hidden" data-print-hidden="true">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, categories, reasons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <DateRangePicker
          date={dateRange}
          onDateChange={handleDateChange}
        />
        <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isPending}>
          <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ReportSummaryCard
          label="Total Incidents"
          value={data.summary.total_items}
          icon={AlertTriangle}
          variant="warning"
        />
        <ReportSummaryCard
          label="Units Lost"
          value={data.summary.total_units_lost.toLocaleString()}
          icon={Package}
          variant="danger"
        />
        <ReportSummaryCard
          label="Estimated Loss"
          value={`₱${data.summary.total_estimated_loss.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          variant="danger"
        />
        <ReportSummaryCard
          label="Report Period"
          value={dateRange?.from ? format(dateRange.from, "MMM d") + " - " + format(dateRange.to!, "MMM d") : "30 Days"}
          icon={Calendar}
        />
      </div>

      {/* Breakdown by Type */}
      {Object.keys(data.summary.by_type).length > 0 && (
        <ReportSection title="Breakdown by Type">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(data.summary.by_type).map(([type, stats]) => (
              <div
                key={type}
                className="bg-card rounded-lg p-3 border print:border-gray-300"
              >
                <div className="flex items-center gap-2 mb-2">
                  {type === "DAMAGE" && <Trash2 className="h-4 w-4 text-red-600" />}
                  {type === "SUPPLIER_RETURN" && <Undo2 className="h-4 w-4 text-orange-600" />}
                  <span className="font-medium text-sm">
                    {movementTypeLabels[type]?.label || type}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Incidents:</span>{" "}
                    <span className="font-mono">{stats.count}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Units:</span>{" "}
                    <span className="font-mono">{stats.units}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Loss:</span>{" "}
                    <span className="font-mono text-red-600">
                      ₱{stats.loss.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ReportSection>
      )}

      {/* Detailed Table */}
      <ReportSection title="Detailed Records" description={`${filteredItems.length} records found`}>
        <div className="rounded-lg border bg-card overflow-hidden print:border-gray-300">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 print:bg-gray-100">
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-[130px]">Type</TableHead>
                <TableHead className="text-right w-[80px]">Qty</TableHead>
                <TableHead className="text-right w-[100px]">Est. Loss</TableHead>
                <TableHead className="print:hidden">Reason</TableHead>
                <TableHead className="w-[100px] print:hidden">Logged By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No spoilage or wastage records found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item, index) => (
                  <TableRow key={index} className="print:text-sm">
                    <TableCell className="font-mono text-sm">
                      {format(item.logged_at, "MMM d")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.category}
                          {item.barcode && ` • ${item.barcode}`}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={movementTypeLabels[item.movement_type]?.color || ""}
                      >
                        {movementTypeLabels[item.movement_type]?.label || item.movement_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-red-600">
                      -{item.quantity_lost}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ₱{item.estimated_loss.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate print:hidden">
                      {item.reason || "—"}
                    </TableCell>
                    <TableCell className="text-sm print:hidden">
                      {item.logged_by}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ReportSection>
    </ReportShell>
  );
}
