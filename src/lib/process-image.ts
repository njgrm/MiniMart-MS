/**
 * process-image.ts
 * 
 * Offline-first AI background removal and image processing utility.
 * Uses @imgly/background-removal-node for AI-powered background removal
 * and sharp for post-processing (trimming, WebP conversion).
 * 
 * NOTE: The first time this runs, @imgly/background-removal-node will
 * download the AI model (~100MB). This initial download may take a while
 * depending on your connection. Subsequent runs will use the cached model.
 * 
 * FALLBACK: If Sharp is unavailable (broken native bindings), falls back to
 * saving images as-is without processing.
 */

import { removeBackground, Config } from "@imgly/background-removal-node";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Dynamic import for Sharp to handle broken installations gracefully
let sharp: typeof import("sharp") | null = null;
let sharpLoadError: Error | null = null;

async function getSharp() {
  if (sharp) return sharp;
  if (sharpLoadError) return null;
  
  try {
    sharp = (await import("sharp")).default as any;
    console.log("[process-image] Sharp loaded successfully");
    return sharp;
  } catch (error) {
    sharpLoadError = error as Error;
    console.warn("[process-image] Sharp unavailable - using fallback mode:", error);
    return null;
  }
}

/**
 * Configuration for the background removal AI
 * Set debug: true to see progress in server console
 */
const bgRemovalConfig: Config = {
  debug: true, // Shows progress in console - disable in production if noisy
  output: {
    format: "image/png", // PNG preserves transparency
    quality: 1.0, // Maximum quality
  },
};

/**
 * Detect image type from magic bytes (file signature)
 */
function detectImageType(buffer: Buffer): string {
  // Check magic bytes
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return "jpg";
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return "png";
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return "gif";
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return "webp";
  }
  // Default to jpg
  return "jpg";
}

/**
 * Converts a Blob to a Buffer
 */
async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Converts a Buffer to a Blob with the specified MIME type
 * This is required because @imgly/background-removal-node needs
 * to know the image format via the Blob's type property
 */
function bufferToBlob(buffer: Buffer, mimeType: string): Blob {
  return new Blob([buffer], { type: mimeType });
}

/**
 * processAndSaveImage
 * 
 * Performs the following pipeline:
 * 1. Normalize image to PNG format using sharp (ensures compatibility)
 * 2. Remove background using AI (@imgly/background-removal-node)
 * 3. Trim transparent pixels using sharp to center the product
 * 4. Convert to WebP format for optimal file size
 * 5. Save to public/uploads directory
 * 
 * If AI background removal fails (e.g., memory limits, unsupported image),
 * falls back to just converting the original image to WebP.
 * 
 * If Sharp is unavailable (broken native bindings on Windows), saves original
 * file as-is with a generic extension.
 * 
 * @param fileBuffer - The raw image buffer from upload
 * @param fileName - The filename (without extension) to save as
 * @returns The public path to the processed image (e.g., /uploads/uuid.webp)
 */
