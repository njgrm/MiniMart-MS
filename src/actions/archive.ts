"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/logger";

// =============================================================================
// Types
// =============================================================================

export type ActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

// Archive suffix format: __ARCHIVED_<timestamp>
const ARCHIVE_SUFFIX_REGEX = /__ARCHIVED_\d+$/;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate archive suffix with current timestamp
 * Format: __ARCHIVED_1736521200000
 */
function getArchiveSuffix(): string {
  return `__ARCHIVED_${Date.now()}`;
}

/**
 * Append archive suffix to a unique field value
 * Example: "COKE-ZERO" -> "COKE-ZERO__ARCHIVED_1736521200000"
 */
function appendArchiveSuffix(value: string | null): string | null {
  if (!value) return null;
  return `${value}${getArchiveSuffix()}`;
}

/**
 * Strip archive suffix from a unique field value
 * Example: "COKE-ZERO__ARCHIVED_1736521200000" -> "COKE-ZERO"
 */
function stripArchiveSuffix(value: string | null): string | null {
  if (!value) return null;
  return value.replace(ARCHIVE_SUFFIX_REGEX, "");
}

/**
 * Check if a value has an archive suffix
 */
function hasArchiveSuffix(value: string | null): boolean {
  if (!value) return false;
  return ARCHIVE_SUFFIX_REGEX.test(value);
}

// =============================================================================
// PRODUCT Archive/Restore Actions
// =============================================================================

/**
 * Archive a product (soft delete)
 * 
 * - Sets deletedAt timestamp
 * - Sets status to ARCHIVED
 * - Appends archive suffix to unique fields (barcode, product_name)
 * - Creates audit log entry
 */
export async function archiveProduct(productId: number): Promise<ActionResult> {
  try {
    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { product_id: productId },
      include: {
        inventory: true,
      },
    });

    if (!product) {
      return { success: false, error: "Product not found" };
    }

    if (product.deletedAt) {
      return { success: false, error: "Product is already archived" };
    }

    // Archive the product with Ghost SKU fix
    const archiveSuffix = getArchiveSuffix();
    
    await prisma.product.update({
      where: { product_id: productId },
      data: {
        deletedAt: new Date(),
        status: "ARCHIVED",
        is_archived: true, // Keep for backward compatibility
        // Ghost SKU fix: rename unique fields
        barcode: product.barcode ? `${product.barcode}${archiveSuffix}` : null,
        product_name: `${product.product_name}${archiveSuffix}`,
      },
    });

    // Audit log - include product snapshot for audit trail
    await logActivity({
      username: "Admin", // TODO: Get from session
      action: "ARCHIVE",
      module: "CATALOG",
      entity: "Product",
      entityId: productId,
      entityName: product.product_name,
      details: `Archived product "${product.product_name}". Barcode and name suffixed for reuse.`,
      metadata: {
        // Snapshot of product at time of archiving
        sku: product.barcode,
        barcode: product.barcode,
        retail_price: product.retail_price ? Number(product.retail_price) : null,
        wholesale_price: product.wholesale_price ? Number(product.wholesale_price) : null,
        cost_price: product.cost_price ? Number(product.cost_price) : null,
        category: product.category,
        current_stock: product.inventory?.current_stock ?? 0,
        archived_at: new Date().toISOString(),
      },
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: { archived: true } };
  } catch (error) {
    console.error("Archive product error:", error);
    return { success: false, error: "Failed to archive product" };
  }
}

/**
 * Restore an archived product
 * 
 * - Clears deletedAt timestamp
 * - Sets status to ACTIVE
 * - Strips archive suffix from unique fields
 * - Validates that original unique values are available
 */
