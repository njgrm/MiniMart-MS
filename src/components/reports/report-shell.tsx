"use client";

import React, { useRef, useState } from "react";
import { format } from "date-fns";
import {
  Printer,
  FileSpreadsheet,
  ArrowLeft,
  Calendar,
  User,
  Building2,
  Eye,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import ExcelJS from "exceljs";

interface DateRangeDisplay {
  from: Date;
  to: Date;
}

interface ReportShellProps {
  /** Report title displayed in header */
  title: string;
  /** Optional subtitle/description */
  description?: string;
  /** Date range for the report (optional) */
  dateRange?: DateRangeDisplay;
  /** Username who generated the report */
  generatedBy?: string;
  /** Store name (defaults to Christian Minimart) */
  storeName?: string;
  /** Back button href (defaults to /admin/reports) */
  backHref?: string;
  /** Children content (the actual report) */
  children: React.ReactNode;
  /** Icon for the report header */
  icon?: React.ElementType;
  /** Excel export configuration */
  excelExport?: {
    filename: string;
    sheetName: string;
    getData: () => Promise<{
      columns: { header: string; key: string; width?: number }[];
      rows: Record<string, unknown>[];
    }>;
  };
}

/**
 * ReportShell - Wrapper component for all printable reports
 * 
 * Follows the Analytics Dashboard pattern:
 * - Full-height container with negative margins to break out of parent padding
 * - Sticky control bar at top (bg-card with shadow)
 * - Scrollable content area with proper padding
 * - Print-optimized layout
 */
export function ReportShell({
  title,
  description,
  dateRange,
  generatedBy = "System",
  storeName = "Christian Minimart",
  backHref = "/admin/reports",
  children,
  icon: Icon,
  excelExport,
}: ReportShellProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleExcelExport = async () => {
    if (!excelExport) return;

    setIsExporting(true);
    try {
      const { columns, rows } = await excelExport.getData();

      const workbook = new ExcelJS.Workbook();
      workbook.creator = storeName;
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet(excelExport.sheetName);

      // Add title row
      worksheet.mergeCells(1, 1, 1, columns.length);
      const titleCell = worksheet.getCell(1, 1);
      titleCell.value = title;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: "center" };

      // Add metadata row
      worksheet.mergeCells(2, 1, 2, columns.length);
      const metaCell = worksheet.getCell(2, 1);
      const dateStr = dateRange
        ? `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
        : format(new Date(), "MMM d, yyyy");
      metaCell.value = `Generated: ${dateStr} | By: ${generatedBy}`;
      metaCell.font = { italic: true, size: 10 };
      metaCell.alignment = { horizontal: "center" };

      // Empty row
      worksheet.addRow([]);

      // Header row
      worksheet.columns = columns.map((col) => ({
        header: col.header,
        key: col.key,
        width: col.width || 15,
      }));

      // Style header row (row 4)
      const headerRow = worksheet.getRow(4);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8E4E0" },
      };

      // Add data rows starting from row 5
      rows.forEach((row) => {
        worksheet.addRow(row);
      });

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${excelExport.filename}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Excel export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          nav, aside, header, .print-hidden, [data-print-hidden="true"] {
            display: none !important;
          }
          body, html {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          main, .print-content {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-only {
            display: block !important;
          }
          .preview-controls {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 1cm;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      {/* Preview Mode Overlay */}
      {previewMode && (
        <div className="fixed inset-0 z-50 bg-muted/80 flex flex-col print:bg-white">
          <div className="preview-controls bg-card border-b px-6 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">Print Preview</span>
              <span className="text-muted-foreground text-sm">
                — This is exactly what will print
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewMode(false)}
              >
                <X className="h-4 w-4 mr-2" />
                Exit Preview
              </Button>
              <Button
                size="sm"
                onClick={handlePrint}
                className="bg-[#AC0F16] hover:bg-[#8a0c12]"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Now
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-8 flex justify-center">
            <div className="bg-white shadow-2xl rounded-sm w-full max-w-4xl min-h-[297mm] print:shadow-none print:rounded-none">
              <div className="p-8 print:p-0">
                <div className="text-center mb-6 border-b pb-4">
                  <h1 className="text-xl font-bold">{storeName}</h1>
                  <p className="text-sm text-muted-foreground">Point of Sale System</p>
                </div>
                <div className="mb-6 border rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">{title}</h2>
                      {description && (
                        <p className="text-sm text-muted-foreground mt-1">{description}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {dateRange && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <User className="h-3 w-3" />
                        {generatedBy}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">{children}</div>
                <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
                  <p>Generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")} | {storeName} POS System</p>
                  <p className="mt-1">This is a computer-generated document.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout - Following POS page pattern (no padding from parent) */}
      <div className="flex flex-col h-full overflow-hidden">
        {/* Sticky Control Bar - flush with top nav */}
        <div
          className="shrink-0 z-20 bg-card border-b px-4 md:px-6 py-3 shadow-sm print-hidden"
          data-print-hidden="true"
        >
          <div className="flex items-center justify-between gap-3">
            {/* Left: Back button & Title */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild className="gap-2">
                <Link href={backHref}>
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Reports</span>
                </Link>
              </Button>
              <div className="h-6 w-px bg-border hidden sm:block" />
              <div className="flex items-center gap-2">
                {Icon && <Icon className="h-5 w-5 text-[#2EAFC5]" />}
                <h1 className="font-semibold text-foreground">{title}</h1>
              </div>
            </div>
            
            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {excelExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExcelExport}
                  disabled={isExporting}
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export"}</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewMode(true)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Preview</span>
              </Button>
              <Button size="sm" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Print</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div
          ref={reportRef}
          className="flex-1 overflow-auto p-4 md:p-6 space-y-4 print:p-0 print-content"
        >
          {/* Report Header Card */}
          <Card className="shadow-sm print:shadow-none print:border">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {Icon && <Icon className="h-5 w-5 text-[#2EAFC5] print:hidden" />}
                    {title}
                  </CardTitle>
                  {description && (
                    <CardDescription className="mt-1">{description}</CardDescription>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {dateRange && (
                    <Badge variant="outline" className="gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                    </Badge>
                  )}
                  <Badge variant="outline" className="gap-1.5">
                    <User className="h-3 w-3" />
                    {generatedBy}
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 print:hidden">
                    <Building2 className="h-3 w-3" />
                    {storeName}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Report Body - Children */}
          {children}

          {/* Print-only Footer */}
          <div className="print-only mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
            <p>Generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")} | {storeName} POS System</p>
            <p className="mt-1">This is a computer-generated document.</p>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * ReportSummaryCard - Compact metric card for report summaries
 * Uses proper design system tokens
 */
interface ReportSummaryCardProps {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

export function ReportSummaryCard({
  label,
  value,
  icon: Icon,
  variant = "default",
  className,
}: ReportSummaryCardProps) {
  const variantStyles = {
    default: "",
    success: "border-[#2EAFC5]/30 bg-[#2EAFC5]/5",
    warning: "border-[#F1782F]/30 bg-[#F1782F]/5",
    danger: "border-destructive/30 bg-destructive/5",
  };

  const iconStyles = {
    default: "text-muted-foreground",
    success: "text-[#2EAFC5]",
    warning: "text-[#F1782F]",
    danger: "text-destructive",
  };

  return (
    <Card className={`shadow-sm ${variantStyles[variant]} ${className ?? ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="print:hidden">
              <Icon className={`h-5 w-5 ${iconStyles[variant]}`} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium truncate">
              {label}
            </p>
            <p className="text-xl font-bold text-foreground tabular-nums font-mono">
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ReportSection - Groups related content within a report
 */
interface ReportSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function ReportSection({ title, description, children, action }: ReportSectionProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && (
              <CardDescription>{description}</CardDescription>
            )}
          </div>
          {action && <div className="print:hidden">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}
