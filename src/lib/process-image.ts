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
 */

import { removeBackground, Config } from "@imgly/background-removal-node";
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

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

  // Ensure filename ends with .webp
  const baseFileName = fileName.replace(/\.[^/.]+$/, ""); // Remove any extension
  const finalFileName = `${baseFileName}.webp`;
  const outputPath = path.join(uploadsDir, finalFileName);

  try {
    console.log(`[process-image] Starting background removal for: ${fileName}`);
    console.log(`[process-image] Note: First run downloads AI model (~100MB)`);

    // Step 1: Normalize the image to PNG using sharp
    // This ensures a consistent format that the AI library can understand
    console.log(`[process-image] Converting input to PNG for AI processing...`);
    const pngBuffer = await sharp(fileBuffer)
      .png()
      .toBuffer();

    // Step 2: Convert to Blob with proper MIME type
    // The @imgly library needs the MIME type to identify the format
    const imageBlob = bufferToBlob(pngBuffer, "image/png");
    console.log(`[process-image] Created Blob with type: ${imageBlob.type}, size: ${imageBlob.size} bytes`);

    // Step 3: Remove background using AI
    console.log(`[process-image] Running AI background removal...`);
    const resultBlob = await removeBackground(imageBlob, bgRemovalConfig);
    
    // Convert the result Blob to Buffer
    const bgRemovedBuffer = await blobToBuffer(resultBlob);
    console.log(`[process-image] Background removed successfully!`);

    // Step 4: Post-process with sharp
    // - trim(): Automatically crops transparent pixels
    // - webp(): Converts to WebP format with quality optimization
    const processedBuffer = await sharp(bgRemovedBuffer)
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
      const fallbackBuffer = await sharp(fileBuffer)
        .webp({ quality: 85 })
        .toBuffer();

      await writeFile(outputPath, fallbackBuffer);

      console.log(`[process-image] Fallback save completed: ${outputPath}`);

      return `/uploads/${finalFileName}`;
    } catch (fallbackError) {
      console.error(`[process-image] Fallback also failed:`, fallbackError);
      throw new Error("Failed to process image");
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
  try {
    console.log(`[process-image] Starting background removal...`);

    // Normalize to PNG first
    const pngBuffer = await sharp(fileBuffer).png().toBuffer();
    const imageBlob = bufferToBlob(pngBuffer, "image/png");

    // Remove background using AI
    const resultBlob = await removeBackground(imageBlob, bgRemovalConfig);
    const bgRemovedBuffer = await blobToBuffer(resultBlob);

    // Post-process with sharp
    const processedBuffer = await sharp(bgRemovedBuffer)
      .trim()
      .webp({ quality: 85, alphaQuality: 100 })
      .toBuffer();

    return { buffer: processedBuffer, backgroundRemoved: true };
  } catch (error) {
    console.error(`[process-image] AI background removal failed:`, error);

    // Fallback to basic conversion
    const fallbackBuffer = await sharp(fileBuffer)
      .webp({ quality: 85 })
      .toBuffer();

    return { buffer: fallbackBuffer, backgroundRemoved: false };
  }
}