export async function restoreProduct(productId: number): Promise<ActionResult> {
  try {
    const product = await prisma.product.findUnique({
      where: { product_id: productId },
      include: {
        inventory: true,
      },
    });

    if (!product) {
      return { success: false, error: "Product not found" };
    }

    if (!product.deletedAt) {
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

    // Audit log - include product snapshot for audit trail
    await logActivity({
      username: "Admin", // TODO: Get from session
      action: "RESTORE",
      module: "CATALOG",
      entity: "Product",
      entityId: productId,
      entityName: originalName!,
      details: `Restored product "${originalName}" from archive.`,
      metadata: {
        // Snapshot of product at time of restoration
        sku: originalBarcode,
        barcode: originalBarcode,
        retail_price: product.retail_price ? Number(product.retail_price) : null,
        wholesale_price: product.wholesale_price ? Number(product.wholesale_price) : null,
        cost_price: product.cost_price ? Number(product.cost_price) : null,
        category: product.category,
        current_stock: product.inventory?.current_stock ?? 0,
        restored_at: new Date().toISOString(),
      },
    });

    revalidatePath("/admin/inventory");
    return { success: true };
  } catch (error) {
    console.error("Restore product error:", error);
    return { success: false, error: "Failed to restore product" };
  }
}

// =============================================================================
// USER Archive/Restore Actions
// =============================================================================

/**
 * Archive a user (soft delete)
 * 
 * - Sets deletedAt timestamp
 * - Sets status to ARCHIVED
 * - Appends archive suffix to username
 */
export async function archiveUser(userId: number): Promise<ActionResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (user.deletedAt) {
      return { success: false, error: "User is already archived" };
    }

    // Prevent archiving the last admin
    if (user.role === "ADMIN") {
      const activeAdminCount = await prisma.user.count({
        where: {
          role: "ADMIN",
          deletedAt: null,
        },
      });

      if (activeAdminCount <= 1) {
        return { success: false, error: "Cannot archive the last admin user" };
      }
    }

    const archiveSuffix = getArchiveSuffix();

    await prisma.user.update({
      where: { user_id: userId },
      data: {
        deletedAt: new Date(),
        status: "ARCHIVED",
        username: `${user.username}${archiveSuffix}`,
      },
    });

    await logActivity({
      username: "Admin",
      action: "ARCHIVE",
      module: "AUTH",
      entity: "User",
      entityId: userId,
      entityName: user.username,
      details: `Archived user "${user.username}" (Role: ${user.role}).`,
      metadata: {
        original_username: user.username,
        role: user.role,
        archived_at: new Date().toISOString(),
      },
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Archive user error:", error);
    return { success: false, error: "Failed to archive user" };
  }
}

/**
 * Restore an archived user
 */
export async function restoreUser(userId: number): Promise<ActionResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (!user.deletedAt) {
      return { success: false, error: "User is not archived" };
    }

    const originalUsername = stripArchiveSuffix(user.username);

    // Check if username is now taken
    const existingUser = await prisma.user.findUnique({
      where: { username: originalUsername! },
    });

    if (existingUser && existingUser.user_id !== userId) {
      return {
        success: false,
        error: `Cannot restore: Username "${originalUsername}" is now in use. Please rename the conflicting user first.`,
      };
    }

    await prisma.user.update({
      where: { user_id: userId },
      data: {
        deletedAt: null,
        status: "ACTIVE",
        username: originalUsername!,
      },
    });

    await logActivity({
      username: "Admin",
      action: "RESTORE",
      module: "AUTH",
      entity: "User",
      entityId: userId,
      entityName: originalUsername!,
      details: `Restored user "${originalUsername}" from archive.`,
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Restore user error:", error);
    return { success: false, error: "Failed to restore user" };
  }
}

// =============================================================================
// CUSTOMER (Vendor) Archive/Restore Actions
// =============================================================================

/**
 * Archive a customer/vendor (soft delete)
 */
export async function archiveCustomer(customerId: number): Promise<ActionResult> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { customer_id: customerId },
    });

    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    if (customer.deletedAt) {
      return { success: false, error: "Customer is already archived" };
    }

    const archiveSuffix = getArchiveSuffix();

    await prisma.customer.update({
      where: { customer_id: customerId },
      data: {
        deletedAt: new Date(),
        status: "ARCHIVED",
        // Ghost SKU fix for email
        email: customer.email ? `${customer.email}${archiveSuffix}` : null,
        name: `${customer.name}${archiveSuffix}`,
      },
    });

    await logActivity({
      username: "Admin",
      action: "ARCHIVE",
      module: "AUTH",
      entity: "Customer",
      entityId: customerId,
      entityName: customer.name,
      details: `Archived ${customer.is_vendor ? "vendor" : "customer"} "${customer.name}".`,
      metadata: {
        original_name: customer.name,
        original_email: customer.email,
        is_vendor: customer.is_vendor,
        archived_at: new Date().toISOString(),
      },
    });

    revalidatePath("/admin/customers");
    revalidatePath("/admin/vendors");
    return { success: true };
  } catch (error) {
    console.error("Archive customer error:", error);
    return { success: false, error: "Failed to archive customer" };
  }
}

/**
 * Restore an archived customer/vendor
 */
