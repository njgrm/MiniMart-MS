"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export type UploadResult = {
  success: boolean;
  path?: string;
  error?: string;
};

/**
 * uploadImage
 * Saves an image File to /public/uploads and returns the public path.
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  try {
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    if (!file.type.startsWith("image/")) {
      return { success: false, error: "Only image files are allowed" };
    }

    // Basic size guard: 10MB limit server-side
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      return { success: false, error: "File too large (max 10MB)" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const filename = `${randomUUID()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    await writeFile(filePath, buffer);

    return { success: true, path: `/uploads/${filename}` };
  } catch (error) {
    console.error("uploadImage error:", error);
    return { success: false, error: "Failed to upload image" };
  }
}

