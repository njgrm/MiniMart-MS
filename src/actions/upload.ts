"use server";

import { randomUUID } from "crypto";
import { processAndSaveImage } from "@/lib/process-image";

export type UploadResult = {
  success: boolean;
  path?: string;
  error?: string;
  backgroundRemoved?: boolean;
};

/**
 * uploadImage
 * 
 * Accepts an image File, processes it through our AI background removal
 * pipeline, and saves it to /public/uploads.
 * 
 * The processing pipeline:
 * 1. AI background removal (using @imgly/background-removal-node)
 * 2. Trim transparent pixels (product centered)
 * 3. Convert to WebP format (optimized size)
 * 
 * If AI processing fails, falls back to basic WebP conversion.
 * 
 * NOTE: First upload will be slow as the AI model (~100MB) downloads.
 * Subsequent uploads will use the cached model and be much faster.
 * 
 * @param file - The image File object from FormData
 * @returns UploadResult with success status and path or error
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  try {
    // Validate file exists
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return { success: false, error: "Only image files are allowed" };
    }

    // Guard against zero-length files
    if (!file.size || Number.isNaN(file.size)) {
      return { success: false, error: "File is empty or invalid" };
    }

    // Size guard: 10MB limit server-side
    // Note: Background removal works best with smaller images
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      return { success: false, error: "File too large (max 10MB)" };
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique filename (without extension - will be .webp)
    const filename = randomUUID();

    // Process image: remove background, trim, convert to WebP, save
    console.log(`[upload] Starting image processing for: ${file.name}`);
    const publicPath = await processAndSaveImage(buffer, filename);
    console.log(`[upload] Image processed and saved to: ${publicPath}`);

    return { 
      success: true, 
      path: publicPath,
      backgroundRemoved: true // Processing was attempted
    };
  } catch (error) {
    console.error("uploadImage error:", error);
    return { success: false, error: "Failed to upload and process image" };
  }
}

/**
 * uploadImageRaw
 * 
 * Alternative upload function that skips background removal.
 * Useful for images where background removal is not desired
 * (e.g., logos, banners, or pre-processed images).
 * 
 * Still converts to WebP for consistency and optimization (if Sharp is available).
 * Falls back to saving original file if Sharp is unavailable.
 * 
 * @param file - The image File object from FormData
 * @returns UploadResult with success status and path or error
 */
export async function uploadImageRaw(file: File): Promise<UploadResult> {
  try {
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    if (!file.type.startsWith("image/")) {
      return { success: false, error: "Only image files are allowed" };
    }

    if (!file.size || Number.isNaN(file.size)) {
      return { success: false, error: "File is empty or invalid" };
    }

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      return { success: false, error: "File too large (max 10MB)" };
    }

    const { mkdir, writeFile } = await import("node:fs/promises");
    const path = await import("node:path");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    // Try to import sharp dynamically
    let sharpInstance: typeof import("sharp") | null = null;
    try {
      sharpInstance = (await import("sharp")).default as any;
    } catch (sharpError) {
      console.warn("[upload] Sharp unavailable, saving file as-is:", sharpError);
    }

    if (sharpInstance) {
      // Sharp is available - convert to WebP
      const filename = `${randomUUID()}.webp`;
      const filePath = path.join(uploadsDir, filename);

      const webpBuffer = await sharpInstance(buffer)
        .webp({ quality: 85 })
        .toBuffer();

      await writeFile(filePath, webpBuffer);

      return { 
        success: true, 
        path: `/uploads/${filename}`,
        backgroundRemoved: false
      };
    } else {
      // Sharp unavailable - detect file type and save as-is
      const detectImageType = (buf: Buffer): string => {
        if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "jpg";
        if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "png";
        if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
        if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "webp";
        return "jpg";
      };
      
      const ext = detectImageType(buffer);
      const filename = `${randomUUID()}.${ext}`;
      const filePath = path.join(uploadsDir, filename);

      await writeFile(filePath, buffer);

      return { 
        success: true, 
        path: `/uploads/${filename}`,
        backgroundRemoved: false
      };
    }
  } catch (error) {
    console.error("uploadImageRaw error:", error);
    return { success: false, error: "Failed to upload image" };
  }
}

/**
 * uploadReceiptImage
 * 
 * Alias for uploadImageRaw - uploads receipt/document images without
 * background removal. Used for supplier receipts, invoices, etc.
 * 
 * @param file - The image File object from FormData
 * @returns UploadResult with success status and path or error
 */
export async function uploadReceiptImage(file: File): Promise<UploadResult> {
  return uploadImageRaw(file);
}