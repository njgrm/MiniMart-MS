"use client";

import Barcode from "react-barcode";
import { Printer, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ProductForBarcode {
  product_id: number;
  product_name: string;
  barcode: string | null;
  retail_price: number;
}

interface BarcodeModalProps {
  open: boolean;
  onClose: () => void;
  products: ProductForBarcode[];
  storeName?: string;
  onPrint: () => void;
}

export function BarcodeModal({
  open,
  onClose,
  products,
  storeName = "Christian Minimart",
  onPrint,
}: BarcodeModalProps) {
  const productsWithBarcodes = products.filter((p) => p.barcode);

  if (productsWithBarcodes.length === 0) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Print Barcodes</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            <p>No products with barcodes selected.</p>
            <p className="text-sm mt-2">
              Please select products that have barcodes assigned.
            </p>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Barcodes ({productsWithBarcodes.length} items)
          </DialogTitle>
        </DialogHeader>

        {/* Print Controls */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Preview your barcode labels below. Click Print to open in a new window.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={onPrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* Preview Area - Matches print layout exactly (4 columns, fixed card sizes) */}
        <div className="flex-1 overflow-auto p-4 bg-white rounded-lg border min-h-0">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 160px)",
              gap: "16px",
              width: "fit-content",
            }}
          >
            {productsWithBarcodes.map((product) => (
              <div
                key={product.product_id}
                style={{
                  width: "160px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  background: "#ffffff",
                }}
              >
                {/* Store Name */}
                <p
                  style={{
                    fontSize: "10px",
                    color: "#6b7280",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "4px",
                  }}
                >
                  {storeName}
                </p>

                {/* Barcode SVG - Fixed size */}
                <div style={{ margin: "4px 0" }}>
                  <Barcode
                    value={product.barcode!}
                    width={1.2}
                    height={40}
                    fontSize={10}
                    margin={0}
                    displayValue={true}
                    lineColor="#000000"
                    background="#ffffff"
                  />
                </div>

                {/* Price - Big */}
                <p
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#000000",
                    fontFamily: "monospace",
                    marginTop: "4px",
                  }}
                >
                  ₱{product.retail_price.toFixed(2)}
                </p>

                {/* Product Name */}
                <p
                  style={{
                    fontSize: "9px",
                    color: "#4b5563",
                    lineHeight: 1.3,
                    marginTop: "4px",
                    maxHeight: "2.6em",
                    overflow: "hidden",
                  }}
                >
                  {product.product_name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
