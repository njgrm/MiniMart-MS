"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import Papa from "papaparse";
import { Upload, FileText, AlertCircle, CheckCircle2, X, Loader2 } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { importSalesCsvOptimized, getImportProgress, type CsvSaleRow } from "@/actions/sales";

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
  
  // Progress tracking state
  const [importId, setImportId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    total: number;
    processed: number;
    successCount: number;
    failedCount: number;
    currentBatch: number;
    totalBatches: number;
    status: "idle" | "processing" | "completed" | "error";
    message: string;
    elapsedMs: number;
    estimatedRemainingMs: number;
  } | null>(null);

  // Poll for progress updates
  useEffect(() => {
    if (!importId || !isPending) return;
    
    const pollProgress = async () => {
      const result = await getImportProgress(importId);
      if (result) {
        setProgress(result);
        if (result.status === "completed" || result.status === "error") {
          return; // Stop polling
        }
      }
    };
    
    // Initial poll
    pollProgress();
    
    // Poll every 500ms
    const interval = setInterval(pollProgress, 500);
    
    return () => clearInterval(interval);
  }, [importId, isPending]);

  const resetState = () => {
    setCsvContent("");
    setFileName(null);
    setValidationErrors([]);
    setImportId(null);
    setProgress(null);
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
        
        // Extended Python script fields (v2 and v3 compatible)
        // v3 uses unit_price, v2 uses retail_price
        const retailPrice = rowAny.unit_price || rowAny.retail_price || rowAny.retailprice;
        const costPrice = rowAny.cost_price || rowAny.costprice;
        const subtotal = rowAny.subtotal;
        const costTotal = rowAny.cost_total;
        const profit = rowAny.profit;
        
        // Event tracking (handle Python's True/False and JS true/false)
        const isEventRaw = rowAny.is_event || rowAny.isevent;
        const isEvent = isEventRaw === "1" || isEventRaw === "true" || isEventRaw === "True" || isEventRaw === true;
        const eventSource = rowAny.event_source || rowAny.eventsource;
        const eventName = rowAny.event_name || rowAny.eventname;
        
        // v3 additional fields (for reference/logging)
        const transactionId = rowAny.transaction_id;
        const time = rowAny.time;
        const customerType = rowAny.customer_type;
        const productName = rowAny.product_name;
        const brand = rowAny.brand;
        const category = rowAny.category;
        const inflationFactor = rowAny.inflation_factor;

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

        // Payment method is now optional - defaults to CASH
        const paymentMethod = String(paymentMethodRaw || "CASH").toUpperCase();
        if (paymentMethodRaw && !["CASH", "GCASH"].includes(paymentMethod)) {
          errors.push({ row: rowNum, field: "paymentMethod", message: "Payment method must be CASH or GCASH" });
          return;
        }

        validRows.push({
          date: String(date).trim(),
          barcode: String(barcode).trim(),
          quantity: quantityNum,
          paymentMethod: paymentMethod as "CASH" | "GCASH",
          // Support both v2 (retail_price) and v3 (unit_price) formats
          retail_price: retailPrice ? parseFloat(String(retailPrice)) : undefined,
          unit_price: retailPrice ? parseFloat(String(retailPrice)) : undefined,
          cost_price: costPrice ? parseFloat(String(costPrice)) : undefined,
          subtotal: subtotal ? parseFloat(String(subtotal)) : undefined,
          cost_total: costTotal ? parseFloat(String(costTotal)) : undefined,
          profit: profit ? parseFloat(String(profit)) : undefined,
          is_event: isEvent,
          event_source: eventSource ? String(eventSource).trim() : undefined,
          event_name: eventName ? String(eventName).trim() : undefined,
          // v3 additional fields
          transaction_id: transactionId ? String(transactionId).trim() : undefined,
          time: time ? String(time).trim() : undefined,
          customer_type: customerType ? String(customerType).trim() : undefined,
          product_name: productName ? String(productName).trim() : undefined,
          brand: brand ? String(brand).trim() : undefined,
          category: category ? String(category).trim() : undefined,
          inflation_factor: inflationFactor ? parseFloat(String(inflationFactor)) : undefined,
        });
      });

      if (errors.length > 0) {
        setValidationErrors(errors);
        toast.error(`Found ${errors.length} validation error(s). Please fix and try again.`);
        return;
      }

      // Generate unique import ID for progress tracking
      const newImportId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setImportId(newImportId);
      setProgress({
        total: validRows.length,
        processed: 0,
        successCount: 0,
        failedCount: 0,
        currentBatch: 0,
        totalBatches: Math.ceil(validRows.length / 5000),
        status: "processing",
        message: "Starting import...",
        elapsedMs: 0,
        estimatedRemainingMs: 0,
      });

      // Show info toast for large imports
      if (validRows.length > 10000) {
        toast.info(`Importing ${validRows.length.toLocaleString()} records. This may take a few minutes...`);
      }

      // Use optimized import with progress tracking
      const importResult = await importSalesCsvOptimized(validRows, newImportId);

      if (importResult.successCount > 0) {
        const eventInfo = importResult.eventDaysCount > 0 
          ? ` (${importResult.eventDaysCount} event records)` 
          : "";
        toast.success(
          `Successfully imported ${importResult.successCount} sale${importResult.successCount !== 1 ? "s" : ""}${eventInfo}${
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
              Accepted Column Formats:
            </p>
            <p className="text-muted-foreground text-xs">
              <strong>Simple:</strong>{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">date</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">barcode</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">quantity</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">paymentMethod</code> (optional)
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              <strong>Python v3 (generate_history_v3.py):</strong>{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">transaction_id</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">date</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">time</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">customer_type</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">barcode</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">product_name</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">brand</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">category</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">quantity</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">unit_price</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">cost_price</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">payment_method</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">is_event</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">event_name</code>, ...
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              v3 files are grouped by <code className="text-xs bg-background px-1 rounded border border-border">transaction_id</code> (e.g., TX-20240101-0001). Date formats: YYYY-MM-DD. Payment defaults to CASH.
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
            placeholder="date,barcode,quantity,retail_price,cost_price&#10;2024-01-15,4800016123456,5,75.00,62.00&#10;2024-01-15,4800016555666,3,45.00,38.00"
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

          {/* Progress Bar (during import) */}
          {progress && progress.status === "processing" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    Importing Sales Data...
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  Batch {progress.currentBatch}/{progress.totalBatches}
                </span>
              </div>
              
              <Progress 
                value={(progress.processed / progress.total) * 100} 
                className="h-2"
              />
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {progress.processed.toLocaleString()} / {progress.total.toLocaleString()} rows
                </span>
                <span>
                  {((progress.processed / progress.total) * 100).toFixed(1)}%
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-600 dark:text-green-400">
                  ✓ {progress.successCount.toLocaleString()} imported
                </span>
                {progress.failedCount > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    ✗ {progress.failedCount.toLocaleString()} failed
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Elapsed: {Math.round(progress.elapsedMs / 1000)}s
                </span>
                <span>
                  ETA: ~{Math.round(progress.estimatedRemainingMs / 1000)}s remaining
                </span>
              </div>
              
              <p className="text-xs text-muted-foreground">{progress.message}</p>
            </div>
          )}

          {/* Completion Status */}
          {progress && progress.status === "completed" && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Import Complete!
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Successfully imported {progress.successCount.toLocaleString()} records
                {progress.failedCount > 0 && ` (${progress.failedCount.toLocaleString()} failed)`}
                {" "}in {Math.round(progress.elapsedMs / 1000)}s
              </p>
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







