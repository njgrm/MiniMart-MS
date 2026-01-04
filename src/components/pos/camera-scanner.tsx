"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";
import { X, ScanBarcode, Camera, CheckCircle, RotateCcw, Wifi, AlertCircle, RefreshCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CameraScannerProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  /** Optional: Get product name for toast display */
  getProductName?: (barcode: string) => string | null;
}

interface ScanToast {
  id: number;
  productName: string;
  barcode: string;
}

export function CameraScanner({ open, onClose, onDetected, getProductName }: CameraScannerProps) {
  const [lastScanned, setLastScanned] = useState<string>("");
  const [lastScanTime, setLastScanTime] = useState<number>(0);
  const [manualCode, setManualCode] = useState("");
  const [toasts, setToasts] = useState<ScanToast[]>([]);
  const [toastId, setToastId] = useState(0);
  const [cameraError, setCameraError] = useState<string>("");
  const [debugStatus, setDebugStatus] = useState<string>("Initializing...");
  const [videoKey, setVideoKey] = useState<number>(0); // For retry functionality

  // Debug mode state
  const [showDebug, setShowDebug] = useState<boolean>(false);

  // Enhanced debug state variables
  const [streamInfo, setStreamInfo] = useState<string>("No stream");
  const [videoDimensions, setVideoDimensions] = useState<string>("Unknown");
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const [connectionQuality, setConnectionQuality] = useState<string>("Unknown");
  const [streamTracks, setStreamTracks] = useState<string>("No tracks");
  const [mediaDevices, setMediaDevices] = useState<string>("Enumerating...");
  const [browserInfo, setBrowserInfo] = useState<string>("");
  const [streamActive, setStreamActive] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const codeReader = useRef(new BrowserMultiFormatReader());
  const currentStream = useRef<MediaStream | null>(null);
  const scanInterval = useRef<NodeJS.Timeout | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number } | null>(null);

  // Beep helper - synthetic beep sound
  const beep = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 1200;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // ignore audio errors
    }
  }, []);

  // Show toast notification
  const showToast = useCallback((barcode: string) => {
    const productName = getProductName?.(barcode) || barcode;
    const id = toastId + 1;
    setToastId(id);
    
    setToasts((prev) => [...prev, { id, productName, barcode }]);
    
    // Auto-remove toast after 2 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2000);
  }, [getProductName, toastId]);

  // Handle successful scan with debounce
  const handleScan = useCallback((code: string) => {
    const now = Date.now();
    const DEBOUNCE_MS = 2000;

    // Debounce: Ignore if same code scanned within 2 seconds
    if (code === lastScanned && now - lastScanTime < DEBOUNCE_MS) {
      return;
    }

    // Success!
    setLastScanned(code);
    setLastScanTime(now);
    
    // Play beep and show toast
    beep();
    showToast(code);
    
    // Trigger callback
    onDetected(code);
  }, [lastScanned, lastScanTime, beep, showToast, onDetected]);

  // Manual Camera Opener - Bare Metal Implementation
  const startCamera = useCallback(async () => {
    try {
      setCameraError("");
      setDebugStatus("Requesting camera access...");
      setStreamInfo("Opening device...");
      
      console.log("🎥 Starting manual camera access...");
      
      // 🚫 CRITICAL: Guard against multiple stream initializations
      if (streamActive || videoRef.current?.srcObject) {
        console.log("Stream already active, skipping init.");
        return;
      }
      
      // Stop any existing streams first
      if (currentStream.current) {
        console.log("🛑 Stopping existing stream");
        currentStream.current.getTracks().forEach(track => track.stop());
        currentStream.current = null;
      }

      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }

      // Request Raw Stream with Basic VGA Constraints (Most Compatible)
      console.log("📹 Requesting raw stream with VGA constraints...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: "environment" // Try back camera first
        } 
      });

      console.log("✅ Stream acquired:", stream);
      currentStream.current = stream;

      // Debug Tracks
      const tracks = stream.getVideoTracks();
      console.log("🔍 Tracks found:", tracks.length, tracks[0]?.label);
      
      if (tracks.length === 0) {
        throw new Error("Device connected but sent no video tracks. Check Privacy Settings.");
      }

      // Set stream info
      const trackLabel = tracks[0]?.label || "Unknown camera";
      setStreamTracks(`${tracks.length} track(s): ${trackLabel}`);
      setConnectionQuality("Active");
      setStreamInfo("Stream established");

      // Attach to Video Element
      if (videoRef.current) {
        console.log("🎬 Attaching stream to video element");
        videoRef.current.srcObject = stream;
        
        // Wait for video to actually be ready with valid dimensions
        videoRef.current.onloadedmetadata = async () => {
          console.log("📺 Video metadata loaded");
          
          // 🛡️ GUARD: Ignore placeholder dimensions (2x2, 0x0, etc.)
          if (videoRef.current!.videoWidth < 10 || videoRef.current!.videoHeight < 10) {
            console.log(`Waiting for real dimensions (Currently: ${videoRef.current!.videoWidth}x${videoRef.current!.videoHeight})...`);
            return;
          }
          
          console.log(`Real dimensions loaded: ${videoRef.current!.videoWidth}x${videoRef.current!.videoHeight}`);
          
          try {
            await videoRef.current!.play();
            setStreamActive(true);
            setIsVideoReady(true);
            setDebugStatus("Camera active - Ready to scan");
            setVideoDimensions(`${videoRef.current!.videoWidth}x${videoRef.current!.videoHeight}`);
            startScanning(); // Start Canvas-based scanning (no stream parameter)
          } catch (e) {
            console.error("❌ Play error:", e);
            setCameraError("Failed to start video playback");
          }
        };
        
        // 🔄 CRITICAL: Add resize listener to catch when video switches from 2x2 to real dimensions
        videoRef.current.onresize = () => {
          if (videoRef.current && videoRef.current.videoWidth > 10 && !streamActive) {
            console.log(`📏 Video resized to real dimensions: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
            // Trigger the metadata handler logic
            videoRef.current!.dispatchEvent(new Event('loadedmetadata'));
          }
        };

        videoRef.current.oncanplay = () => {
          console.log("✅ Video can play");
          setDebugStatus("Video ready");
        };

        videoRef.current.onerror = (e) => {
          console.error("❌ Video error:", e);
          setCameraError("Video playback error");
        };
      }
    } catch (err: any) {
      console.error("💥 Camera Start Error:", err);
      let errorMsg = "Failed to open camera";
      
      if (err.name === "NotAllowedError") {
        errorMsg = "Camera permission denied. Please allow camera access and try again.";
      } else if (err.name === "NotFoundError") {
        errorMsg = "No camera found. Please connect a camera and try again.";
      } else if (err.name === "NotSupportedError") {
        errorMsg = "Camera not supported in this browser.";
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setCameraError(errorMsg);
      setDebugStatus(`Error: ${errorMsg}`);
      setStreamInfo("Failed to connect");
      setConnectionQuality("Failed");
    }
  }, []);

  // Silent Observer: Canvas-based Passive Scanning (FIXED VERSION)
  const startScanning = useCallback(() => {
    // Clear any existing loop
    if (scanInterval.current) {
      clearInterval(scanInterval.current);
      scanInterval.current = null;
    }
    
    console.log("🔍 Starting Silent Observer canvas scanning...");
    setDebugStatus("Scanning for barcodes...");
    
    // Create the passive scanning loop
    scanInterval.current = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState === 4) { // 4 = HAVE_ENOUGH_DATA
        try {
          // 1. Capture Frame
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Optimization hint
          
          if (ctx) {
            // Apply image filters to improve barcode detection
            ctx.filter = 'grayscale(1) contrast(1.5)';
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            // 2. Convert to high quality Data URL for better barcode detection
            const dataUrl = canvas.toDataURL('image/jpeg', 1.0);

            // DEBUG: Mirror to visible canvas if enabled
            if (showDebug && debugCanvasRef.current) {
              const dCtx = debugCanvasRef.current.getContext('2d');
              if (dCtx) {
                debugCanvasRef.current.width = canvas.width;
                debugCanvasRef.current.height = canvas.height;
                dCtx.drawImage(canvas, 0, 0);
              }
            }

            // 3. Decode from the URL (This is the standard API)
            const result = await codeReader.current.decodeFromImageUrl(dataUrl);

            if (result) {
              const now = Date.now();
              const scannedCode = result.getText();

              // Debounce: If same code was scanned less than 1.5 seconds ago, ignore it
              if (lastScannedRef.current?.code === scannedCode && now - lastScannedRef.current.time < 1500) {
                return;
              }

              // Update ref and trigger
              lastScannedRef.current = { code: scannedCode, time: now };
              console.log("✅ Scanned Code:", scannedCode);
              handleScan(scannedCode);

              // Optional: Pause briefly to prevent multiple scans of same code
              await new Promise(resolve => setTimeout(resolve, 600));
            }
          }
        } catch (err) {
          // Ignore "NotFoundException" (It just means no barcode in this specific frame)
          const errorName = (err as any)?.name;
          if (errorName !== 'NotFoundException' && errorName !== 'checksum_error') {
             console.warn("Scan frame error:", err);
          }
        }
      }
    }, 50); // Scan 10 times a second for better detection
  }, [handleScan]);

  // Enhanced video event handlers
  const handleVideoLoadStart = useCallback(() => {
    setDebugStatus("Loading video...");
    console.log("🔄 Video load started");
  }, []);

  const handleVideoLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.target as HTMLVideoElement;
    const dimensions = `${video.videoWidth}x${video.videoHeight}`;
    setVideoDimensions(dimensions);
    setDebugStatus("Video metadata loaded");
    console.log(`✅ Video metadata loaded: ${dimensions}`);
  }, []);

  const handleVideoPlay = useCallback(() => {
    setDebugStatus("Playing - Stream active");
    setConnectionQuality("Active");
    console.log("▶️ Video playing");
  }, []);

  const handleVideoPause = useCallback(() => {
    setDebugStatus("Paused");
    console.log("⏸️ Video paused");
  }, []);

  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.target as HTMLVideoElement;
    const error = video.error;
    let errorMsg = "Unknown video error";
    
    if (error) {
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMsg = "Video loading aborted";
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMsg = "Network error during video loading";
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMsg = "Video decoding error";
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg = "Video format not supported";
          break;
        default:
          errorMsg = `Video error (code: ${error.code})`;
      }
    }
    
    setDebugStatus(`Video Error: ${errorMsg}`);
    setCameraError(errorMsg);
    console.error("❌ Video error:", errorMsg);
  }, []);

  // Media device enumeration
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const deviceInfo = videoDevices.map((device, index) =>
        `${index + 1}. ${device.label || 'Camera ' + (index + 1)}`
      ).join('\n');
      setMediaDevices(`Found ${videoDevices.length} camera(s):\n${deviceInfo}`);
      console.log("📱 Media devices:", videoDevices);
    } catch (error) {
      setMediaDevices("Cannot enumerate devices");
      console.warn("⚠️ Cannot enumerate media devices:", error);
    }
  }, []);

  // Browser compatibility check
  useEffect(() => {
    const userAgent = navigator.userAgent;
    let browserName = "Unknown";
    if (userAgent.includes("Chrome")) browserName = "Chrome";
    else if (userAgent.includes("Firefox")) browserName = "Firefox";
    else if (userAgent.includes("Safari")) browserName = "Safari";
    else if (userAgent.includes("Edge")) browserName = "Edge";
    
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasMediaDevices = !!navigator.mediaDevices;
    
    setBrowserInfo(`${browserName} | getUserMedia: ${hasGetUserMedia ? '✓' : '✗'} | MediaDevices: ${hasMediaDevices ? '✓' : '✗'}`);
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Cleanup on close
      console.log("🧹 Cleaning up scanner");
      setLastScanned("");
      setLastScanTime(0);
      setToasts([]);
      setManualCode("");
      setDebugStatus("Initializing...");
      setStreamInfo("No stream");
      setVideoDimensions("Unknown");
      setIsVideoReady(false);
      setConnectionQuality("Unknown");
      setStreamTracks("No tracks");
      setStreamActive(false);
      
      // Stop scanning loop
      if (scanInterval.current) {
        clearInterval(scanInterval.current);
        scanInterval.current = null;
      }
      
      // Stop current stream
      if (currentStream.current) {
        currentStream.current.getTracks().forEach(track => track.stop());
        currentStream.current = null;
      }
      
      // Reset decoder
      codeReader.current.reset();
    } else {
      // When modal opens, enumerate devices and start camera
      enumerateDevices();
      setTimeout(() => startCamera(), 100); // Small delay to ensure modal is ready
    }
  }, [open, enumerateDevices, startCamera]);

  // Enhanced retry camera function
  const retryCamera = useCallback(() => {
    console.log("🔄 Retrying camera...");
    setVideoKey(prev => prev + 1);
    setDebugStatus("Retrying...");
    setCameraError("");
    setStreamInfo("Requesting new stream...");
    setConnectionQuality("Unknown");
    setIsVideoReady(false);
    setStreamActive(false);
    
    // Stop scanning loop
    if (scanInterval.current) {
      clearInterval(scanInterval.current);
      scanInterval.current = null;
    }
    
    // Stop current stream first
    if (currentStream.current) {
      currentStream.current.getTracks().forEach(track => track.stop());
      currentStream.current = null;
    }
    
    // Reset decoder
    codeReader.current.reset();
    
    // Force a small delay before retry to ensure cleanup
    setTimeout(() => {
      startCamera();
    }, 500);
  }, [startCamera]);

  // Lifecycle logging
  useEffect(() => {
    if (open) {
      console.log("🚀 Scanner mounted with manual camera control");
    }
  }, [open]);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
      setManualCode("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleManualSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5" />
            Silent Observer Scanner - Canvas Mode (FIXED)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Browser & Device Info */}
          <div className="bg-muted/50 p-3 rounded-lg text-xs font-mono">
            <div className="grid grid-cols-1 gap-1">
              <div>🌐 {browserInfo}</div>
              <div className="text-muted-foreground whitespace-pre-line">{mediaDevices}</div>
            </div>
          </div>

          {/* Camera Feed */}
          <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-black">
            <video 
              key={videoKey}
              ref={videoRef} 
              className="h-full w-full object-cover"
              autoPlay
              muted 
              playsInline
              onLoadStart={handleVideoLoadStart}
              onLoadedMetadata={handleVideoLoadedMetadata}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onError={handleVideoError}
            />
            
            {/* Enhanced Debug Status Overlay */}
            <div className="absolute top-2 left-2 right-2 space-y-1 pointer-events-none">
              <div className="bg-black/80 text-white px-2 py-1 rounded text-xs font-mono">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${streamActive ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                  {debugStatus}
                </div>
                <div className="text-gray-300 text-xs mt-1">
                  {videoDimensions} | {streamTracks}
                </div>
                <div className="text-gray-400 text-xs">
                  {streamInfo} | {connectionQuality}
                </div>
              </div>
            </div>
            
            {/* Connection Quality Indicator */}
            <div className="absolute top-2 right-2 pointer-events-none">
              <div className={`px-2 py-1 rounded text-xs font-mono ${
                connectionQuality === 'Good' || connectionQuality === 'Active' ? 'bg-green-600/80 text-white' :
                connectionQuality === 'Buffering' ? 'bg-yellow-600/80 text-white' :
                connectionQuality === 'Poor' || connectionQuality === 'Failed' ? 'bg-red-600/80 text-white' :
                'bg-gray-600/80 text-white'
              }`}>
                <Wifi className="h-3 w-3 inline mr-1" />
                {connectionQuality}
              </div>
            </div>
            
            {/* Loading State */}
            {!streamActive && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <div className="text-sm">{debugStatus}</div>
                </div>
              </div>
            )}
            
            {/* Scan line overlay */}
            {streamActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[80%] h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse" />
              </div>
            )}
            
            {/* Scan guide box */}
            {streamActive && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 border-2 border-dashed border-white/50 rounded-lg" />
              </div>
            )}
            
            {/* Enhanced Error Overlay */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white p-4 text-center">
                <AlertCircle className="h-12 w-12 text-red-400 mb-3" />
                <p className="text-red-400 font-bold mb-2">Camera Failed</p>
                <p className="text-sm text-gray-300 mb-2">{cameraError}</p>
                <div className="text-xs text-gray-500 space-y-1 max-w-md">
                  <p>Debug Info:</p>
                  <p>• Status: {debugStatus}</p>
                  <p>• Dimensions: {videoDimensions}</p>
                  <p>• Stream: {streamInfo}</p>
                  <p>• Tracks: {streamTracks}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-white border-white/20"
                    onClick={retryCamera}
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Retry Camera
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-white border-white/20"
                    onClick={enumerateDevices}
                  >
                    Refresh Devices
                  </Button>
                </div>
              </div>
            )}
            
            {/* Toast notifications overlay */}
            <div className="absolute bottom-2 left-2 right-2 space-y-2 pointer-events-none">
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg shadow-lg animate-in slide-in-from-top-2 fade-in duration-200"
                >
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium truncate">
                    Added: {toast.productName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Manual Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Manual code</label>
            <div className="flex items-center gap-2">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter or paste barcode"
              />
              <Button type="button" onClick={handleManualSubmit}>
                Add
              </Button>
            </div>
          </div>

          {/* Debug Canvas - only shown when debug mode is enabled */}
          {showDebug && (
            <div className="relative">
              <canvas
                ref={debugCanvasRef}
                className="w-full border-2 border-red-500 rounded-lg"
                style={{ maxHeight: '200px' }}
              />
              <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                DEBUG VIEW - What the scanner sees
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Camera className="h-4 w-4" />
              <span>Silent Observer: Canvas-based Scanning (FIXED - Uses decodeFromImageUrl)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={showDebug ? "default" : "outline"}
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
              >
                <ScanBarcode className="h-3 w-3 mr-1" />
                {showDebug ? 'Debug ON' : 'Debug OFF'}
              </Button>
              <Button variant="outline" size="sm" onClick={retryCamera}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Retry
              </Button>
              <Button variant="default" size="sm" onClick={onClose}>
                <X className="h-4 w-4 mr-1" />
                Done
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
























