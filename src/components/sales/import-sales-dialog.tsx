"use client";

import { useState, useTransition, useCallback } from "react";
import Papa from "papaparse";
import { Upload, FileText, AlertCircle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { importSalesCsv, type CsvSaleRow } from "@/actions/sales";

interface ImportSalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

/**
 * ImportSalesDialog - Bulk import historical sales from CSV
 * Matches the exact style of the Inventory Import Dialog
 */
export function ImportSalesDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportSalesDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [csvContent, setCsvContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = () => {
    setCsvContent("");
    setFileName(null);
    setValidationErrors([]);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  // Helper to clean CSV content
  const cleanCsvContent = (content: string): string => {
    let cleaned = content.replace(/^\uFEFF/, "");
    cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    cleaned = cleaned.trim();
    
    const lines = cleaned.split("\n");
    const fixedLines = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.includes(",")) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    });
    
    return fixedLines.join("\n");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = cleanCsvContent(event.target?.result as string);
        setCsvContent(content);
        setValidationErrors([]);
      };
      reader.readAsText(file, "UTF-8");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = cleanCsvContent(event.target?.result as string);
        setCsvContent(content);
        setValidationErrors([]);
      };
      reader.readAsText(file, "UTF-8");
    } else {
      toast.error("Please drop a valid CSV file");
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleImport = () => {
    if (!csvContent.trim()) {
      toast.error("Please provide CSV content");
      return;
    }

    startTransition(async () => {
      // Parse CSV
      const result = Papa.parse<CsvSaleRow>(csvContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: ",",
        quoteChar: '"',
        transformHeader: (header) => header.toLowerCase().trim().replace(/\s+/g, "_"),
        transform: (value) => value.trim(),
      });

      const criticalErrors = result.errors.filter(
        (e) => e.type !== "FieldMismatch" && e.code !== "TooFewFields"
      );

      if (criticalErrors.length > 0) {
        toast.error("CSV parsing error: " + criticalErrors[0].message);
        return;
      }

      if (result.data.length === 0) {
        toast.error("No data found in CSV");
        return;
      }

      // Validate data client-side
      const errors: ValidationError[] = [];
      const validRows: CsvSaleRow[] = [];

      result.data.forEach((row, index) => {
        const rowNum = index + 2;
        const rowAny = row as any; // Papa.parse returns dynamic keys after transformHeader

        // Access fields with case-insensitive fallback (transformHeader converts to lowercase)
        const date = rowAny.date || rowAny.Date || row.date;
        const barcode = rowAny.barcode || rowAny.Barcode || row.barcode;
        const quantity = rowAny.quantity || rowAny.Quantity || row.quantity;
        const paymentMethodRaw = rowAny.paymentmethod || rowAny.paymentMethod || rowAny.payment_method || row.paymentMethod || row.payment_method || "";

        if (!date?.trim()) {
          errors.push({ row: rowNum, field: "date", message: "Date is required" });
          return;
        }

        if (!barcode?.trim()) {
          errors.push({ row: rowNum, field: "barcode", message: "Barcode is required" });
          return;
        }

        const quantityNum = parseInt(String(quantity));
        if (isNaN(quantityNum) || quantityNum <= 0) {
          errors.push({ row: rowNum, field: "quantity", message: "Quantity must be a positive number" });
          return;
        }

        const paymentMethod = String(paymentMethodRaw).toUpperCase();
        if (!paymentMethod || !["CASH", "GCASH"].includes(paymentMethod)) {
          errors.push({ row: rowNum, field: "paymentMethod", message: "Payment method must be CASH or GCASH" });
          return;
        }

        validRows.push({
          date: String(date).trim(),
          barcode: String(barcode).trim(),
          quantity: quantityNum,
          paymentMethod: paymentMethod as "CASH" | "GCASH",
        });
      });

      if (errors.length > 0) {
        setValidationErrors(errors);
        toast.error(`Found ${errors.length} validation error(s). Please fix and try again.`);
        return;
      }

      // Import to database
      const importResult = await importSalesCsv(validRows);

      if (importResult.successCount > 0) {
        toast.success(
          `Successfully imported ${importResult.successCount} sale${importResult.successCount !== 1 ? "s" : ""}${
            importResult.failedCount > 0
              ? `. ${importResult.failedCount} failed (see details).`
              : "."
          }`
        );

        onSuccess();

        if (importResult.failedRows.length > 0) {
          setValidationErrors(
            importResult.failedRows.map((f) => ({
              row: f.row,
              field: "import",
              message: f.reason,
            }))
          );
        } else {
          handleClose();
        }
      } else {
        toast.error("Import failed. All rows had errors.");
        setValidationErrors(
          importResult.failedRows.map((f) => ({
            row: f.row,
            field: "import",
            message: f.reason,
          }))
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Sales History from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to backfill historical sales data for analytics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Helper Text */}
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium text-foreground mb-1">
              Required Columns:
            </p>
            <p className="text-muted-foreground">
              <code className="text-xs bg-background px-1 rounded border border-border">date</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">barcode</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">quantity</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">paymentMethod</code>
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Date formats: YYYY-MM-DD, MM/DD/YYYY, or DD-MM-YYYY. Payment methods: CASH or GCASH.
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              <strong>Note:</strong> Cost price will be automatically fetched from each product&apos;s current supply cost.
            </p>
          </div>

          {/* Drop Zone / File Input */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
              ${isDragging
                ? "border-accent bg-accent/10"
                : "border-border hover:border-primary/50"
              }
            `}
          >
            <label htmlFor="sales-csv-upload-input" className="sr-only">
              Upload CSV file
            </label>
            <input
              id="sales-csv-upload-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isPending}
              aria-label="Upload CSV file"
              title="Upload CSV file"
            />
            
            {fileName ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-8 w-8 text-accent" />
                <div className="text-left">
                  <p className="font-medium text-foreground">{fileName}</p>
                  <p className="text-xs text-muted-foreground">Click or drop to replace</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetState();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Drop your CSV file here, or{" "}
                  <span className="text-primary font-medium">
                    click to browse
                  </span>
                </p>
              </>
            )}
          </div>

          {/* Or paste CSV content */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or paste CSV content
              </span>
            </div>
          </div>

          <textarea
            value={csvContent}
            onChange={(e) => {
              setCsvContent(e.target.value);
              setFileName(null);
              setValidationErrors([]);
            }}
            placeholder="date,barcode,quantity,paymentMethod&#10;2023-11-15,480864702009,1,GCASH&#10;2023-11-15,965412919731,5,CASH&#10;2023-11-15,480392515112,3,GCASH"
            className="w-full h-32 p-3 text-sm font-mono rounded-lg border border-border bg-muted text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={isPending}
          />

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  {validationErrors.length} Error{validationErrors.length !== 1 ? "s" : ""} Found
                </span>
              </div>
              <ScrollArea className="h-32">
                <ul className="space-y-1 text-xs text-destructive">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isPending || !csvContent.trim()}
            className="gap-2"
          >
            {isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Importing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Parse & Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}







