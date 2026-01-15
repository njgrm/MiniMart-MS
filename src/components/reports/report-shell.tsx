"use client";

import React, { useRef, useState } from "react";
import { format } from "date-fns";
import {
  Printer,
  FileSpreadsheet,
  ArrowLeft,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import ExcelJS from "exceljs";
import { cn } from "@/lib/utils";

// Re-export animated sortable header for use in report tables
export { SortableHeader } from "@/components/ui/sortable-header";

interface DateRangeDisplay {
  from: Date;
  to: Date;
}

interface ReportShellProps {
  title: string;
  description?: string;
  dateRange?: DateRangeDisplay;
  generatedBy?: string;
  storeName?: string;
  backHref?: string;
  children: React.ReactNode;
  icon?: React.ElementType;
  /** Custom content to render in the toolbar (e.g., date picker, filters) */
  toolbarContent?: React.ReactNode;
  /** Show loading indicator in toolbar */
  isLoading?: boolean;
  /** Summary data for print preview (avoids icon rendering issues) */
  printSummary?: { label: string; value: string }[];
  /** Full table data for print preview - ALL rows not just paginated */
  printTableData?: {
    headers: string[];
    rows: (string | number)[][];
  };
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
 * Extract clean text content from HTML, removing all SVG/icon elements
 */
function extractPrintableContent(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Remove all SVG elements (icons)
  clone.querySelectorAll('svg').forEach(svg => svg.remove());
  
  // Remove print-hidden elements
  clone.querySelectorAll('[data-print-hidden="true"], .print-hidden').forEach(el => el.remove());
  
  // Remove buttons (interactive elements)
  clone.querySelectorAll('button').forEach(btn => btn.remove());
  
  // Get tables and format them properly
  const tables = clone.querySelectorAll('table');
  let tableHTML = '';
  
  tables.forEach(table => {
    const rows = table.querySelectorAll('tr');
    if (rows.length === 0) return;
    
    tableHTML += '<table>';
    rows.forEach((row, rowIdx) => {
      tableHTML += '<tr>';
      const cells = row.querySelectorAll('th, td');
      cells.forEach(cell => {
        const tag = rowIdx === 0 ? 'th' : 'td';
        // Get text content only, no icons
        const text = cell.textContent?.trim() || '';
        tableHTML += `<${tag}>${text}</${tag}>`;
      });
      tableHTML += '</tr>';
    });
    tableHTML += '</table>';
  });
  
  return tableHTML;
}

/**
 * Opens print preview in new window - kiosk-safe (no auto-print)
 */
function openPrintPreview(
  title: string, 
  storeName: string, 
  contentRef: HTMLDivElement | null,
  printSummary?: { label: string; value: string }[],
  dateRange?: DateRangeDisplay,
  printTableData?: { headers: string[]; rows: (string | number)[][] }
) {
  const printWindow = window.open("", "_blank", "width=900,height=700,scrollbars=yes,menubar=no,toolbar=no");
  if (!printWindow) {
    alert("Please allow popups to use print preview");
    return;
  }
  
  // Use provided full table data if available, otherwise fall back to DOM extraction
  let tableContent = '';
  if (printTableData && printTableData.rows.length > 0) {
    // Render full table from data (ALL rows)
    tableContent = '<table><thead><tr>';
    printTableData.headers.forEach(h => {
      tableContent += `<th>${h}</th>`;
    });
    tableContent += '</tr></thead><tbody>';
    printTableData.rows.forEach(row => {
      tableContent += '<tr>';
      row.forEach(cell => {
        tableContent += `<td>${cell}</td>`;
      });
      tableContent += '</tr>';
    });
    tableContent += '</tbody></table>';
  } else if (contentRef) {
    // Fall back to DOM extraction (paginated only)
    tableContent = extractPrintableContent(contentRef);
  }
  
  // Build date range string for header
  const dateRangeStr = dateRange 
    ? `Report Period: ${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
    : `Generated: ${format(new Date(), "MMM d, yyyy")}`;
  
  // Build summary section from provided data (avoids icon rendering issues)
  let summaryHTML = '';
  if (printSummary && printSummary.length > 0) {
    summaryHTML = `
      <div class="summary-cards">
        ${printSummary.map(item => `
          <div class="summary-card">
            <div class="label">${item.label}</div>
            <div class="value">${item.value}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} - ${storeName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Geist Sans', -apple-system, sans-serif;
      padding: 20px;
      max-width: 900px;
      margin: 0 auto;
      color: #2d1b1a;
      background: white;
    }
    .header {
      text-align: center;
      padding: 20px 0;
      border-bottom: 2px solid #2d1b1a;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      color: #2d1b1a;
    }
    .header p { color: #666; font-size: 12px; margin-top: 4px; }
    .report-info {
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #ddd;
    }
    .report-info h2 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 5px;
    }
    .report-info .meta {
      font-size: 11px;
      color: #666;
    }
    .summary-cards {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .summary-card {
      flex: 1;
      min-width: 120px;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: #f9f9f9;
    }
    .summary-card .label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #666;
      margin-bottom: 4px;
    }
    .summary-card .value {
      font-size: 18px;
      font-weight: 700;
      font-family: monospace;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 20px;
    }
    th, td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    th {
      background: #f5f5f5;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      font-size: 10px;
      color: #555;
    }
    tr:nth-child(even) td { background: #fafafa; }
    tr:hover td { background: #f5f3ef; }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 9px;
      color: #666;
    }
    .print-actions {
      position: fixed;
      top: 15px;
      right: 15px;
      display: flex;
      gap: 8px;
      z-index: 1000;
    }
    .print-btn {
      padding: 10px 20px;
      background: #AC0F16;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    .print-btn:hover { background: #8a0c12; }
    .close-btn {
      padding: 10px 16px;
      background: #666;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    .close-btn:hover { background: #555; }
    @media print {
      .no-print, .print-actions { display: none !important; }
      body { padding: 0; max-width: 100%; }
      @page { size: A4; margin: 1cm; }
    }
  </style>
</head>
<body>
  <div class="print-actions no-print">
    <button class="print-btn" onclick="window.print()">Print Report</button>
    <button class="close-btn" onclick="window.close()">Close</button>
  </div>
  
  <div class="header">
    <h1>${storeName}</h1>
    <p>Point of Sale System</p>
  </div>
  
  <div class="report-info">
    <h2>${title}</h2>
    <p class="meta">${dateRangeStr} | Generated on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</p>
  </div>
  
  ${summaryHTML}
  
  ${tableContent}
  
  <div class="footer">
    <p>This is a computer-generated document. ${storeName} POS System</p>
  </div>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * ReportShell - Wrapper component for all printable reports
 * Removed header info card - description now in toolbar
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
  toolbarContent,
  isLoading = false,
  printSummary,
  printTableData,
  excelExport,
}: ReportShellProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handlePrint = () => {
    openPrintPreview(title, storeName, reportRef.current, printSummary, dateRange, printTableData);
  };

  const handleExcelExport = async () => {
    if (!excelExport) return;

    setIsExporting(true);
    setExportSuccess(false);
    
    try {
      const { columns, rows } = await excelExport.getData();

      const workbook = new ExcelJS.Workbook();
      workbook.creator = storeName;
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet(excelExport.sheetName);

      // Title row
      worksheet.mergeCells(1, 1, 1, columns.length);
      const titleCell = worksheet.getCell(1, 1);
      titleCell.value = title;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: "center" };

      // Store name row
      worksheet.mergeCells(2, 1, 2, columns.length);
      const storeCell = worksheet.getCell(2, 1);
      storeCell.value = storeName;
      storeCell.font = { size: 11 };
      storeCell.alignment = { horizontal: "center" };

      // Metadata row
      worksheet.mergeCells(3, 1, 3, columns.length);
      const metaCell = worksheet.getCell(3, 1);
      const dateStr = dateRange
        ? `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
        : format(new Date(), "MMM d, yyyy");
      metaCell.value = `Generated: ${dateStr} | By: ${generatedBy}`;
      metaCell.font = { italic: true, size: 10, color: { argb: "FF666666" } };
      metaCell.alignment = { horizontal: "center" };

      worksheet.addRow([]);

      worksheet.columns = columns.map((col) => ({
        header: col.header,
        key: col.key,
        width: col.width || 15,
      }));

      const headerRow = worksheet.getRow(5);
      headerRow.values = columns.map((col) => col.header);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4A4A4A" } };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };
      headerRow.height = 25;

      rows.forEach((row, index) => {
        const dataRow = worksheet.addRow(row);
        if (index % 2 === 0) {
          dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F3EF" } };
        }
        dataRow.eachCell((cell, colNumber) => {
          const colDef = columns[colNumber - 1];
          const value = cell.value;
          if (typeof value === "number") {
            if (colDef?.key.includes("sales") || colDef?.key.includes("profit") || 
                colDef?.key.includes("cost") || colDef?.key.includes("revenue") ||
                colDef?.key.includes("price") || colDef?.key.includes("amount")) {
              cell.numFmt = "#,##0.00";
            } else if (colDef?.key.includes("margin") || colDef?.key.includes("percent")) {
              cell.numFmt = "0.00%";
            } else {
              cell.numFmt = "#,##0";
            }
            cell.alignment = { horizontal: "left" };
          } else {
            cell.alignment = { horizontal: "left" };
          }
        });
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber >= 5) {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin", color: { argb: "FFE0E0E0" } },
              left: { style: "thin", color: { argb: "FFE0E0E0" } },
              bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
              right: { style: "thin", color: { argb: "FFE0E0E0" } },
            };
          });
        }
      });

      worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 5, activeCell: "A6" }];

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
      
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2000);
    } catch (error) {
      console.error("Excel export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar - Title + Description */}
      <div className="shrink-0 bg-card border-b border-stone-200/80 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0 lg:hidden">
                  <Link href={backHref}>
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Back to Reports</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {Icon && (
              <div className="p-1 rounded bg-[#2EAFC5]/10 shrink-0">
                <Icon className="h-3.5 w-3.5 text-[#2EAFC5]" />
              </div>
            )}
            <h1 className="font-semibold text-sm text-foreground shrink-0">{title}</h1>
            {description && (
              <>
                <span className="text-stone-300 hidden sm:inline">|</span>
                <span className="text-xs text-muted-foreground truncate hidden sm:inline">{description}</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center translate-x-[-1.5vh]  gap-2 shrink-0">
          {/* Loading indicator removed from toolbar - use content loading states instead */}
          
          {/* Custom toolbar content (e.g., date picker) */}
          {toolbarContent}
          
          {excelExport && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExcelExport}
                    disabled={isExporting}
                    className={cn("h-9 gap-1 text-xs", exportSuccess && "border-[#2EAFC5] text-[#2EAFC5]")}
                  >
                    {isExporting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : exportSuccess ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">{isExporting ? "..." : exportSuccess ? "Done" : "Export"}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export to Excel</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={handlePrint} className="h-9 gap-1 text-xs bg-[#AC0F16] hover:bg-[#8a0c12]">
                  <Printer className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Print</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open print preview</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Scrollable Content - No header card */}
      <div ref={reportRef} className="flex-1 overflow-auto bg-[#f5f3ef]">
        <div className="p-4 space-y-4 max-w-[1600px] mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * ReportSummaryCard - Larger metric card with more detail
 */
interface ReportSummaryCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

export function ReportSummaryCard({
  label,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  className,
}: ReportSummaryCardProps) {
  const variantStyles = {
    default: "border-stone-200/80 bg-card",
    success: "border-[#2EAFC5]/30 bg-[#2EAFC5]/5",
    warning: "border-[#F1782F]/30 bg-[#F1782F]/5",
    danger: "border-[#AC0F16]/30 bg-[#AC0F16]/5",
  };

  const iconStyles = {
    default: "text-muted-foreground bg-stone-100",
    success: "text-[#2EAFC5] bg-[#2EAFC5]/10",
    warning: "text-[#F1782F] bg-[#F1782F]/10",
    danger: "text-[#AC0F16] bg-[#AC0F16]/10",
  };

  const valueStyles = {
    default: "text-foreground",
    success: "text-[#2EAFC5]",
    warning: "text-[#F1782F]",
    danger: "text-[#AC0F16]",
  };

  return (
    <Card className={cn("shadow-sm h-full", variantStyles[variant], className)}>
      <CardContent className="p-4 h-full flex flex-col justify-center">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className={cn("p-2.5 rounded-lg shrink-0", iconStyles[variant])}>
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
              {label}
            </p>
            <p className={cn("text-2xl font-bold tabular-nums font-mono", valueStyles[variant])}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ReportSection - Groups related content
 */
interface ReportSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function ReportSection({ title, description, children, action }: ReportSectionProps) {
  return (
    <Card className="shadow-sm border-stone-200/80 bg-card">
      <CardHeader className="py-3 px-4 border-b border-stone-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {children}
      </CardContent>
    </Card>
  );
}
