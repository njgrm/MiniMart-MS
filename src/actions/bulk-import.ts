"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/validations/product";
import { processAndSaveImage } from "@/lib/process-image";
import { randomUUID } from "crypto";

export interface BulkProductInput {
  name: string;
  category: string;
  retail_price: number;
  wholesale_price: number;
  cost_price?: number;
  stock: number;
  barcode?: string | null;
  image_url?: string | null;
  reorder_level?: number;
  supplier_name?: string | null;
  reference?: string | null;
  expiry_date?: Date | null;
}

export interface BulkImportResult {
  success: boolean;
  successCount: number;
  failedCount: number;
  imagesProcessed: number;
  failedRows: {
    row: number;
    name: string;
    reason: string;
  }[];
}

/**
 * Check if a string looks like a valid image URL
 */
function isImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  
  // Check if it's a URL (http/https)
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  
  // Check for common image extensions or known image hosting patterns
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
  const urlLower = url.toLowerCase();
  
  // Direct image URL check
  if (imageExtensions.some((ext) => urlLower.includes(ext))) return true;
  
  // Common image hosting services (might not have extensions in URL)
  const imageHosts = ["imgur.com", "cloudinary.com", "images.unsplash.com", "drive.google.com"];
  if (imageHosts.some((host) => urlLower.includes(host))) return true;
  
  return false;
}

/**
 * Fetch image from URL and return as Buffer
 * Returns null if fetch fails
 */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    console.log(`[bulk-import] Fetching image from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Christian-Minimart-Import/1.0",
      },
    });
    
    if (!response.ok) {
      console.warn(`[bulk-import] Failed to fetch image: HTTP ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get("content-type");
    if (!contentType?.startsWith("image/")) {
      console.warn(`[bulk-import] URL did not return an image: ${contentType}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`[bulk-import] Error fetching image:`, error);
    return null;
  }
}

/**
 * Bulk create products from CSV import
 * 
 * Features:
 * - Validates categories and barcodes
 * - Processes images from URLs with AI background removal
 * - Handles image processing errors gracefully (falls back to original URL)
 * - Processes images sequentially to prevent memory issues
 */
export async function bulkCreateProducts(
  products: BulkProductInput[],
  options: { processImages?: boolean } = { processImages: true }
): Promise<BulkImportResult> {
  const failedRows: BulkImportResult["failedRows"] = [];
  let successCount = 0;
  let imagesProcessed = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const rowNumber = i + 2; // +2 because row 1 is header, and arrays are 0-indexed

    try {
      // Validate category
      const categoryUpper = product.category.toUpperCase().replace(/\s+/g, "_");
      if (!PRODUCT_CATEGORIES.includes(categoryUpper as ProductCategory)) {
        failedRows.push({
          row: rowNumber,
          name: product.name,
          reason: `Invalid category: "${product.category}"`,
        });
        continue;
      }

      // Check if product name already exists
      const existingName = await prisma.product.findFirst({
        where: { product_name: { equals: product.name, mode: "insensitive" } },
      });

      if (existingName) {
        failedRows.push({
          row: rowNumber,
          name: product.name,
          reason: "Product name already exists",
        });
        continue;
      }

      // Check if barcode already exists (if provided)
      if (product.barcode) {
        const existingBarcode = await prisma.product.findUnique({
          where: { barcode: product.barcode },
        });

        if (existingBarcode) {
          failedRows.push({
            row: rowNumber,
            name: product.name,
            reason: `Barcode "${product.barcode}" already assigned to "${existingBarcode.product_name}"`,
          });
          continue;
        }
      }

      // Process image if URL is provided and looks valid
      let finalImageUrl = product.image_url || null;
      
      if (options.processImages && isImageUrl(product.image_url)) {
        console.log(`[bulk-import] Processing image for: ${product.name}`);
        
        try {
          // Fetch the image from URL
          const imageBuffer = await fetchImageBuffer(product.image_url!);
          
          if (imageBuffer) {
            // Generate unique filename
            const uniqueId = randomUUID();
            const safeProductName = product.name
              .replace(/[^a-zA-Z0-9]/g, "-")
              .toLowerCase()
              .substring(0, 30);
            const fileName = `${safeProductName}-${uniqueId}`;
            
            // Process image with AI background removal
            // This function handles fallback to basic conversion if AI fails
            finalImageUrl = await processAndSaveImage(imageBuffer, fileName);
            imagesProcessed++;
            
            console.log(`[bulk-import] ✓ Image processed: ${finalImageUrl}`);
          } else {
            // Keep original URL if fetch failed
            console.log(`[bulk-import] Using original URL (fetch failed): ${product.image_url}`);
          }
        } catch (imageError) {
          // Log error but don't fail the import - use original URL
          console.error(`[bulk-import] Image processing error for "${product.name}":`, imageError);
          console.log(`[bulk-import] Falling back to original URL: ${product.image_url}`);
          // finalImageUrl remains as original product.image_url
        }
      }

      // Create product and inventory in a transaction
      await prisma.$transaction(async (tx) => {
        const newProduct = await tx.product.create({
          data: {
            product_name: product.name,
            category: categoryUpper,
            retail_price: new Decimal(product.retail_price),
            wholesale_price: new Decimal(product.wholesale_price),
            cost_price: new Decimal(product.cost_price ?? 0),
            barcode: product.barcode || null,
            image_url: finalImageUrl,
            nearest_expiry_date: product.expiry_date || null,
          },
        });

        const newInventory = await tx.inventory.create({
          data: {
            product_id: newProduct.product_id,
            current_stock: product.stock,
            reorder_level: product.reorder_level ?? 10,
            last_restock: new Date(),
          },
        });

        // Create INITIAL_STOCK movement for audit trail (only if stock > 0)
        if (product.stock > 0) {
          await tx.stockMovement.create({
            data: {
              inventory_id: newInventory.inventory_id,
              user_id: 1, // TODO: Get actual user from session
              movement_type: "INITIAL_STOCK",
              quantity_change: product.stock,
              previous_stock: 0,
              new_stock: product.stock,
              reason: "Initial stock from CSV import",
              supplier_name: product.supplier_name || null,
              reference: product.reference || null,
              cost_price: product.cost_price ? new Decimal(product.cost_price) : null,
            },
          });
        }
      });

      successCount++;
    } catch (error) {
      console.error(`Error importing row ${rowNumber}:`, error);
      failedRows.push({
        row: rowNumber,
        name: product.name,
        reason: "Database error occurred",
      });
    }
  }

  revalidatePath("/admin/inventory");

  return {
    success: successCount > 0,
    successCount,
    failedCount: failedRows.length,
    imagesProcessed,
    failedRows,
  };
}
