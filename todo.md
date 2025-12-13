# CameraScanner Debug Mode Implementation

## Objective
Add debug functionality to visualize what the scanner is analyzing and improve barcode detection by increasing image quality.

## Steps
- [ ] Increase scan quality from JPEG 0.5 to PNG (lossless) for better barcode detection
- [ ] Add debug mode state and refs
- [ ] Implement visual debug canvas that mirrors the captured frame
- [ ] Add debug toggle button to UI
- [ ] Render debug canvas when enabled
- [ ] Test the improved detection

## Technical Details
- Change `canvas.toDataURL('image/jpeg', 0.5)` to `canvas.toDataURL('image/png')`
- Add `showDebug` state and `debugCanvasRef` for debug visualization
- Mirror captured canvas to visible debug canvas for real-time analysis
- Add toggle button in footer to enable/disable debug mode
