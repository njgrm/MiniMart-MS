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
import { logActivity, logProductCreate, logProductUpdate, logProductDelete } from "@/lib/logger";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

/**
 * Get all products with inventory info AND velocity-based stock status
 * By default, excludes archived products unless includeArchived is true
 * 
 * STOCK LOGIC:
 * - current_stock: Physical stock on shelf
 * - allocated_stock: Stock reserved by PENDING/PREPARING orders
 * - available_stock: current_stock - allocated_stock (what can actually be sold)
 * 
 * VELOCITY-BASED STATUS (uses DailySalesAggregate - SAME SOURCE as Analytics Dashboard):
 * - Uses 30-day lookback from DailySalesAggregate for velocity calculation
 * - days_of_stock = current_stock / daily_velocity
 * - OUT_OF_STOCK: stock === 0
 * - CRITICAL: ≤2 days of supply
 * - LOW: 2-7 days of supply  
 * - HEALTHY: >7 days of supply
 * - DEAD_STOCK: velocity < 0.1 (not selling)
 * 
 * SOFT DELETE LOGIC:
 * - Uses deletedAt: null filter by default (new approach)
 * - is_archived kept for backward compatibility
 */
export async function getProducts(includeArchived: boolean = false) {
  // Use same date range as Analytics forecasting (30-day lookback)
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // Yesterday (latest complete day)
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 30); // 30 days back

  // Fetch products and DailySalesAggregate in parallel (SAME SOURCE as Analytics!)
  const [products, allAggregates] = await Promise.all([
    prisma.product.findMany({
      where: includeArchived ? {} : { deletedAt: null },
      include: {
        inventory: true,
      },
      orderBy: {
        product_name: "asc",
      },
    }),
    // Use DailySalesAggregate - same as Analytics forecasting
    prisma.dailySalesAggregate.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  // Group aggregates by product_id for O(1) lookup
  const aggregatesByProduct = new Map<number, typeof allAggregates>();
  for (const agg of allAggregates) {
    const existing = aggregatesByProduct.get(agg.product_id) ?? [];
    existing.push(agg);
    aggregatesByProduct.set(agg.product_id, existing);
  }

  return products.map((product) => {
    const currentStock = product.inventory?.current_stock ?? 0;
    const allocatedStock = product.inventory?.allocated_stock ?? 0;
    const availableStock = Math.max(0, currentStock - allocatedStock);
    const reorderLevel = product.inventory?.reorder_level ?? 10;
    
    // Calculate velocity from DailySalesAggregate (MATCHES Analytics exactly)
    const salesHistory = aggregatesByProduct.get(product.product_id) ?? [];
    const totalSales = salesHistory.reduce((sum, day) => sum + day.quantity_sold, 0);
    const actualDays = 30; // Use full 30-day period for average
    const dailyVelocity = totalSales / actualDays;
    
    // Calculate days of stock (coverage) - USE Math.floor() TO MATCH ANALYTICS!
    // This is CRITICAL: Analytics uses floor(), so 2.8 days = 2 days = CRITICAL
    const rawDaysOfStock = dailyVelocity > 0.1 
      ? currentStock / dailyVelocity 
      : (currentStock > 0 ? 999 : 0);
    const daysOfStock = dailyVelocity > 0.1 ? Math.floor(rawDaysOfStock) : rawDaysOfStock;
    
    // Determine velocity-based status (EXACTLY matches Analytics calculateStockStatus)
    let velocityStatus: "OUT_OF_STOCK" | "CRITICAL" | "LOW" | "HEALTHY" | "DEAD_STOCK";
    if (currentStock === 0) {
      velocityStatus = "OUT_OF_STOCK";
    } else if (dailyVelocity < 0.1) {
      velocityStatus = "DEAD_STOCK"; // Not selling
    } else if (daysOfStock <= 2) {
      velocityStatus = "CRITICAL";
    } else if (daysOfStock <= 7) {
      velocityStatus = "LOW";
    } else {
      velocityStatus = "HEALTHY";
    }
    
    // Legacy status for backward compatibility
    const legacyStatus = currentStock === 0 
      ? "OUT_OF_STOCK" 
      : currentStock <= reorderLevel 
        ? "LOW_STOCK" 
        : "IN_STOCK";
    
    return {
      product_id: product.product_id,
      product_name: product.product_name,
      category: product.category,
      retail_price: Number(product.retail_price),
      wholesale_price: Number(product.wholesale_price),
      cost_price: Number(product.cost_price),
      current_stock: currentStock,
      allocated_stock: allocatedStock,
      available_stock: availableStock,
      reorder_level: reorderLevel,
      auto_reorder: product.inventory?.auto_reorder ?? true,
      lead_time_days: product.inventory?.lead_time_days ?? 7,
      barcode: product.barcode,
      image_url: product.image_url,
      is_archived: product.is_archived,
      deletedAt: product.deletedAt,
      nearest_expiry_date: product.nearest_expiry_date,
      // Velocity-based fields (SAME as Analytics Dashboard)
      daily_velocity: Math.round(dailyVelocity * 10) / 10, // Round to 1 decimal
      days_of_stock: daysOfStock,
      velocity_status: velocityStatus,
      // Legacy status for backward compatibility
      status: legacyStatus as "LOW_STOCK" | "IN_STOCK" | "OUT_OF_STOCK",
    };
  });
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
    const message = parsed.error?.issues?.[0]?.message ?? "Invalid product data";
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
    expiry_date,
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
          image_url: typeof image_url === 'string' ? image_url : null,
          nearest_expiry_date: expiry_date || null,
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
    
    // Audit log: Product created (using centralized logger)
    await logProductCreate(
      "Admin", // TODO: Get from session
      product.product_id,
      product.product_name,
      `Created product "${product.product_name}" in category "${category}" with initial stock of ${initial_stock} units.${barcode ? ` Barcode: ${barcode}.` : ""}`,
      {
        category,
        retail_price,
        wholesale_price,
        cost_price,
        initial_stock,
        barcode: barcode || null,
        expiry_date: expiry_date?.toISOString() || null,
      }
    );
    
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
    const message = parsed.error?.issues?.[0]?.message ?? "Invalid product data";
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
    // Check if product exists - also get inventory for audit trail
    const existingProduct = await prisma.product.findUnique({
      where: { product_id },
      include: { inventory: true },
    });

    if (!existingProduct) {
      return { success: false, error: "Product not found" };
    }

    // Capture old values for audit diff
    const oldData = {
      product_name: existingProduct.product_name,
      category: existingProduct.category,
      retail_price: Number(existingProduct.retail_price),
      wholesale_price: Number(existingProduct.wholesale_price),
      cost_price: Number(existingProduct.cost_price),
      current_stock: existingProduct.inventory?.current_stock ?? 0,
      reorder_level: existingProduct.inventory?.reorder_level ?? 10,
      barcode: existingProduct.barcode || null,
      image_url: existingProduct.image_url || null,
    };

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
          image_url: typeof image_url === 'string' ? image_url : null,
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
    
    // Audit log: Product updated (using centralized logger with diff)
    const newData = {
      product_name,
      category,
      retail_price,
      wholesale_price,
      cost_price: cost_price || 0,
      current_stock,
      reorder_level,
      barcode: barcode || null,
      image_url: (typeof image_url === 'string' ? image_url : null) || null,
    };
    
    await logProductUpdate(
      "Admin", // TODO: Get from session
      product_id,
      product_name,
      oldData,
      newData
    );
    
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
    
    // Audit log: Bulk delete/archive (using centralized logger)
    if (idsToArchive.length > 0 || idsToDelete.length > 0) {
      await logActivity({
        username: "Admin", // TODO: Get from session
        action: idsToArchive.length > 0 ? "ARCHIVE" : "DELETE",
        entity: "Product",
        entityName: `${productIds.length} products`,
        details: `Bulk operation: ${idsToDelete.length} products permanently deleted, ${idsToArchive.length} products archived (had sales history).`,
        metadata: {
          deleted_ids: idsToDelete,
          archived_ids: idsToArchive,
          total_affected: productIds.length,
        },
      });
    }
    
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

// Archive suffix format: __ARCHIVED_<timestamp>
const ARCHIVE_SUFFIX_REGEX = /__ARCHIVED_\d+$/;

/**
 * Generate archive suffix with current timestamp
 */
function getArchiveSuffix(): string {
  return `__ARCHIVED_${Date.now()}`;
}

/**
 * Strip archive suffix from a value
 */
function stripArchiveSuffix(value: string | null): string | null {
  if (!value) return null;
  return value.replace(ARCHIVE_SUFFIX_REGEX, "");
}

/**
 * Delete a product (ALWAYS soft delete with Ghost SKU fix)
 * 
 * NEW BEHAVIOR:
 * - Always performs soft delete (sets deletedAt timestamp)
 * - Appends archive suffix to unique fields (barcode, product_name)
 * - This allows the same SKU/barcode to be reused immediately
 * 
 * @deprecated Use archiveProduct from '@/actions/archive' instead
 */
export async function deleteProduct(productId: number): Promise<ActionResult> {
  try {
    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { product_id: productId },
    });

    if (!existingProduct) {
      return { success: false, error: "Product not found" };
    }

    if (existingProduct.deletedAt) {
      return { success: false, error: "Product is already archived" };
    }

    // SOFT DELETE with Ghost SKU fix
    const archiveSuffix = getArchiveSuffix();
    
    await prisma.product.update({
      where: { product_id: productId },
      data: {
        deletedAt: new Date(),
        status: "ARCHIVED",
        is_archived: true,
        // Ghost SKU fix: rename unique fields to free them up
        barcode: existingProduct.barcode ? `${existingProduct.barcode}${archiveSuffix}` : null,
        product_name: `${existingProduct.product_name}${archiveSuffix}`,
      },
    });

    revalidatePath("/admin/inventory");
    
    // Audit log: Product archived
    await logActivity({
      username: "Admin", // TODO: Get from session
      action: "ARCHIVE",
      module: "CATALOG",
      entity: "Product",
      entityId: productId,
      entityName: existingProduct.product_name,
      details: `Archived product "${existingProduct.product_name}". Barcode and name suffixed for reuse.`,
      metadata: {
        original_barcode: existingProduct.barcode,
        original_name: existingProduct.product_name,
        archived_at: new Date().toISOString(),
      },
    });
    
    return { 
      success: true, 
      data: { archived: true },
    };
  } catch (error) {
    console.error("Delete product error:", error);
    return { success: false, error: "Failed to archive product" };
  }
}

