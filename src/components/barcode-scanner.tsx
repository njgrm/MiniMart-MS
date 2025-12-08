"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ open, onOpenChange, onScan }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "barcode-scanner-container";

  useEffect(() => {
    if (open) {
      startScanner();
    }

    return () => {
      stopScanner();
    };
  }, [open]);

  const startScanner = async () => {
    setError(null);
    setIsScanning(true);

    try {
      // Wait for the DOM element to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.5,
        },
        (decodedText) => {
          // Successfully scanned
          onScan(decodedText);
          stopScanner();
          onOpenChange(false);
        },
        () => {
          // Ignore scan failures (happens frequently when no barcode in frame)
        }
      );
    } catch (err) {
      console.error("Scanner error:", err);
      setIsScanning(false);
      if (err instanceof Error) {
        if (err.message.includes("Permission denied") || err.message.includes("NotAllowedError")) {
          setError("Camera permission denied. Please allow camera access to scan barcodes.");
        } else if (err.message.includes("NotFoundError")) {
          setError("No camera found. Please ensure your device has a camera.");
        } else {
          setError("Failed to start camera. Please try again.");
        }
      } else {
        setError("Failed to start camera. Please try again.");
      }
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          // Html5QrcodeScannerState.SCANNING
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanner();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#1A1A1E] border-gray-200 dark:border-[#1F1F23]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <Camera className="h-5 w-5" />
            Scan Barcode
          </DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">
            Position the barcode within the frame to scan.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-3 mb-4">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm text-center text-red-600 dark:text-red-400 mb-4">
                {error}
              </p>
              <Button onClick={startScanner} variant="outline">
                Try Again
              </Button>
            </div>
          ) : (
            <div className="relative">
              <div
                id={scannerContainerId}
                className="w-full aspect-[4/3] bg-zinc-900 rounded-lg overflow-hidden"
              />
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-40 border-2 border-emerald-500 rounded-lg animate-pulse" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


