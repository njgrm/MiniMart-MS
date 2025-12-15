"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/validations/product";

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
}

export interface BulkImportResult {
  success: boolean;
  successCount: number;
  failedCount: number;
  failedRows: {
    row: number;
    name: string;
    reason: string;
  }[];
}

/**
 * Bulk create products from CSV import
 */
export async function bulkCreateProducts(
  products: BulkProductInput[]
): Promise<BulkImportResult> {
  const failedRows: BulkImportResult["failedRows"] = [];
  let successCount = 0;

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
            image_url: product.image_url || null,
          },
        });

        await tx.inventory.create({
          data: {
            product_id: newProduct.product_id,
            current_stock: product.stock,
            reorder_level: product.reorder_level ?? 10,
            last_restock: new Date(),
          },
        });
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
    failedRows,
  };
}

