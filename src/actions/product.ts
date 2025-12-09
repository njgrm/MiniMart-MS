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
 */
export async function getProducts() {
  const products = await prisma.product.findMany({
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
    current_stock: product.inventory?.current_stock ?? 0,
    reorder_level: product.inventory?.reorder_level ?? 10,
    barcode: product.barcode,
    image_url: product.image_url,
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
    initial_stock, 
    reorder_level,
    barcode,
    image_url,
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

    // Create product and inventory in a transaction
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          product_name,
          category,
          retail_price: new Decimal(retail_price),
          wholesale_price: new Decimal(wholesale_price),
          barcode: barcode || null,
          image_url: image_url || null,
        },
      });

      await tx.inventory.create({
        data: {
          product_id: newProduct.product_id,
          current_stock: initial_stock,
          reorder_level,
          last_restock: new Date(),
        },
      });

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
 * Bulk delete multiple products
 */
export async function bulkDeleteProducts(productIds: number[]): Promise<ActionResult> {
  if (!productIds || productIds.length === 0) {
    return { success: false, error: "No products selected" };
  }

  try {
    // Check for products with transactions or orders
    const productsWithRelations = await prisma.product.findMany({
      where: {
        product_id: { in: productIds },
        OR: [
          { transactionItems: { some: {} } },
          { orderItems: { some: {} } },
        ],
      },
      select: { product_id: true, product_name: true },
    });

    if (productsWithRelations.length > 0) {
      const names = productsWithRelations.map((p) => p.product_name).join(", ");
      return {
        success: false,
        error: `Cannot delete products with existing transactions or orders: ${names}`,
      };
    }

    // Delete all selected products in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete inventory records
      await tx.inventory.deleteMany({
        where: { product_id: { in: productIds } },
      });

      // Delete sales forecasts
      await tx.salesForecast.deleteMany({
        where: { product_id: { in: productIds } },
      });

      // Delete products
      await tx.product.deleteMany({
        where: { product_id: { in: productIds } },
      });
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: { deletedCount: productIds.length } };
  } catch (error) {
    console.error("Bulk delete products error:", error);
    return { success: false, error: "Failed to delete products" };
  }
}

/**
 * Delete a product
 */
export async function deleteProduct(productId: number): Promise<ActionResult> {
  try {
    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { product_id: productId },
      include: {
        transactionItems: true,
        orderItems: true,
      },
    });

    if (!existingProduct) {
      return { success: false, error: "Product not found" };
    }

    // Prevent deletion if product has transactions or orders
    if (existingProduct.transactionItems.length > 0 || existingProduct.orderItems.length > 0) {
      return {
        success: false,
        error: "Cannot delete product with existing transactions or orders",
      };
    }

    // Delete product (inventory will be cascade deleted due to relation)
    await prisma.$transaction(async (tx) => {
      // Delete inventory first
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
    return { success: true };
  } catch (error) {
    console.error("Delete product error:", error);
    return { success: false, error: "Failed to delete product" };
  }
}