export async function processAndSaveImage(
  fileBuffer: Buffer,
  fileName: string
): Promise<string> {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  // Ensure filename ends with .webp (or fallback to .jpg if Sharp unavailable)
  const baseFileName = fileName.replace(/\.[^/.]+$/, ""); // Remove any extension
  
  // Try to load Sharp
  const sharpInstance = await getSharp();
  
  // If Sharp is not available, save the file as-is
  if (!sharpInstance) {
    console.warn(`[process-image] Sharp unavailable, saving original file without processing`);
    // Determine file type from magic bytes
    const ext = detectImageType(fileBuffer);
    const finalFileName = `${baseFileName}.${ext}`;
    const outputPath = path.join(uploadsDir, finalFileName);
    await writeFile(outputPath, fileBuffer);
    console.log(`[process-image] Saved original file to: ${outputPath}`);
    return `/uploads/${finalFileName}`;
  }
  
  const finalFileName = `${baseFileName}.webp`;
  const outputPath = path.join(uploadsDir, finalFileName);

  try {
    console.log(`[process-image] Starting background removal for: ${fileName}`);
    console.log(`[process-image] Note: First run downloads AI model (~100MB)`);

    // Step 1: Normalize the image to PNG using sharp
    // This ensures a consistent format that the AI library can understand
    console.log(`[process-image] Converting input to PNG for AI processing...`);
    const pngBuffer = await sharpInstance(fileBuffer)
      .png()
      .toBuffer();

    // Step 2: Convert to Blob with proper MIME type
    // The @imgly library needs the MIME type to identify the format
    const imageBlob = bufferToBlob(pngBuffer, "image/png");
    console.log(`[process-image] Created Blob with type: ${imageBlob.type}, size: ${imageBlob.size} bytes`);

    // Step 3: Remove background using AI
    // Note: GLib-GObject warnings may appear in console during processing.
    // These are from the native ONNX runtime and can be safely ignored.
    console.log(`[process-image] Running AI background removal...`);
    
    // Temporarily suppress stderr for native library warnings (GLib-GObject)
    // These warnings don't affect functionality but clutter the console
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    let suppressedWarnings = 0;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stderr as any).write = (chunk: any, ...args: any[]) => {
      const str = chunk?.toString?.() || "";
      // Suppress GLib-GObject and ONNX warnings
      if (str.includes("GLib-GObject") || str.includes("g_type_class_add_private")) {
        suppressedWarnings++;
        return true; // Pretend we wrote it
      }
      return originalStderrWrite(chunk, ...args);
    };
    
    let bgRemovedBuffer: Buffer;
    try {
      const resultBlob = await removeBackground(imageBlob, bgRemovalConfig);
      
      // Convert the result Blob to Buffer
      bgRemovedBuffer = await blobToBuffer(resultBlob);
      console.log(`[process-image] Background removed successfully!${suppressedWarnings > 0 ? ` (${suppressedWarnings} native warnings suppressed)` : ""}`);
    } finally {
      // Always restore stderr even if bg removal fails
      process.stderr.write = originalStderrWrite;
    }

    // Step 4: Post-process with sharp
    // - trim(): Automatically crops transparent pixels
    // - webp(): Converts to WebP format with quality optimization
    const processedBuffer = await sharpInstance(bgRemovedBuffer)
      .trim() // Remove transparent pixels around the edges
      .webp({ 
        quality: 85, // Good balance between size and quality
        alphaQuality: 100, // Preserve transparency quality
      })
      .toBuffer();

    console.log(`[process-image] Image trimmed and converted to WebP`);

    // Step 5: Save the processed image
    await writeFile(outputPath, processedBuffer);

    console.log(`[process-image] ✓ Saved to: ${outputPath}`);

    return `/uploads/${finalFileName}`;
  } catch (error) {
    // Fallback: If AI processing fails, just convert to WebP without bg removal
    console.error(`[process-image] AI background removal failed:`, error);
    console.log(`[process-image] Falling back to basic WebP conversion`);

    try {
      const fallbackBuffer = await sharpInstance(fileBuffer)
        .webp({ quality: 85 })
        .toBuffer();

      await writeFile(outputPath, fallbackBuffer);

      console.log(`[process-image] Fallback save completed: ${outputPath}`);

      return `/uploads/${finalFileName}`;
    } catch (fallbackError) {
      console.error(`[process-image] Fallback also failed, saving original:`, fallbackError);
      // Last resort: save the original file
      const ext = detectImageType(fileBuffer);
      const rawFileName = `${baseFileName}.${ext}`;
      const rawPath = path.join(uploadsDir, rawFileName);
      await writeFile(rawPath, fileBuffer);
      return `/uploads/${rawFileName}`;
    }
  }
}

/**
 * processImageBuffer
 * 
 * Same as processAndSaveImage but returns the processed buffer instead of saving.
 * Useful if you need to do additional processing or use a different storage.
 * 
 * @param fileBuffer - The raw image buffer from upload
 * @returns Object containing the processed buffer and whether bg removal succeeded
 */
export async function processImageBuffer(fileBuffer: Buffer): Promise<{
  buffer: Buffer;
  backgroundRemoved: boolean;
}> {
  // Try to load Sharp
  const sharpInstance = await getSharp();
  
  // If Sharp is not available, return the original buffer
  if (!sharpInstance) {
    console.warn(`[process-image] Sharp unavailable, returning original buffer`);
    return { buffer: fileBuffer, backgroundRemoved: false };
  }
  
  try {
    console.log(`[process-image] Starting background removal...`);

    // Normalize to PNG first
    const pngBuffer = await sharpInstance(fileBuffer).png().toBuffer();
    const imageBlob = bufferToBlob(pngBuffer, "image/png");

    // Remove background using AI with warning suppression
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    let suppressedWarnings = 0;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stderr as any).write = (chunk: any, ...args: any[]) => {
      const str = chunk?.toString?.() || "";
      if (str.includes("GLib-GObject") || str.includes("g_type_class_add_private")) {
        suppressedWarnings++;
        return true;
      }
      return originalStderrWrite(chunk, ...args);
    };
    
    let bgRemovedBuffer: Buffer;
    try {
      const resultBlob = await removeBackground(imageBlob, bgRemovalConfig);
      bgRemovedBuffer = await blobToBuffer(resultBlob);
      if (suppressedWarnings > 0) {
        console.log(`[process-image] Background removed (${suppressedWarnings} native warnings suppressed)`);
      }
    } finally {
      process.stderr.write = originalStderrWrite;
    }

    // Post-process with sharp
    const processedBuffer = await sharpInstance(bgRemovedBuffer)
      .trim()
      .webp({ quality: 85, alphaQuality: 100 })
      .toBuffer();

    return { buffer: processedBuffer, backgroundRemoved: true };
  } catch (error) {
    console.error(`[process-image] AI background removal failed:`, error);

    try {
      // Fallback to basic conversion
      const fallbackBuffer = await sharpInstance(fileBuffer)
        .webp({ quality: 85 })
        .toBuffer();

      return { buffer: fallbackBuffer, backgroundRemoved: false };
    } catch (fallbackError) {
      // Last resort: return original buffer
      console.error(`[process-image] WebP conversion also failed:`, fallbackError);
      return { buffer: fileBuffer, backgroundRemoved: false };
    }
  }
}