export async function restoreCustomer(customerId: number): Promise<ActionResult> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { customer_id: customerId },
    });

    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    if (!customer.deletedAt) {
      return { success: false, error: "Customer is not archived" };
    }

    const originalEmail = stripArchiveSuffix(customer.email);
    const originalName = stripArchiveSuffix(customer.name);

    // Check if email is now taken
    if (originalEmail) {
      const existingEmail = await prisma.customer.findUnique({
        where: { email: originalEmail },
      });

      if (existingEmail && existingEmail.customer_id !== customerId) {
        return {
          success: false,
          error: `Cannot restore: Email "${originalEmail}" is now in use. Please update the conflicting customer first.`,
        };
      }
    }

    await prisma.customer.update({
      where: { customer_id: customerId },
      data: {
        deletedAt: null,
        status: "ACTIVE",
        email: originalEmail,
        name: originalName!,
      },
    });

    await logActivity({
      username: "Admin",
      action: "RESTORE",
      module: "AUTH",
      entity: "Customer",
      entityId: customerId,
      entityName: originalName!,
      details: `Restored ${customer.is_vendor ? "vendor" : "customer"} "${originalName}" from archive.`,
    });

    revalidatePath("/admin/customers");
    revalidatePath("/admin/vendors");
    return { success: true };
  } catch (error) {
    console.error("Restore customer error:", error);
    return { success: false, error: "Failed to restore customer" };
  }
}

// =============================================================================
// INVENTORY BATCH Archive/Restore Actions
// =============================================================================

/**
 * Archive an inventory batch (soft delete)
 * 
 * CRITICAL: Only batches with quantity = 0 can be archived
 * Batches with remaining stock must be disposed/adjusted first
 */
export async function archiveInventoryBatch(batchId: number): Promise<ActionResult> {
  try {
    const batch = await prisma.inventoryBatch.findUnique({
      where: { id: batchId },
      include: {
        product: {
          select: {
            product_name: true,
          },
        },
      },
    });

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    if (batch.deletedAt) {
      return { success: false, error: "Batch is already archived" };
    }

    // CRITICAL: Block archiving batches with remaining stock
    if (batch.quantity > 0) {
      return {
        success: false,
        error: `Cannot archive a batch with remaining stock (${batch.quantity} units). Please dispose of stock or adjust quantity to 0 first using Stock Adjustment.`,
      };
    }

    await prisma.inventoryBatch.update({
      where: { id: batchId },
      data: {
        deletedAt: new Date(),
        status: "ARCHIVED",
      },
    });

    await logActivity({
      username: "Admin",
      action: "ARCHIVE",
      module: "INVENTORY",
      entity: "InventoryBatch",
      entityId: batchId,
      entityName: `Batch #${batchId} (${batch.product.product_name})`,
      details: `Archived empty inventory batch #${batchId} for "${batch.product.product_name}".`,
      metadata: {
        product_id: batch.product_id,
        product_name: batch.product.product_name,
        expiry_date: batch.expiry_date?.toISOString(),
        supplier_name: batch.supplier_name,
        archived_at: new Date().toISOString(),
      },
    });

    revalidatePath("/admin/inventory");
    return { success: true };
  } catch (error) {
    console.error("Archive inventory batch error:", error);
    return { success: false, error: "Failed to archive batch" };
  }
}

/**
 * Restore an archived inventory batch
 */
