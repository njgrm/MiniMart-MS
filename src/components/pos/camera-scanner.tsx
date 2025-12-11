"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, ScanBarcode, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CameraScannerProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

type BarcodeDetectorType = typeof window extends { BarcodeDetector: any }
  ? InstanceType<(typeof window)["BarcodeDetector"]>
  : never;

export function CameraScanner({ open, onClose, onDetected }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [supportsDetector, setSupportsDetector] = useState(false);

  // Beep helper
  const beep = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!open) return;
    let raf: number;

    const start = async () => {
      setError(null);
      setScanning(true);
      try {
        const support = "BarcodeDetector" in window;
        setSupportsDetector(support);
        if (support) {
          // @ts-ignore
          detectorRef.current = new window.BarcodeDetector({
            formats: ["qr_code", "code_128", "ean_13", "upc_a", "upc_e"],
          });
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const tick = async () => {
          if (!detectorRef.current || !videoRef.current) return;
          try {
            const barcodes = await detectorRef.current.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              if (code) {
                beep();
                onDetected(code);
              }
            }
          } catch (err) {
            console.error("Barcode detect error", err);
          }
          raf = requestAnimationFrame(tick);
        };

        if (detectorRef.current) {
          raf = requestAnimationFrame(tick);
        }
      } catch (err) {
        console.error(err);
        setError("Unable to access camera. Please allow camera permissions or use manual input.");
      } finally {
        setScanning(false);
      }
    };

    start();

    return () => {
      cancelAnimationFrame(raf);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [open, onDetected]);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onDetected(manualCode.trim());
      beep();
      setManualCode("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5" />
            Camera Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted/50">
            {error ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <p>{error}</p>
              </div>
            ) : (
              <>
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                {!supportsDetector && (
                  <div className="absolute inset-x-0 bottom-0 bg-background/80 p-3 text-xs text-muted-foreground">
                    BarcodeDetector not supported on this browser. Use manual input below.
                  </div>
                )}
              </>
            )}
            {scanning && (
              <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting camera...
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Manual code</label>
            <div className="flex items-center gap-2">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter or paste barcode"
              />
              <Button type="button" onClick={handleManualSubmit}>
                Add
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Camera className="h-4 w-4" />
              Camera access is only used for barcode scanning.
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}




