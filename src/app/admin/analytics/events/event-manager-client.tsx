"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import {
  Calendar,
  Plus,
  Trash2,
  Tag,
  Megaphone,
  Store,
  PartyPopper,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  Search,
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createEvent,
  deleteEvent,
  toggleEventActive,
  importEventsCsv,
  type CreateEventInput,
  type CsvEventRow,
} from "../actions";
import Link from "next/link";

type EventSource = "STORE_DISCOUNT" | "MANUFACTURER_CAMPAIGN" | "HOLIDAY";

interface EventData {
  id: number;
  name: string;
  description: string | null;
  source: EventSource;
  start_date: Date;
  end_date: Date;
  multiplier: { toNumber: () => number } | number;
  affected_brand: string | null;
  affected_category: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: Date;
  products: {
    product: {
      product_id: number;
      product_name: string;
      barcode: string | null;
    };
  }[];
}

interface EventManagerClientProps {
  initialEvents: EventData[];
}

export function EventManagerClient({ initialEvents }: EventManagerClientProps) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [deleteEventId, setDeleteEventId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter events based on search
  const filteredEvents = events.filter(
    (event) =>
      event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.affected_brand?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleActive = async (eventId: number, currentState: boolean) => {
    startTransition(async () => {
      const result = await toggleEventActive(eventId, !currentState);
      if (result.success) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, is_active: !currentState } : e
          )
        );
        toast.success(currentState ? "Event deactivated" : "Event activated");
      } else {
        toast.error("Failed to update event");
      }
    });
  };

  const handleDelete = async () => {
    if (!deleteEventId) return;

    startTransition(async () => {
      const result = await deleteEvent(deleteEventId);
      if (result.success) {
        setEvents((prev) => prev.filter((e) => e.id !== deleteEventId));
        toast.success("Event deleted");
      } else {
        toast.error("Failed to delete event");
      }
      setDeleteEventId(null);
    });
  };

  const getSourceIcon = (source: EventSource) => {
    switch (source) {
      case "STORE_DISCOUNT":
        return <Store className="h-4 w-4" />;
      case "MANUFACTURER_CAMPAIGN":
        return <Megaphone className="h-4 w-4" />;
      case "HOLIDAY":
        return <PartyPopper className="h-4 w-4" />;
    }
  };

  const getSourceBadge = (source: EventSource) => {
    const config = {
      STORE_DISCOUNT: { label: "Store Promo", className: "bg-blue-100 text-blue-700" },
      MANUFACTURER_CAMPAIGN: { label: "Brand Ad", className: "bg-purple-100 text-purple-700" },
      HOLIDAY: { label: "Holiday", className: "bg-green-100 text-green-700" },
    };
    return config[source];
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/analytics">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Event Manager</h1>
            <p className="text-muted-foreground text-sm">
              Manage external events that affect sales forecasting
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
            </DialogTrigger>
            <ImportEventsDialog
              onClose={() => setIsImportDialogOpen(false)}
              onSuccess={() => {
                setIsImportDialogOpen(false);
                router.refresh();
              }}
            />
          </Dialog>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Event
              </Button>
            </DialogTrigger>
            <AddEventDialog
              onClose={() => setIsAddDialogOpen(false)}
              onSuccess={(newEvent) => {
                setEvents((prev) => [newEvent, ...prev]);
                setIsAddDialogOpen(false);
              }}
            />
          </Dialog>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-card to-background border-border">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Tag className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm text-foreground font-medium">
                Why track events?
              </p>
              <p className="text-sm text-muted-foreground">
                Events like TV ads or store promos cause temporary sales spikes. By tagging
                these periods, the AI forecasting engine can distinguish organic growth from
                event-driven demand, resulting in more accurate predictions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-card border-border"
        />
      </div>

      {/* Events Table */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Events Log</CardTitle>
          <CardDescription className="text-muted-foreground">
            {filteredEvents.length} events total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No events found</p>
              <p className="text-sm">Create your first event to start tracking</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 bg-muted/30 text-foreground font-semibold uppercase text-[11px] tracking-wider">Event</TableHead>
                    <TableHead className="h-10 bg-muted/30 text-foreground font-semibold uppercase text-[11px] tracking-wider">Type</TableHead>
                    <TableHead className="h-10 bg-muted/30 text-foreground font-semibold uppercase text-[11px] tracking-wider">Date Range</TableHead>
                    <TableHead className="h-10 bg-muted/30 text-foreground font-semibold uppercase text-[11px] tracking-wider text-center">
                      Multiplier
                    </TableHead>
                    <TableHead className="h-10 bg-muted/30 text-foreground font-semibold uppercase text-[11px] tracking-wider">Affected</TableHead>
                    <TableHead className="h-10 bg-muted/30 text-foreground font-semibold uppercase text-[11px] tracking-wider text-center">
                      Status
                    </TableHead>
                    <TableHead className="h-10 bg-muted/30 text-foreground font-semibold uppercase text-[11px] tracking-wider text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => {
                    const badge = getSourceBadge(event.source);
                    const multiplier = typeof event.multiplier === 'number' 
                      ? event.multiplier 
                      : event.multiplier.toNumber();
                    
                    return (
                      <TableRow key={event.id}>
                        <TableCell className="py-3">
                          <div>
                            <p className="font-medium text-foreground">{event.name}</p>
                            {event.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge className={`gap-1 ${badge.className}`}>
                            {getSourceIcon(event.source)}
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-foreground py-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(event.start_date), "MMM d")} -{" "}
                            {format(new Date(event.end_date), "MMM d, yyyy")}
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <Badge variant="outline" className="font-mono">
                            {multiplier.toFixed(1)}x
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-sm">
                            {event.affected_brand && (
                              <p className="text-foreground">{event.affected_brand}</p>
                            )}
                            {event.products.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {event.products.length} product(s)
                              </p>
                            )}
                            {!event.affected_brand && event.products.length === 0 && (
                              <span className="text-muted-foreground">All products</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(event.id, event.is_active)}
                            disabled={isPending}
                          >
                            {event.is_active ? (
                              <ToggleRight className="h-5 w-5 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteEventId(event.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEventId} onOpenChange={() => setDeleteEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this event from the system. Historical data
              that references this event will be retained.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// Add Event Dialog Component
// =============================================================================

interface AddEventDialogProps {
  onClose: () => void;
  onSuccess: (event: EventData) => void;
}

function AddEventDialog({ onClose, onSuccess }: AddEventDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    source: "MANUFACTURER_CAMPAIGN" as EventSource,
    startDate: "",
    endDate: "",
    multiplier: "2.0",
    affectedBrand: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.startDate || !formData.endDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    startTransition(async () => {
      const input: CreateEventInput = {
        name: formData.name,
        description: formData.description || undefined,
        source: formData.source,
        startDate: formData.startDate,
        endDate: formData.endDate,
        multiplier: parseFloat(formData.multiplier),
        affectedBrand: formData.affectedBrand || undefined,
      };

      const result = await createEvent(input);

      if (result.success && result.data) {
        toast.success("Event created successfully");
        onSuccess(result.data as unknown as EventData);
      } else {
        toast.error(result.error || "Failed to create event");
      }
    });
  };

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Add New Event</DialogTitle>
        <DialogDescription>
          Log an external event that affects sales (e.g., TV ad, store promo)
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Event Name *</Label>
          <Input
            id="name"
            placeholder="e.g., Coca-Cola Christmas Commercial"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Optional details about this event..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="source">Event Type *</Label>
          <Select
            value={formData.source}
            onValueChange={(value) =>
              setFormData({ ...formData, source: value as EventSource })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MANUFACTURER_CAMPAIGN">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  Brand/Manufacturer Campaign
                </div>
              </SelectItem>
              <SelectItem value="STORE_DISCOUNT">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Store Promotion/Discount
                </div>
              </SelectItem>
              <SelectItem value="HOLIDAY">
                <div className="flex items-center gap-2">
                  <PartyPopper className="h-4 w-4" />
                  Holiday/Seasonal
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date *</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date *</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="multiplier">Sales Multiplier</Label>
            <Select
              value={formData.multiplier}
              onValueChange={(value) => setFormData({ ...formData, multiplier: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1.5">1.5x (Mild boost)</SelectItem>
                <SelectItem value="2.0">2.0x (Standard)</SelectItem>
                <SelectItem value="2.5">2.5x (Strong)</SelectItem>
                <SelectItem value="3.0">3.0x (Major event)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="affectedBrand">Affected Brand</Label>
            <Input
              id="affectedBrand"
              placeholder="e.g., Coca-Cola"
              value={formData.affectedBrand}
              onChange={(e) =>
                setFormData({ ...formData, affectedBrand: e.target.value })
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
          >
            {isPending ? "Creating..." : "Create Event"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// =============================================================================
// Import Events Dialog
// =============================================================================

interface ImportEventsDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ValidationError {
  row: number;
  message: string;
}

function ImportEventsDialog({ onClose, onSuccess }: ImportEventsDialogProps) {
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
    onClose();
  };

  const cleanCsvContent = (content: string): string => {
    let cleaned = content.replace(/^\uFEFF/, "");
    cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return cleaned.trim();
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
      const result = Papa.parse<CsvEventRow>(csvContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: ",",
        transformHeader: (header) => header.toLowerCase().trim().replace(/\s+/g, "_"),
        transform: (value) => value.trim(),
      });

      if (result.errors.length > 0) {
        toast.error("CSV parsing error: " + result.errors[0].message);
        return;
      }

      if (result.data.length === 0) {
        toast.error("No data found in CSV");
        return;
      }

      // Validate required fields
      const errors: ValidationError[] = [];
      const validRows: CsvEventRow[] = [];

      result.data.forEach((row, index) => {
        const rowNum = index + 2;
        const rowAny = row as any;

        const name = rowAny.name;
        const source = rowAny.source;
        const startDate = rowAny.start_date || rowAny.startdate;
        const endDate = rowAny.end_date || rowAny.enddate;

        if (!name?.trim()) {
          errors.push({ row: rowNum, message: "Name is required" });
          return;
        }

        if (!source?.trim()) {
          errors.push({ row: rowNum, message: "Source is required" });
          return;
        }

        if (!startDate?.trim()) {
          errors.push({ row: rowNum, message: "Start date is required" });
          return;
        }

        if (!endDate?.trim()) {
          errors.push({ row: rowNum, message: "End date is required" });
          return;
        }

        validRows.push({
          name: name.trim(),
          source: source.trim(),
          start_date: startDate.trim(),
          end_date: endDate.trim(),
          multiplier: rowAny.multiplier,
          affected_brand: rowAny.affected_brand || rowAny.affectedbrand,
          affected_barcodes: rowAny.affected_barcodes || rowAny.affectedbarcodes,
        });
      });

      if (errors.length > 0) {
        setValidationErrors(errors);
        toast.error(`Found ${errors.length} validation error(s)`);
        return;
      }

      // Import to database
      const importResult = await importEventsCsv(validRows);

      if (importResult.successCount > 0) {
        toast.success(
          `Successfully imported ${importResult.successCount} event${importResult.successCount !== 1 ? "s" : ""}${
            importResult.failedCount > 0
              ? `. ${importResult.failedCount} failed.`
              : "."
          }`
        );

        if (importResult.failedRows.length > 0) {
          setValidationErrors(
            importResult.failedRows.map((f) => ({
              row: f.row,
              message: f.reason,
            }))
          );
        } else {
          onSuccess();
          handleClose();
        }
      } else {
        toast.error("Import failed. All rows had errors.");
        setValidationErrors(
          importResult.failedRows.map((f) => ({
            row: f.row,
            message: f.reason,
          }))
        );
      }
    });
  };

  return (
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Events from CSV
        </DialogTitle>
        <DialogDescription>
          Upload events_log.csv from the Python data generator script.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Helper Text */}
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="font-medium text-foreground mb-1">
            Expected Columns:
          </p>
          <p className="text-muted-foreground text-xs">
            <code className="bg-background px-1 rounded border border-border">name</code>,{" "}
            <code className="bg-background px-1 rounded border border-border">source</code>,{" "}
            <code className="bg-background px-1 rounded border border-border">start_date</code>,{" "}
            <code className="bg-background px-1 rounded border border-border">end_date</code>,{" "}
            <code className="bg-background px-1 rounded border border-border">multiplier</code>,{" "}
            <code className="bg-background px-1 rounded border border-border">affected_brand</code>
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Source types: STORE_DISCOUNT, MANUFACTURER_CAMPAIGN, HOLIDAY
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
            ${isDragging
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50"
            }
          `}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isPending}
          />

          {fileName ? (
            <div className="flex items-center justify-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
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
                Drop events_log.csv here, or{" "}
                <span className="text-primary font-medium">click to browse</span>
              </p>
            </>
          )}
        </div>

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
              Import Events
            </>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
