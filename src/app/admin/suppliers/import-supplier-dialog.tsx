"use client";

import { useState, useTransition, useRef } from "react";
import { Upload, FileSpreadsheet, Package, Undo2, Building2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  importSuppliersFromCSV,
  importBatchesFromCSV,
  importReturnsFromCSV,
} from "@/actions/bulk-import-suppliers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ImportSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ImportType = "suppliers" | "batches" | "returns";

interface FileState {
  file: File | null;
  content: string | null;
  preview: string[] | null;
  rowCount: number;
}

export function ImportSupplierDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportSupplierDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<ImportType>("suppliers");
  const [files, setFiles] = useState<Record<ImportType, FileState>>({
    suppliers: { file: null, content: null, preview: null, rowCount: 0 },
    batches: { file: null, content: null, preview: null, rowCount: 0 },
    returns: { file: null, content: null, preview: null, rowCount: 0 },
  });
  const [importResult, setImportResult] = useState<{
    type: ImportType;
    created: number;
    skipped: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (type: ImportType, file: File) => {
    const content = await file.text();
    const lines = content.trim().split("\n");
    const preview = lines.slice(0, 4); // First 3 data rows + header
    const rowCount = Math.max(0, lines.length - 1);

    setFiles((prev) => ({
      ...prev,
      [type]: { file, content, preview, rowCount },
    }));
  };

  const handleDrop = (e: React.DragEvent, type: ImportType) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      handleFileSelect(type, file);
    }
  };

  const handleImport = async (type: ImportType) => {
    const fileState = files[type];
    if (!fileState.content) return;

    startTransition(async () => {
      let result;
      switch (type) {
        case "suppliers":
          result = await importSuppliersFromCSV(fileState.content!);
          break;
        case "batches":
          result = await importBatchesFromCSV(fileState.content!);
          break;
        case "returns":
          result = await importReturnsFromCSV(fileState.content!);
          break;
      }

      if (result.success && result.data) {
        const data = result.data;
        let created = 0;
        let skipped = 0;

        if (type === "suppliers") {
          created = data.suppliersCreated;
          skipped = data.suppliersSkipped;
        } else if (type === "batches") {
          created = data.batchesCreated;
          skipped = data.batchesSkipped;
        } else {
          created = data.returnsCreated;
          skipped = data.returnsSkipped;
        }

        setImportResult({ type, created, skipped });
        toast.success(`Import complete`, {
          description: `Created ${created} records, skipped ${skipped}`,
        });
        onSuccess?.();
      } else {
        toast.error(result.error || "Import failed");
      }
    });
  };

  const clearFile = (type: ImportType) => {
    setFiles((prev) => ({
      ...prev,
      [type]: { file: null, content: null, preview: null, rowCount: 0 },
    }));
    setImportResult(null);
  };

  const resetAll = () => {
    setFiles({
      suppliers: { file: null, content: null, preview: null, rowCount: 0 },
      batches: { file: null, content: null, preview: null, rowCount: 0 },
      returns: { file: null, content: null, preview: null, rowCount: 0 },
    });
    setImportResult(null);
  };

  const tabConfig: Record<ImportType, { label: string; icon: React.ElementType; description: string }> = {
    suppliers: {
      label: "Suppliers",
      icon: Building2,
      description: "Import supplier master data (name, contact, address)",
    },
    batches: {
      label: "Deliveries",
      icon: Package,
      description: "Import inventory batches (restocks from suppliers)",
    },
    returns: {
      label: "Returns",
      icon: Undo2,
      description: "Import supplier return records",
    },
  };

  const currentFile = files[activeTab];
  const TabIcon = tabConfig[activeTab].icon;

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetAll();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-[#2EAFC5]" />
            Import Supplier Data
          </DialogTitle>
          <DialogDescription>
            Import suppliers, deliveries, and returns from CSV files generated by the Python script.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ImportType)}>
          <TabsList className="grid w-full grid-cols-3">
            {(Object.keys(tabConfig) as ImportType[]).map((type) => {
              const { label, icon: Icon } = tabConfig[type];
              const hasFile = files[type].file !== null;
              return (
                <TabsTrigger key={type} value={type} className="gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                  {hasFile && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                      ✓
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {(Object.keys(tabConfig) as ImportType[]).map((type) => (
            <TabsContent key={type} value={type} className="mt-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {tabConfig[type].description}
                </p>

                {/* File Drop Zone */}
                {!files[type].file ? (
                  <div
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                    onDrop={(e) => handleDrop(e, type)}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".csv";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleFileSelect(type, file);
                      };
                      input.click();
                    }}
                  >
                    <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-medium">Drop CSV file here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Expected file: {type === "suppliers" ? "suppliers.csv" : type === "batches" ? "inventory_batches.csv" : "stock_movements_returns.csv"}
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-[#2EAFC5]" />
                        <div>
                          <p className="font-medium text-sm">{files[type].file!.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {files[type].rowCount} rows detected
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => clearFile(type)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Preview */}
                    {files[type].preview && (
                      <div className="bg-card rounded border overflow-hidden">
                        <div className="text-[11px] font-mono p-2 overflow-x-auto">
                          {files[type].preview!.map((line, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "whitespace-nowrap",
                                idx === 0 && "font-semibold text-muted-foreground"
                              )}
                            >
                              {line.substring(0, 100)}{line.length > 100 ? "..." : ""}
                            </div>
                          ))}
                          {files[type].rowCount > 3 && (
                            <div className="text-muted-foreground mt-1">
                              ... and {files[type].rowCount - 3} more rows
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Import Result */}
                    {importResult && importResult.type === type && (
                      <div className="mt-3 p-3 rounded-lg bg-[#e6f7fa] border border-[#2EAFC5]/30">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-[#2EAFC5]" />
                          <span className="font-medium text-sm">Import Complete</span>
                        </div>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className="text-[#2EAFC5]">
                            {importResult.created} created
                          </span>
                          {importResult.skipped > 0 && (
                            <span className="text-muted-foreground">
                              {importResult.skipped} skipped (duplicates)
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            Import suppliers first, then deliveries, then returns
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={() => handleImport(activeTab)}
              disabled={!currentFile.file || isPending}
              className="bg-[#AC0F16] hover:bg-[#8a0c12]"
            >
              {isPending ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-pulse" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {tabConfig[activeTab].label}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
