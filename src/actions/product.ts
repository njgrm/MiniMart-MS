"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/lib/validations/product";
import { Decimal } from "@prisma/client/runtime/library";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

/**
 * Get all products with inventory info
 * By default, excludes archived products unless includeArchived is true
 */
export async function getProducts(includeArchived: boolean = false) {
  const products = await prisma.product.findMany({
    where: includeArchived ? {} : { is_archived: false },
    include: {
      inventory: true,
    },
    orderBy: {
      product_name: "asc",
    },
  });

  return products.map((product) => ({
    product_id: product.product_id,
    product_name: product.product_name,
    category: product.category,
    retail_price: Number(product.retail_price),
    wholesale_price: Number(product.wholesale_price),
    cost_price: Number(product.cost_price),
    current_stock: product.inventory?.current_stock ?? 0,
    reorder_level: product.inventory?.reorder_level ?? 10,
    barcode: product.barcode,
    image_url: product.image_url,
    is_archived: product.is_archived,
    status: (
      (product.inventory?.current_stock ?? 0) <= (product.inventory?.reorder_level ?? 10)
        ? "LOW_STOCK"
        : "IN_STOCK"
    ) as "LOW_STOCK" | "IN_STOCK",
  }));
}

/**
 * Get a single product by ID
 */
export async function getProductById(productId: number) {
  const product = await prisma.product.findUnique({
    where: { product_id: productId },
    include: {
      inventory: true,
    },
  });

  if (!product) return null;

  return {
    product_id: product.product_id,
    product_name: product.product_name,
    category: product.category,
    retail_price: Number(product.retail_price),
    wholesale_price: Number(product.wholesale_price),
    current_stock: product.inventory?.current_stock ?? 0,
    reorder_level: product.inventory?.reorder_level ?? 10,
    barcode: product.barcode,
    image_url: product.image_url,
  };
}

/**
 * Create a new product with inventory
 * 
 * This creates the product, inventory record, AND an INITIAL_STOCK movement
 * to properly track the initial stock source in the audit trail.
 */
export async function createProduct(data: CreateProductInput): Promise<ActionResult> {
  const parsed = createProductSchema.safeParse(data);
  if (!parsed.success) {
    const message = parsed.error?.errors?.[0]?.message ?? "Invalid product data";
    return { success: false, error: message };
  }

  const { 
    product_name, 
    category, 
    retail_price, 
    wholesale_price,
    cost_price,
    initial_stock, 
    reorder_level,
    barcode,
    image_url,
    // Stock movement tracking fields
    supplier_name,
    reference,
    receipt_image_url,
  } = parsed.data;

  try {
    // Check if product name already exists
    const existingProduct = await prisma.product.findFirst({
      where: { product_name: { equals: product_name, mode: "insensitive" } },
    });

    if (existingProduct) {
      return { success: false, error: "A product with this name already exists" };
    }

    // Check if barcode already exists (if provided)
    if (barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode },
      });
      if (existingBarcode) {
        return { 
          success: false, 
          error: `This barcode is already assigned to "${existingBarcode.product_name}"` 
        };
      }
    }

    // Create product, inventory, and INITIAL_STOCK movement in a transaction
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          product_name,
          category,
          retail_price: new Decimal(retail_price),
          wholesale_price: new Decimal(wholesale_price),
          cost_price: new Decimal(cost_price),
          barcode: barcode || null,
          image_url: image_url || null,
        },
      });

      const newInventory = await tx.inventory.create({
        data: {
          product_id: newProduct.product_id,
          current_stock: initial_stock,
          reorder_level,
          last_restock: new Date(),
        },
      });

      // Create INITIAL_STOCK movement for audit trail (only if stock > 0)
      if (initial_stock > 0) {
        await tx.stockMovement.create({
          data: {
            inventory_id: newInventory.inventory_id,
            user_id: 1, // TODO: Get actual user from session
            movement_type: "INITIAL_STOCK",
            quantity_change: initial_stock,
            previous_stock: 0,
            new_stock: initial_stock,
            reason: "Initial stock when product was created",
            supplier_name: supplier_name || null,
            reference: reference || null,
            cost_price: cost_price ? new Decimal(cost_price) : null,
            receipt_image_url: receipt_image_url || null,
          },
        });
      }

      return newProduct;
    });

    revalidatePath("/admin/inventory");
    // Serialize data to avoid Decimal serialization issues
    return { 
      success: true, 
      data: { 
        product_id: product.product_id,
        product_name: product.product_name,
        category: product.category,
        retail_price: Number(product.retail_price),
        wholesale_price: Number(product.wholesale_price),
        barcode: product.barcode,
        image_url: product.image_url,
      } 
    };
  } catch (error) {
    console.error("Create product error:", error);
    return { success: false, error: "Failed to create product" };
  }
}

/**
 * Update an existing product
 */