/**
 * Restore an archived product
 * 
 * NEW BEHAVIOR:
 * - Strips archive suffix from unique fields
 * - Validates that original values are available
 * - Throws error if original SKU/barcode is taken
 */
export async function restoreProduct(productId: number): Promise<ActionResult> {
  try {
    const product = await prisma.product.findUnique({
      where: { product_id: productId },
    });

    if (!product) {
      return { success: false, error: "Product not found" };
    }

    if (!product.deletedAt && !product.is_archived) {
      return { success: false, error: "Product is not archived" };
    }

    // Strip archive suffix to get original values
    const originalBarcode = stripArchiveSuffix(product.barcode);
    const originalName = stripArchiveSuffix(product.product_name);

    // Check if original barcode is now taken by another product
    if (originalBarcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode: originalBarcode },
      });
      
      if (existingBarcode && existingBarcode.product_id !== productId) {
        return {
          success: false,
          error: `Cannot restore: Barcode "${originalBarcode}" is now assigned to "${existingBarcode.product_name}". Please rename the conflicting product first.`,
        };
      }
    }

    // Check if original name is now taken
    const existingName = await prisma.product.findFirst({
      where: {
        product_name: { equals: originalName!, mode: "insensitive" },
        product_id: { not: productId },
      },
    });

    if (existingName) {
      return {
        success: false,
        error: `Cannot restore: Product name "${originalName}" is now in use by another product. Please rename the conflicting product first.`,
      };
    }

    // Restore the product
    await prisma.product.update({
      where: { product_id: productId },
      data: {
        deletedAt: null,
        status: "ACTIVE",
        is_archived: false,
        barcode: originalBarcode,
        product_name: originalName!,
      },
    });

    revalidatePath("/admin/inventory");
    
    // Audit log: Product restored
    await logActivity({
      username: "Admin", // TODO: Get from session
      action: "RESTORE",
      module: "CATALOG",
      entity: "Product",
      entityId: productId,
      entityName: originalName!,
      details: `Restored product "${originalName}" from archive.`,
      metadata: {
        restored_at: new Date().toISOString(),
        restored_barcode: originalBarcode,
        restored_name: originalName,
      },
    });
    
    return { success: true };
  } catch (error) {
    console.error("Restore product error:", error);
    return { success: false, error: "Failed to restore product" };
  }
}
