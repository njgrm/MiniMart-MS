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
import { bulkCreateProducts, type BulkProductInput } from "@/actions/bulk-import";

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedRow {
  name: string;
  category: string;
  retail_price: string;
  wholesale_price: string;
  cost_price?: string;
  stock: string;
  barcode?: string;
  image_url?: string;
  reorder_level?: string;
  supplier_name?: string;
  reference?: string;
  expiry_date?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export function CSVImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: CSVImportDialogProps) {
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

  const generateBarcode = () => {
    return "200" + Math.floor(Math.random() * 1000000000).toString().padStart(9, "0");
  };

  const validateAndParse = (
    data: ParsedRow[]
  ): { valid: BulkProductInput[]; errors: ValidationError[] } => {
    const errors: ValidationError[] = [];
    const valid: BulkProductInput[] = [];
    const seenBarcodes = new Set<string>();

    data.forEach((row, index) => {
      const rowNum = index + 2; // +2 for header and 0-index

      // Check required fields
      if (!row.name?.trim()) {
        errors.push({ row: rowNum, field: "name", message: "Name is required" });
        return;
      }

      if (!row.category?.trim()) {
        errors.push({ row: rowNum, field: "category", message: "Category is required" });
        return;
      }

      // Allow 0 values for retail/wholesale prices (N/A products)
      const retailPrice = parseFloat(row.retail_price);
      if (isNaN(retailPrice) || retailPrice < 0) {
        errors.push({
          row: rowNum,
          field: "retail_price",
          message: "Retail price must be a non-negative number (use 0 for N/A)",
        });
        return;
      }

      const wholesalePrice = parseFloat(row.wholesale_price);
      if (isNaN(wholesalePrice) || wholesalePrice < 0) {
        errors.push({
          row: rowNum,
          field: "wholesale_price",
          message: "Wholesale price must be a non-negative number (use 0 for N/A)",
        });
        return;
      }

      const costPrice = row.cost_price ? parseFloat(row.cost_price) : 0;
      if (isNaN(costPrice) || costPrice < 0) {
        errors.push({
          row: rowNum,
          field: "cost_price",
          message: "Cost price must be a non-negative number",
        });
        return;
      }

      const stock = parseInt(row.stock);
      if (isNaN(stock) || stock < 0) {
        errors.push({
          row: rowNum,
          field: "stock",
          message: "Stock must be a non-negative number",
        });
        return;
      }

      // Generate barcode if not provided
      let barcode = row.barcode?.trim() || null;
      if (!barcode) {
        // Generate unique barcode
        do {
          barcode = generateBarcode();
        } while (seenBarcodes.has(barcode));
      }

      // Check for duplicate barcodes within the CSV
      if (barcode && seenBarcodes.has(barcode)) {
        errors.push({
          row: rowNum,
          field: "barcode",
          message: `Duplicate barcode "${barcode}" in CSV`,
        });
        return;
      }

      if (barcode) {
        seenBarcodes.add(barcode);
      }

      const reorderLevel = row.reorder_level ? parseInt(row.reorder_level) : 10;

      // Parse expiry date if provided (YYYY-MM-DD format)
      let expiryDate: Date | null = null;
      if (row.expiry_date?.trim()) {
        const dateStr = row.expiry_date.trim();
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          errors.push({
            row: rowNum,
            field: "expiry_date",
            message: `Invalid date format "${dateStr}". Use YYYY-MM-DD format.`,
          });
          return;
        }
        expiryDate = parsedDate;
      }

      valid.push({
        name: row.name.trim(),
        category: row.category.trim(),
        retail_price: retailPrice,
        wholesale_price: wholesalePrice,
        cost_price: costPrice,
        stock,
        barcode,
        image_url: row.image_url?.trim() || null,
        reorder_level: isNaN(reorderLevel) ? 10 : reorderLevel,
        supplier_name: row.supplier_name?.trim() || null,
        reference: row.reference?.trim() || null,
        expiry_date: expiryDate,
      });
    });

    return { valid, errors };
  };

  // Helper to clean CSV content (remove BOM, normalize line endings, fix wrapped lines)
  const cleanCsvContent = (content: string): string => {
    // Remove BOM (Byte Order Mark) if present
    let cleaned = content.replace(/^\uFEFF/, "");
    // Normalize line endings to \n
    cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    // Trim whitespace
    cleaned = cleaned.trim();
    
    // Fix rows that are entirely wrapped in quotes (e.g., "name,category,..." -> name,category,...)
    // This happens when entire CSV lines are quoted
    const lines = cleaned.split("\n");
    const fixedLines = lines.map((line) => {
      const trimmed = line.trim();
      // If line starts and ends with quotes, and contains commas, unwrap it
      if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.includes(",")) {
        // Remove outer quotes
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
      // Parse CSV with proper quote handling
      const result = Papa.parse<ParsedRow>(csvContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: ",", // Explicitly set comma as delimiter
        quoteChar: '"',
        escapeChar: '"',
        transformHeader: (header) => header.toLowerCase().trim().replace(/\s+/g, "_").replace(/^["']|["']$/g, ""),
        transform: (value) => value.trim().replace(/^["']|["']$/g, ""), // Strip surrounding quotes
      });

      // Filter out minor parsing errors (like empty rows)
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

      // Validate data
      const { valid, errors } = validateAndParse(result.data);

      if (errors.length > 0) {
        setValidationErrors(errors);
        toast.error(`Found ${errors.length} validation error(s). Please fix and try again.`);
        return;
      }

      // Import to database
      const importResult = await bulkCreateProducts(valid);

      if (importResult.successCount > 0) {
        toast.success(
          `Successfully imported ${importResult.successCount} product${importResult.successCount !== 1 ? "s" : ""}${
            importResult.failedCount > 0
              ? `. ${importResult.failedCount} failed (see details).`
              : "."
          }`
        );

        // Always trigger refresh when there are successful imports
        onSuccess();

        if (importResult.failedRows.length > 0) {
          // Show failed rows but keep dialog open
          setValidationErrors(
            importResult.failedRows.map((f) => ({
              row: f.row,
              field: "import",
              message: f.reason,
            }))
          );
        } else {
          // All succeeded, close dialog
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
            Import Products from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import products into your inventory.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Helper Text */}
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium text-foreground mb-1">
              Required Columns:
            </p>
            <p className="text-muted-foreground">
              <code className="text-xs bg-background px-1 rounded border border-border">name</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">category</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">retail_price</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">wholesale_price</code>,{" "}
              <code className="text-xs bg-background px-1 rounded border border-border">stock</code>
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Optional: <code className="bg-background px-1 rounded border border-border">cost_price</code>,{" "}
              <code className="bg-background px-1 rounded border border-border">barcode</code>,{" "}
              <code className="bg-background px-1 rounded border border-border">image_url</code>,{" "}
              <code className="bg-background px-1 rounded border border-border">reorder_level</code>,{" "}
              <code className="bg-background px-1 rounded border border-border">supplier_name</code>,{" "}
              <code className="bg-background px-1 rounded border border-border">reference</code>,{" "}
              <code className="bg-background px-1 rounded border border-border">expiry_date</code> (YYYY-MM-DD)
            </p>
            <p className="text-secondary text-xs mt-1">
              💡 Tip: Use <code className="bg-background px-1 rounded border border-border">0</code> for prices if product is N/A or not priced.
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
            <label htmlFor="csv-upload-input" className="sr-only">
              Upload CSV file
            </label>
            <input
              id="csv-upload-input"
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
            placeholder="name,category,retail_price,wholesale_price,stock,barcode&#10;Coca-Cola 350ml,SODA,25.00,20.00,100,4800016123456&#10;Lucky Me Pancit Canton,INSTANT_NOODLES,15.00,12.00,50,"
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
                Parse & Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