export async function updateProduct(data: UpdateProductInput): Promise<ActionResult> {
  const parsed = updateProductSchema.safeParse(data);
  if (!parsed.success) {
    const message = parsed.error?.errors?.[0]?.message ?? "Invalid product data";
    return { success: false, error: message };
  }

  const {
    product_id,
    product_name,
    category,
    retail_price,
    wholesale_price,
    cost_price,
    current_stock,
    reorder_level,
    barcode,
    image_url,
  } = parsed.data;

  try {
    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { product_id },
    });

    if (!existingProduct) {
      return { success: false, error: "Product not found" };
    }

    // Check if new name conflicts with another product
    const nameConflict = await prisma.product.findFirst({
      where: {
        product_name: { equals: product_name, mode: "insensitive" },
        product_id: { not: product_id },
      },
    });

    if (nameConflict) {
      return { success: false, error: "A product with this name already exists" };
    }

    // Check if barcode conflicts with another product (if provided)
    if (barcode) {
      const barcodeConflict = await prisma.product.findFirst({
        where: {
          barcode,
          product_id: { not: product_id },
        },
      });
      if (barcodeConflict) {
        return { 
          success: false, 
          error: `This barcode is already assigned to "${barcodeConflict.product_name}"` 
        };
      }
    }

    // Update product and inventory in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { product_id },
        data: {
          product_name,
          category,
          retail_price: new Decimal(retail_price),
          wholesale_price: new Decimal(wholesale_price),
          cost_price: new Decimal(cost_price || 0),
          barcode: barcode || null,
          image_url: image_url || null,
        },
      });

      await tx.inventory.upsert({
        where: { product_id },
        update: {
          current_stock,
          reorder_level,
        },
        create: {
          product_id,
          current_stock,
          reorder_level,
          last_restock: new Date(),
        },
      });
    });

    revalidatePath("/admin/inventory");
    return { success: true };
  } catch (error) {
    console.error("Update product error:", error);
    return { success: false, error: "Failed to update product" };
  }
}

/**
 * Bulk delete multiple products (soft delete for products with history)
 */
export async function bulkDeleteProducts(productIds: number[]): Promise<ActionResult> {
  if (!productIds || productIds.length === 0) {
    return { success: false, error: "No products selected" };
  }

  try {
    // Separate products with history (to archive) from those without (to delete)
    const productsWithHistory = await prisma.product.findMany({
      where: {
        product_id: { in: productIds },
        OR: [
          { transactionItems: { some: {} } },
          { orderItems: { some: {} } },
        ],
      },
      select: { product_id: true },
    });

    const idsWithHistory = new Set(productsWithHistory.map((p) => p.product_id));
    const idsToArchive = productIds.filter((id) => idsWithHistory.has(id));
    const idsToDelete = productIds.filter((id) => !idsWithHistory.has(id));

    await prisma.$transaction(async (tx) => {
      // Archive products with sales history
      if (idsToArchive.length > 0) {
        await tx.product.updateMany({
          where: { product_id: { in: idsToArchive } },
          data: { is_archived: true },
        });
      }

      // Hard delete products without history
      if (idsToDelete.length > 0) {
        // First, get inventory IDs for these products
        const inventoryRecords = await tx.inventory.findMany({
          where: { product_id: { in: idsToDelete } },
          select: { inventory_id: true },
        });
        const inventoryIds = inventoryRecords.map((inv) => inv.inventory_id);

        // Delete stock movements first (references inventory)
        if (inventoryIds.length > 0) {
          await tx.stockMovement.deleteMany({
            where: { inventory_id: { in: inventoryIds } },
          });
        }

        // Delete inventory records
        await tx.inventory.deleteMany({
          where: { product_id: { in: idsToDelete } },
        });

        // Delete sales forecasts
        await tx.salesForecast.deleteMany({
          where: { product_id: { in: idsToDelete } },
        });

        // Delete products
        await tx.product.deleteMany({
          where: { product_id: { in: idsToDelete } },
        });
      }
    });

    revalidatePath("/admin/inventory");
    return { 
      success: true, 
      data: { 
        deletedCount: idsToDelete.length,
        archivedCount: idsToArchive.length,
      } 
    };
  } catch (error) {
    console.error("Bulk delete products error:", error);
    return { success: false, error: "Failed to delete products" };
  }
}

/**
 * Delete a product (soft delete if has sales history, hard delete otherwise)
 * Preserves referential integrity for historical sales data
 */
export async function deleteProduct(productId: number): Promise<ActionResult> {
  try {
    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { product_id: productId },
      include: {
        transactionItems: { take: 1 }, // Just check if any exist
        orderItems: { take: 1 },
      },
    });

    if (!existingProduct) {
      return { success: false, error: "Product not found" };
    }

    const hasHistory = existingProduct.transactionItems.length > 0 || existingProduct.orderItems.length > 0;

    if (hasHistory) {
      // SOFT DELETE: Archive the product to preserve sales history
      await prisma.product.update({
        where: { product_id: productId },
        data: { is_archived: true },
      });

      revalidatePath("/admin/inventory");
      return { 
        success: true, 
        data: { archived: true },
        error: undefined,
      };
    }

    // HARD DELETE: Product has no history, safe to delete completely
    await prisma.$transaction(async (tx) => {
      // Get inventory to find stock movements
      const inventory = await tx.inventory.findUnique({
        where: { product_id: productId },
      });

      // Delete stock movements first (if inventory exists)
      if (inventory) {
        await tx.stockMovement.deleteMany({
          where: { inventory_id: inventory.inventory_id },
        });
      }

      // Delete inventory
      await tx.inventory.deleteMany({
        where: { product_id: productId },
      });

      // Delete sales forecasts
      await tx.salesForecast.deleteMany({
        where: { product_id: productId },
      });

      // Delete product
      await tx.product.delete({
        where: { product_id: productId },
      });
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: { archived: false } };
  } catch (error) {
    console.error("Delete product error:", error);
    return { success: false, error: "Failed to delete product" };
  }
}

/**
 * Restore an archived product
 */
export async function restoreProduct(productId: number): Promise<ActionResult> {
  try {
    const product = await prisma.product.findUnique({
      where: { product_id: productId },
    });

    if (!product) {
      return { success: false, error: "Product not found" };
    }

    if (!product.is_archived) {
      return { success: false, error: "Product is not archived" };
    }

    await prisma.product.update({
      where: { product_id: productId },
      data: { is_archived: false },
    });

    revalidatePath("/admin/inventory");
    return { success: true };
  } catch (error) {
    console.error("Restore product error:", error);
    return { success: false, error: "Failed to restore product" };
  }
}