export async function restoreInventoryBatch(batchId: number): Promise<ActionResult> {
  try {
    const batch = await prisma.inventoryBatch.findUnique({
      where: { id: batchId },
      include: {
        product: {
          select: {
            product_name: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    if (!batch.deletedAt) {
      return { success: false, error: "Batch is not archived" };
    }

    // Check if the parent product is also archived
    if (batch.product.deletedAt) {
      return {
        success: false,
        error: `Cannot restore batch: The parent product "${batch.product.product_name}" is archived. Please restore the product first.`,
      };
    }

    await prisma.inventoryBatch.update({
      where: { id: batchId },
      data: {
        deletedAt: null,
        status: "ACTIVE",
      },
    });

    await logActivity({
      username: "Admin",
      action: "RESTORE",
      module: "INVENTORY",
      entity: "InventoryBatch",
      entityId: batchId,
      entityName: `Batch #${batchId} (${batch.product.product_name})`,
      details: `Restored inventory batch #${batchId} for "${batch.product.product_name}" from archive.`,
    });

    revalidatePath("/admin/inventory");
    return { success: true };
  } catch (error) {
    console.error("Restore inventory batch error:", error);
    return { success: false, error: "Failed to restore batch" };
  }
}

// =============================================================================
// Bulk Archive Operations
// =============================================================================

/**
 * Bulk archive products
 */
export async function bulkArchiveProducts(productIds: number[]): Promise<ActionResult> {
  try {
    const archiveSuffix = getArchiveSuffix();
    const results: { archived: number[]; skipped: number[] } = { archived: [], skipped: [] };

    for (const productId of productIds) {
      const product = await prisma.product.findUnique({
        where: { product_id: productId },
      });

      if (!product || product.deletedAt) {
        results.skipped.push(productId);
        continue;
      }

      await prisma.product.update({
        where: { product_id: productId },
        data: {
          deletedAt: new Date(),
          status: "ARCHIVED",
          is_archived: true,
          barcode: product.barcode ? `${product.barcode}${archiveSuffix}` : null,
          product_name: `${product.product_name}${archiveSuffix}`,
        },
      });

      results.archived.push(productId);
    }

    if (results.archived.length > 0) {
      await logActivity({
        username: "Admin",
        action: "ARCHIVE",
        module: "CATALOG",
        entity: "Product",
        entityName: `${results.archived.length} products`,
        details: `Bulk archived ${results.archived.length} products.`,
        metadata: {
          archived_ids: results.archived,
          skipped_ids: results.skipped,
        },
      });
    }

    revalidatePath("/admin/inventory");
    return {
      success: true,
      data: {
        archivedCount: results.archived.length,
        skippedCount: results.skipped.length,
      },
    };
  } catch (error) {
    console.error("Bulk archive products error:", error);
    return { success: false, error: "Failed to archive products" };
  }
}

/**
 * Bulk archive empty inventory batches for a product
 * Useful for cleaning up old depleted batches
 */
export async function bulkArchiveEmptyBatches(productId: number): Promise<ActionResult> {
  try {
    const emptyBatches = await prisma.inventoryBatch.findMany({
      where: {
        product_id: productId,
        quantity: 0,
        deletedAt: null,
      },
    });

    if (emptyBatches.length === 0) {
      return { success: true, data: { archivedCount: 0 } };
    }

    await prisma.inventoryBatch.updateMany({
      where: {
        id: { in: emptyBatches.map(b => b.id) },
      },
      data: {
        deletedAt: new Date(),
        status: "ARCHIVED",
      },
    });

    const product = await prisma.product.findUnique({
      where: { product_id: productId },
      select: { product_name: true },
    });

    await logActivity({
      username: "Admin",
      action: "ARCHIVE",
      module: "INVENTORY",
      entity: "InventoryBatch",
      entityId: productId,
      entityName: product?.product_name || `Product #${productId}`,
      details: `Bulk archived ${emptyBatches.length} empty batches for "${product?.product_name}".`,
      metadata: {
        archived_batch_ids: emptyBatches.map(b => b.id),
      },
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: { archivedCount: emptyBatches.length } };
  } catch (error) {
    console.error("Bulk archive empty batches error:", error);
    return { success: false, error: "Failed to archive batches" };
  }
}

// =============================================================================
// Query Helpers
// =============================================================================

/**
 * Get archived products
 */
export async function getArchivedProducts() {
  const products = await prisma.product.findMany({
    where: {
      deletedAt: { not: null },
    },
    include: {
      inventory: true,
    },
    orderBy: {
      deletedAt: "desc",
    },
  });

  return products.map((product) => ({
    product_id: product.product_id,
    product_name: stripArchiveSuffix(product.product_name) || product.product_name,
    archived_name: product.product_name,
    category: product.category,
    retail_price: Number(product.retail_price),
    wholesale_price: Number(product.wholesale_price),
    cost_price: Number(product.cost_price),
    barcode: stripArchiveSuffix(product.barcode),
    image_url: product.image_url,
    deletedAt: product.deletedAt,
    current_stock: product.inventory?.current_stock ?? 0,
  }));
}

/**
 * Get archived users
 */
export async function getArchivedUsers() {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: { not: null },
    },
    orderBy: {
      deletedAt: "desc",
    },
  });

  return users.map((user) => ({
    user_id: user.user_id,
    username: stripArchiveSuffix(user.username) || user.username,
    archived_username: user.username,
    role: user.role,
    deletedAt: user.deletedAt,
  }));
}

/**
 * Get archived customers/vendors
 */
export async function getArchivedCustomers(vendorsOnly: boolean = false) {
  const customers = await prisma.customer.findMany({
    where: {
      deletedAt: { not: null },
      ...(vendorsOnly ? { is_vendor: true } : {}),
    },
    orderBy: {
      deletedAt: "desc",
    },
  });

  return customers.map((customer) => ({
    customer_id: customer.customer_id,
    name: stripArchiveSuffix(customer.name) || customer.name,
    archived_name: customer.name,
    email: stripArchiveSuffix(customer.email),
    is_vendor: customer.is_vendor,
    deletedAt: customer.deletedAt,
  }));
}

/**
 * Get archived inventory batches for a product
 */
export async function getArchivedBatches(productId: number) {
  const batches = await prisma.inventoryBatch.findMany({
    where: {
      product_id: productId,
      deletedAt: { not: null },
    },
    orderBy: {
      deletedAt: "desc",
    },
  });

  return batches.map((batch) => ({
    id: batch.id,
    quantity: batch.quantity,
    expiry_date: batch.expiry_date,
    received_date: batch.received_date,
    supplier_name: batch.supplier_name,
    supplier_ref: batch.supplier_ref,
    cost_price: batch.cost_price ? Number(batch.cost_price) : null,
    deletedAt: batch.deletedAt,
  }));
}
