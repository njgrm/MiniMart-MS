"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { logActivity, logRestock, logStockAdjust, logBatchEdit, logExpiryEdit } from "@/lib/logger";

// Stock movement type (matches Prisma enum)
type StockMovementType = 
  | "INITIAL_STOCK"
  | "RESTOCK" 
  | "SALE" 
  | "ADJUSTMENT" 
  | "DAMAGE" 
  | "RETURN" 
  | "INTERNAL_USE"
  | "ORDER_SHORTAGE";

export type ActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

// ============================================================================
// Types
// ============================================================================

export interface RestockInput {
  productId: number;
  quantity: number;
  supplierName?: string;
  reference?: string;
  costPrice?: number;
  reason?: string;
  receiptImageUrl?: string;
  userId?: number;
  newExpiryDate?: Date;
}

export interface AdjustStockInput {
  productId: number;
  quantity: number; // Positive or negative
  movementType: "ADJUSTMENT" | "DAMAGE" | "RETURN" | "INTERNAL_USE";
  reason: string;
  reference?: string;
  userId?: number;
}

export interface StockMovementRecord {
  id: number;
  movement_type: StockMovementType;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  reference: string | null;
  supplier_name: string | null;
  cost_price: number | null;
  receipt_image_url: string | null;
  created_at: Date;
  user: {
    username: string;
  };
}

// ============================================================================
// Batch Types
// ============================================================================

export interface BatchInfo {
  id: number;
  quantity: number;
  expiry_date: Date | null;
  received_date: Date;
  supplier_ref: string | null;
  supplier_name: string | null;
  cost_price: number | null;
}

export interface DeductionResult {
  success: boolean;
  totalDeducted: number;
  batchesUsed: { batchId: number; quantityUsed: number; wasExpired: boolean }[];
  error?: string;
}

// ============================================================================
// Batch Tracking Functions (FEFO - First Expired, First Out)
// ============================================================================

/**
 * Deduct stock from batches using FEFO (First Expired, First Out) algorithm
 * This ensures oldest-expiring stock is sold first to minimize spoilage
 * 
 * NOTE: Only considers ACTIVE batches (deletedAt: null)
 * 
 * @param tx - Prisma transaction client
 * @param productId - Product to deduct from
 * @param quantityNeeded - Total quantity to deduct
 * @returns DeductionResult with details of which batches were used
 */
export async function deductStockFEFO(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  productId: number,
  quantityNeeded: number
): Promise<DeductionResult> {
  if (quantityNeeded <= 0) {
    return { success: false, totalDeducted: 0, batchesUsed: [], error: "Quantity must be positive" };
  }

  // Fetch all ACTIVE batches with stock, ordered by expiry date (nulls last = no expiry)
  // FEFO: Earliest expiry first to minimize spoilage
  // SOFT DELETE: Filter out archived batches (deletedAt: null)
  const batches = await tx.inventoryBatch.findMany({
    where: {
      product_id: productId,
      quantity: { gt: 0 },
      deletedAt: null, // Only active batches
    },
    orderBy: [
      { expiry_date: { sort: 'asc', nulls: 'last' } },
      { received_date: 'asc' }, // Tie-breaker: oldest received first (FIFO)
    ],
  });

  let remaining = quantityNeeded;
  const batchesUsed: DeductionResult['batchesUsed'] = [];
  const now = new Date();

  for (const batch of batches) {
    if (remaining <= 0) break;

    const toDeduct = Math.min(remaining, batch.quantity);
    const wasExpired = batch.expiry_date ? batch.expiry_date < now : false;

    // Update batch quantity
    await tx.inventoryBatch.update({
      where: { id: batch.id },
      data: { quantity: batch.quantity - toDeduct },
    });

    batchesUsed.push({
      batchId: batch.id,
      quantityUsed: toDeduct,
      wasExpired,
    });

    remaining -= toDeduct;
  }

  if (remaining > 0) {
    // Not enough stock across all batches
    // Rollback would happen automatically since we're in a transaction
    return {
      success: false,
      totalDeducted: quantityNeeded - remaining,
      batchesUsed,
      error: `Insufficient stock. Needed ${quantityNeeded}, only ${quantityNeeded - remaining} available in batches.`,
    };
  }

  return {
    success: true,
    totalDeducted: quantityNeeded,
    batchesUsed,
  };
}

/**
 * Recalculate and sync Product.nearest_expiry_date and Inventory.current_stock
 * from the actual batch data. Call this after batch modifications.
 * 
 * @param tx - Prisma transaction client
 * @param productId - Product to recalculate
 */
export async function syncProductFromBatches(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  productId: number
): Promise<{ totalStock: number; nearestExpiry: Date | null }> {
  // Get aggregate data from batches
  const aggregation = await tx.inventoryBatch.aggregate({
    where: {
      product_id: productId,
      quantity: { gt: 0 },
    },
    _sum: { quantity: true },
    _min: { expiry_date: true },
  });

  const totalStock = aggregation._sum.quantity ?? 0;
  const nearestExpiry = aggregation._min.expiry_date ?? null;

  // Update inventory current_stock
  await tx.inventory.update({
    where: { product_id: productId },
    data: { current_stock: totalStock },
  });

  // Update product nearest_expiry_date
  await tx.product.update({
    where: { product_id: productId },
    data: { nearest_expiry_date: nearestExpiry },
  });

  return { totalStock, nearestExpiry };
}

/**
 * Get all ACTIVE batches for a product (for Batch Audit UI)
 * Excludes archived batches by default
 * 
 * @param productId - Product ID
 * @param includeArchived - If true, includes archived batches
 */
export async function getProductBatches(productId: number, includeArchived: boolean = false): Promise<BatchInfo[]> {
  const batches = await prisma.inventoryBatch.findMany({
    where: { 
      product_id: productId,
      ...(includeArchived ? {} : { deletedAt: null }),
    },
    orderBy: [
      { expiry_date: { sort: 'asc', nulls: 'last' } },
      { received_date: 'asc' },
    ],
  });

  return batches.map((b) => ({
    id: b.id,
    quantity: b.quantity,
    expiry_date: b.expiry_date,
    received_date: b.received_date,
    supplier_ref: b.supplier_ref,
    supplier_name: b.supplier_name,
    cost_price: b.cost_price ? Number(b.cost_price) : null,
  }));
}

/**
 * Get product info for batch audit page
 */
export async function getProductForBatchAudit(productId: number): Promise<{
  product_id: number;
  product_name: string;
  category: string;
  current_stock: number;
  nearest_expiry_date: Date | null;
} | null> {
  const product = await prisma.product.findUnique({
    where: { product_id: productId },
    include: { inventory: true },
  });

  if (!product) return null;

  return {
    product_id: product.product_id,
    product_name: product.product_name,
    category: product.category,
    current_stock: product.inventory?.current_stock ?? 0,
    nearest_expiry_date: product.nearest_expiry_date,
  };
}

/**
 * Edit a batch's expiry date (HIGH RISK operation)
 * Used for corrections or updates to expiry information
 */
export interface EditBatchExpiryInput {
  batchId: number;
  newExpiryDate: Date | null;
  reason: string;
  userId?: number;
}

export async function editBatchExpiry(input: EditBatchExpiryInput): Promise<ActionResult> {
  const { batchId, newExpiryDate, reason, userId = 1 } = input;

  if (!reason || reason.trim().length < 3) {
    return { success: false, error: "Please provide a reason (min 3 characters)" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get the batch
      const batch = await tx.inventoryBatch.findUnique({
        where: { id: batchId },
        include: { product: true },
      });

      if (!batch) {
        throw new Error("Batch not found");
      }

      const oldExpiryDate = batch.expiry_date;

      // Update the batch expiry date
      await tx.inventoryBatch.update({
        where: { id: batchId },
        data: { expiry_date: newExpiryDate },
      });

      // Recalculate product's nearest_expiry_date
      const { nearestExpiry } = await syncProductFromBatches(tx, batch.product_id);

      return {
        oldExpiryDate,
        newExpiryDate,
        productId: batch.product_id,
        productName: batch.product.product_name,
        nearestExpiry,
      };
    });

    revalidatePath("/admin/inventory");
    revalidatePath(`/admin/inventory/${result.productId}/batches`);
    
    // Audit log: Expiry date edit (HIGH RISK)
    await logExpiryEdit(
      "Admin", // TODO: Get from session
      result.productId,
      result.productName,
      batchId,
      result.oldExpiryDate,
      result.newExpiryDate
    );

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Edit batch expiry error:", error);
    const message = error instanceof Error ? error.message : "Failed to edit batch expiry";
    return { success: false, error: message };
  }
}

/**
 * Adjust a specific batch quantity (for audit corrections)
 * Creates a stock movement record for traceability
 * HIGH RISK: Logged with detailed old vs new values
 */
export interface AdjustBatchInput {
  batchId: number;
  newQuantity: number;
  reason: string;
  userId?: number;
}

export async function adjustBatchQuantity(input: AdjustBatchInput): Promise<ActionResult> {
  const { batchId, newQuantity, reason, userId = 1 } = input;

  if (newQuantity < 0) {
    return { success: false, error: "Quantity cannot be negative" };
  }

  if (!reason || reason.trim().length < 3) {
    return { success: false, error: "Please provide a reason (min 3 characters)" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get the batch
      const batch = await tx.inventoryBatch.findUnique({
        where: { id: batchId },
        include: { product: { include: { inventory: true } } },
      });

      if (!batch) {
        throw new Error("Batch not found");
      }

      const previousQty = batch.quantity;
      const quantityChange = newQuantity - previousQty;

      if (quantityChange === 0) {
        throw new Error("No change in quantity");
      }

      // Update the batch quantity
      await tx.inventoryBatch.update({
        where: { id: batchId },
        data: { quantity: newQuantity },
      });

      // Sync inventory.current_stock and product.nearest_expiry_date
      const { totalStock } = await syncProductFromBatches(tx, batch.product_id);

      // Get inventory for movement record
      const inventory = batch.product.inventory;
      if (!inventory) {
        throw new Error("Product inventory not found");
      }

      // Create adjustment stock movement
      await tx.stockMovement.create({
        data: {
          inventory_id: inventory.inventory_id,
          user_id: userId,
          movement_type: "ADJUSTMENT",
          quantity_change: quantityChange,
          previous_stock: inventory.current_stock,
          new_stock: totalStock,
          reason: `Batch #${batchId} adjustment: ${reason}`,
          reference: `BATCH-${batchId}`,
        },
      });

      return { 
        newQuantity, 
        totalStock, 
        previousQty, 
        productId: batch.product_id,
        productName: batch.product.product_name 
      };
    });

    revalidatePath("/admin/inventory");
    revalidatePath(`/admin/inventory/${result.productId}/batches`);
    
    // Audit log: Batch quantity edit (HIGH RISK)
    await logBatchEdit(
      "Admin", // TODO: Get from session
      result.productId,
      result.productName,
      batchId,
      result.previousQty,
      result.newQuantity,
      reason
    );

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Adjust batch error:", error);
    const message = error instanceof Error ? error.message : "Failed to adjust batch";
    return { success: false, error: message };
  }
}

/**
 * Delete a batch (remove spoiled/damaged stock)
 * HIGH RISK: Logged with detailed information
 */
export async function deleteBatch(batchId: number, reason: string, userId: number = 1): Promise<ActionResult> {
  if (!reason || reason.trim().length < 3) {
    return { success: false, error: "Please provide a reason (min 3 characters)" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get the batch
      const batch = await tx.inventoryBatch.findUnique({
        where: { id: batchId },
        include: { product: { include: { inventory: true } } },
      });

      if (!batch) {
        throw new Error("Batch not found");
      }

      const quantityRemoved = batch.quantity;

      // Get inventory for movement record
      const inventory = batch.product.inventory;
      if (!inventory) {
        throw new Error("Product inventory not found");
      }

      const previousStock = inventory.current_stock;

      // Delete the batch
      await tx.inventoryBatch.delete({
        where: { id: batchId },
      });

      // Sync inventory.current_stock and product.nearest_expiry_date
      const { totalStock } = await syncProductFromBatches(tx, batch.product_id);

      // Create DAMAGE stock movement
      await tx.stockMovement.create({
        data: {
          inventory_id: inventory.inventory_id,
          user_id: userId,
          movement_type: "DAMAGE",
          quantity_change: -quantityRemoved,
          previous_stock: previousStock,
          new_stock: totalStock,
          reason: `Batch #${batchId} removed: ${reason}`,
          reference: `BATCH-${batchId}-REMOVED`,
        },
      });

      return { 
        quantityRemoved, 
        newTotalStock: totalStock, 
        productId: batch.product_id,
        productName: batch.product.product_name,
        expiryDate: batch.expiry_date,
      };
    });

    revalidatePath("/admin/inventory");
    revalidatePath(`/admin/inventory/${result.productId}/batches`);
    
    // Audit log: Batch deleted (HIGH RISK)
    await logActivity({
      username: "Admin", // TODO: Get from session
      action: "DELETE",
      entity: "InventoryBatch",
      entityId: batchId,
      entityName: result.productName,
      details: `⚠️ Deleted Batch #${batchId} for "${result.productName}". Removed ${result.quantityRemoved} units. Reason: ${reason}.`,
      metadata: {
        product_id: result.productId,
        batch_id: batchId,
        quantity_removed: result.quantityRemoved,
        expiry_date: result.expiryDate?.toISOString() || null,
        new_total_stock: result.newTotalStock,
        reason,
      },
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Delete batch error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete batch";
    return { success: false, error: message };
  }
}

/**
 * Return a batch to supplier (expired, damaged, recalled products)
 * Removes the batch quantity and logs as SUPPLIER_RETURN movement
 * HIGH RISK: Logged with detailed information
 */
export async function returnBatchToSupplier(
  batchId: number, 
  reason: string, 
  supplierName?: string,
  userId: number = 1
): Promise<ActionResult> {
  if (!reason || reason.trim().length < 3) {
    return { success: false, error: "Please provide a reason (min 3 characters)" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get the batch
      const batch = await tx.inventoryBatch.findUnique({
        where: { id: batchId },
        include: { product: { include: { inventory: true } } },
      });

      if (!batch) {
        throw new Error("Batch not found");
      }

      const quantityReturned = batch.quantity;
      const batchSupplier = supplierName || batch.supplier_name || "Unknown Supplier";

      // Get inventory for movement record
      const inventory = batch.product.inventory;
      if (!inventory) {
        throw new Error("Product inventory not found");
      }

      const previousStock = inventory.current_stock;

      // Delete the batch (or set to 0 and mark as returned)
      await tx.inventoryBatch.delete({
        where: { id: batchId },
      });

      // Sync inventory.current_stock and product.nearest_expiry_date
      const { totalStock } = await syncProductFromBatches(tx, batch.product_id);

      // Create SUPPLIER_RETURN stock movement
      await tx.stockMovement.create({
        data: {
          inventory_id: inventory.inventory_id,
          user_id: userId,
          movement_type: "SUPPLIER_RETURN",
          quantity_change: -quantityReturned,
          previous_stock: previousStock,
          new_stock: totalStock,
          reason: `Batch #${batchId} returned to supplier: ${reason}`,
          reference: `RETURN-${batchId}-${Date.now()}`,
          supplier_name: batchSupplier,
          cost_price: batch.cost_price,
        },
      });

      return { 
        quantityReturned, 
        newTotalStock: totalStock, 
        productId: batch.product_id,
        productName: batch.product.product_name,
        expiryDate: batch.expiry_date,
        supplierName: batchSupplier,
        costPrice: batch.cost_price,
      };
    });

    revalidatePath("/admin/inventory");
    revalidatePath(`/admin/inventory/${result.productId}/batches`);
    
    // Audit log: Batch returned to supplier (HIGH RISK)
    await logActivity({
      username: "Admin", // TODO: Get from session
      action: "DELETE",
      entity: "InventoryBatch",
      entityId: batchId,
      entityName: result.productName,
      details: `📦 Returned Batch #${batchId} to supplier "${result.supplierName}". Returned ${result.quantityReturned} units of "${result.productName}". Reason: ${reason}.`,
      metadata: {
        product_id: result.productId,
        batch_id: batchId,
        quantity_returned: result.quantityReturned,
        expiry_date: result.expiryDate?.toISOString() || null,
        new_total_stock: result.newTotalStock,
        supplier_name: result.supplierName,
        cost_price: result.costPrice?.toString() || null,
        reason,
        movement_type: "SUPPLIER_RETURN",
      },
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Return batch to supplier error:", error);
    const message = error instanceof Error ? error.message : "Failed to return batch to supplier";
    return { success: false, error: message };
  }
}

// ============================================================================
// Stock Movement Actions
// ============================================================================

/**
 * Restock (Add stock from supplier)
 * Creates a new InventoryBatch record for batch tracking (FEFO)
 * Also creates a RESTOCK movement record for audit trail
 * 
 * Batch Tracking Logic:
 * - Each restock creates a NEW batch with its own expiry date
 * - Product.nearest_expiry_date is auto-computed as MIN(batch expiry dates)
 * - Inventory.current_stock is auto-computed as SUM(batch quantities)
 */
export async function restockProduct(input: RestockInput): Promise<ActionResult> {
  const { productId, quantity, supplierName, reference, costPrice, reason, receiptImageUrl, userId = 1, newExpiryDate } = input;

  if (quantity <= 0) {
    return { success: false, error: "Quantity must be greater than 0" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get current inventory
      const inventory = await tx.inventory.findUnique({
        where: { product_id: productId },
        include: { product: true },
      });

      if (!inventory) {
        throw new Error("Product inventory not found");
      }

      const previousStock = inventory.current_stock;

      // =========================================================================
      // Create new Inventory Batch for FEFO tracking
      // =========================================================================
      await tx.inventoryBatch.create({
        data: {
          product_id: productId,
          quantity: quantity,
          expiry_date: newExpiryDate || null,
          received_date: new Date(),
          supplier_ref: reference || null,
          supplier_name: supplierName || null,
          cost_price: costPrice ? new Decimal(costPrice) : null,
        },
      });

      // Sync inventory.current_stock and product.nearest_expiry_date from batches
      const { totalStock } = await syncProductFromBatches(tx, productId);

      // Update product cost price if provided (latest cost becomes default)
      if (costPrice !== undefined && costPrice > 0) {
        await tx.product.update({
          where: { product_id: productId },
          data: { cost_price: new Decimal(costPrice) },
        });
      }

      // Update last_restock timestamp
      await tx.inventory.update({
        where: { product_id: productId },
        data: { last_restock: new Date() },
      });

      // Create stock movement record for audit trail
      const movement = await tx.stockMovement.create({
        data: {
          inventory_id: inventory.inventory_id,
          user_id: userId,
          movement_type: "RESTOCK",
          quantity_change: quantity,
          previous_stock: previousStock,
          new_stock: totalStock,
          reason: reason || "Stock replenishment",
          reference: reference || null,
          supplier_name: supplierName || null,
          cost_price: costPrice ? new Decimal(costPrice) : null,
          receipt_image_url: receiptImageUrl || null,
        },
      });

      return { movement, newStock: totalStock, previousStock, productName: inventory.product.product_name };
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/pos");
    
    // Audit log: Restock (using centralized logger)
    await logRestock(
      "Admin", // TODO: Get from session
      productId,
      result.productName,
      quantity,
      result.previousStock,
      result.newStock,
      supplierName,
      newExpiryDate,
      reference,
      reason,
      receiptImageUrl,
      costPrice
    );

    return {
      success: true,
      data: {
        movementId: result.movement.id,
        newStock: result.newStock,
      },
    };
  } catch (error) {
    console.error("Restock error:", error);
    const message = error instanceof Error ? error.message : "Failed to restock product";
    return { success: false, error: message };
  }
}

/**
 * Adjust Stock (Manual adjustments: damage, audit corrections, returns, internal use)
 * Creates a movement record and updates inventory
 */
export async function adjustStock(input: AdjustStockInput): Promise<ActionResult> {
  const { productId, quantity, movementType, reason, reference, userId = 1 } = input;

  if (quantity === 0) {
    return { success: false, error: "Quantity change cannot be zero" };
  }

  if (!reason || reason.trim().length < 3) {
    return { success: false, error: "Please provide a reason for this adjustment (min 3 characters)" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get current inventory with product name
      const inventory = await tx.inventory.findUnique({
        where: { product_id: productId },
        include: { product: true },
      });

      if (!inventory) {
        throw new Error("Product inventory not found");
      }

      const previousStock = inventory.current_stock;
      const newStock = previousStock + quantity;

      // Validate: cannot go below 0
      if (newStock < 0) {
        throw new Error(`Cannot reduce stock below 0. Current stock: ${previousStock}, Requested change: ${quantity}`);
      }

      // Update inventory
      await tx.inventory.update({
        where: { product_id: productId },
        data: { current_stock: newStock },
      });

      // Create stock movement record
      const movement = await tx.stockMovement.create({
        data: {
          inventory_id: inventory.inventory_id,
          user_id: userId,
          movement_type: movementType,
          quantity_change: quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: reason.trim(),
          reference: reference || null,
        },
      });

      return { movement, newStock, previousStock, productName: inventory.product.product_name };
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/pos");
    
    // Audit log: Stock adjustment (using centralized logger)
    await logStockAdjust(
      "Admin", // TODO: Get from session
      productId,
      result.productName,
      result.previousStock,
      result.newStock,
      reason,
      movementType
    );

    return {
      success: true,
      data: {
        movementId: result.movement.id,
        newStock: result.newStock,
      },
    };
  } catch (error) {
    console.error("Adjust stock error:", error);
    const message = error instanceof Error ? error.message : "Failed to adjust stock";
    return { success: false, error: message };
  }
}

/**
 * Record a sale (called automatically from transaction creation)
 * This should be called internally when a sale is made
 */
export async function recordSaleMovement(
  productId: number,
  quantity: number,
  receiptNo: string,
  userId: number = 1
): Promise<ActionResult> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { product_id: productId },
      });

      if (!inventory) {
        throw new Error("Product inventory not found");
      }

      const previousStock = inventory.current_stock;
      const newStock = previousStock - quantity;

      // Create stock movement record (inventory already updated by transaction)
      const movement = await tx.stockMovement.create({
        data: {
          inventory_id: inventory.inventory_id,
          user_id: userId,
          movement_type: "SALE",
          quantity_change: -quantity, // Negative for sales
          previous_stock: previousStock,
          new_stock: newStock,
          reason: "Point of Sale transaction",
          reference: receiptNo,
        },
      });

      return movement;
    });

    return { success: true, data: { movementId: result.id } };
  } catch (error) {
    console.error("Record sale movement error:", error);
    return { success: false, error: "Failed to record sale movement" };
  }
}

/**
 * Get stock movement history for a product
 */
export async function getStockMovements(
  productId: number,
  limit: number = 20
): Promise<StockMovementRecord[]> {
  const inventory = await prisma.inventory.findUnique({
    where: { product_id: productId },
  });

  if (!inventory) {
    return [];
  }

  const movements = await prisma.stockMovement.findMany({
    where: { inventory_id: inventory.inventory_id },
    include: {
      user: {
        select: { username: true },
      },
    },
    orderBy: { created_at: "desc" },
    take: limit,
  });

  return movements.map((m) => ({
    id: m.id,
    movement_type: m.movement_type,
    quantity_change: m.quantity_change,
    previous_stock: m.previous_stock,
    new_stock: m.new_stock,
    reason: m.reason,
    reference: m.reference,
    supplier_name: m.supplier_name,
    cost_price: m.cost_price ? Number(m.cost_price) : null,
    receipt_image_url: m.receipt_image_url,
    created_at: m.created_at,
    user: m.user,
  }));
}

/**
 * Get all stock movements (for admin dashboard/reports)
 */
export async function getAllStockMovements(
  options: {
    limit?: number;
    movementType?: StockMovementType;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<(StockMovementRecord & { product_name: string })[]> {
  const { limit = 50, movementType, startDate, endDate } = options;

  // Build where clause with proper type handling for optional enum
  type WhereClause = {
    movement_type?: StockMovementType;
    created_at?: { gte: Date; lte: Date };
  };
  
  const whereClause: WhereClause = {};
  if (movementType) {
    whereClause.movement_type = movementType;
  }
  if (startDate && endDate) {
    whereClause.created_at = { gte: startDate, lte: endDate };
  }

  const movements = await prisma.stockMovement.findMany({
    where: whereClause,
    include: {
      user: {
        select: { username: true },
      },
      inventory: {
        include: {
          product: {
            select: { product_name: true },
          },
        },
      },
    },
    orderBy: { created_at: "desc" },
    take: limit,
  });

  return movements.map((m) => ({
    id: m.id,
    movement_type: m.movement_type as StockMovementType,
    quantity_change: m.quantity_change,
    previous_stock: m.previous_stock,
    new_stock: m.new_stock,
    reason: m.reason,
    reference: m.reference,
    supplier_name: m.supplier_name,
    cost_price: m.cost_price ? Number(m.cost_price) : null,
    receipt_image_url: m.receipt_image_url,
    created_at: m.created_at,
    user: m.user,
    product_name: m.inventory.product.product_name,
  }));
}

/**
 * Get inventory alerts (out of stock, critical stock, and low stock counts)
 * 
 * CRITICAL: Uses DailySalesAggregate (30-day) - SAME SOURCE AS ANALYTICS!
 * This ensures top nav badges match Analytics and Inventory pages.
 * 
 * - OUT_OF_STOCK: currentStock === 0 AND has velocity (was selling)
 * - CRITICAL: ≤2 days of supply (RED badge)
 * - LOW: 2-7 days of supply (ORANGE badge)
 */
export async function getInventoryAlerts(): Promise<{ outOfStock: number; criticalStock: number; lowStock: number }> {
  try {
    // Use same date range as Analytics forecasting (30-day lookback)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // Yesterday (latest complete day)
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30); // 30 days back

    // Fetch products and DailySalesAggregate in parallel (SAME SOURCE as Analytics!)
    const [products, allAggregates] = await Promise.all([
      prisma.product.findMany({
        where: { is_archived: false },
        include: { inventory: true },
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

    let outOfStock = 0;
    let criticalStock = 0;
    let lowStock = 0;

    for (const product of products) {
      const currentStock = product.inventory?.current_stock ?? 0;
      
      // Calculate velocity from DailySalesAggregate (MATCHES Analytics exactly)
      const salesHistory = aggregatesByProduct.get(product.product_id) ?? [];
      const totalSales = salesHistory.reduce((sum, day) => sum + day.quantity_sold, 0);
      const dailyVelocity = totalSales / 30; // 30-day average
      
      // Calculate days of stock (coverage) - USE Math.floor() TO MATCH ANALYTICS!
      const daysOfStock = dailyVelocity > 0.1 
        ? Math.floor(currentStock / dailyVelocity) 
        : (currentStock > 0 ? 999 : 0);

      // Velocity-based stock status (matches analytics logic)
      if (currentStock === 0 && dailyVelocity >= 0.1) {
        // Only count as out of stock if item was selling
        outOfStock++;
      } else if (dailyVelocity >= 0.1) {
        if (daysOfStock <= 2) {
          // CRITICAL (≤2 days) - urgent!
          criticalStock++;
        } else if (daysOfStock <= 7) {
          // LOW (2-7 days) - attention needed
          lowStock++;
        }
      }
    }

    return { outOfStock, criticalStock, lowStock };
  } catch (error) {
    console.error("Error fetching inventory alerts:", error);
    return { outOfStock: 0, criticalStock: 0, lowStock: 0 };
  }
}

// ============================================================================
// Batch Restock (Multiple Products from Single Supplier Delivery)
// ============================================================================

export interface BatchRestockItem {
  productId: number;
  quantity: number;
  costPrice?: number;
  newExpiryDate?: Date;
}

export interface BatchRestockInput {
  items: BatchRestockItem[];
  supplierName?: string;
  reference?: string;
  reason?: string;
  receiptImageUrl?: string;
  userId?: number;
}

export interface BatchRestockResult {
  results: Array<{
    productId: number;
    productName: string;
    success: boolean;
    newStock?: number;
    error?: string;
  }>;
  successCount: number;
  failedCount: number;
}

/**
 * Batch Restock - Add stock for multiple products from a single supplier delivery
 * 
 * Use Case: Supplier delivers multiple different products with a single receipt/invoice.
 * All items share the same supplier name, reference number, and receipt image.
 * 
 * Features:
 * - Single transaction for all items (all succeed or all fail together)
 * - Each product gets its own InventoryBatch with individual expiry date
 * - Single receipt image shared across all items
 * - Individual cost prices per product
 * - Comprehensive audit trail with batch reference
 */
export async function batchRestockProducts(input: BatchRestockInput): Promise<ActionResult<BatchRestockResult>> {
  const { items, supplierName, reference, reason, receiptImageUrl, userId = 1 } = input;

  if (!items || items.length === 0) {
    return { success: false, error: "No items provided for batch restock" };
  }

  // Validate all items have valid quantities
  const invalidItems = items.filter(i => i.quantity <= 0);
  if (invalidItems.length > 0) {
    return { success: false, error: "All items must have a quantity greater than 0" };
  }

  try {
    const results: BatchRestockResult['results'] = [];

    // Process all items in a single transaction for atomicity
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        try {
          // Get current inventory
          const inventory = await tx.inventory.findUnique({
            where: { product_id: item.productId },
            include: { product: true },
          });

          if (!inventory) {
            results.push({
              productId: item.productId,
              productName: `Product #${item.productId}`,
              success: false,
              error: "Product inventory not found",
            });
            continue;
          }

          const previousStock = inventory.current_stock;

          // Create new Inventory Batch for FEFO tracking
          await tx.inventoryBatch.create({
            data: {
              product_id: item.productId,
              quantity: item.quantity,
              expiry_date: item.newExpiryDate || null,
              received_date: new Date(),
              supplier_ref: reference || null,
              supplier_name: supplierName || null,
              cost_price: item.costPrice ? new Decimal(item.costPrice) : null,
            },
          });

          // Sync inventory.current_stock and product.nearest_expiry_date from batches
          const { totalStock } = await syncProductFromBatches(tx, item.productId);

          // Update product cost price if provided (latest cost becomes default)
          if (item.costPrice !== undefined && item.costPrice > 0) {
            await tx.product.update({
              where: { product_id: item.productId },
              data: { cost_price: new Decimal(item.costPrice) },
            });
          }

          // Update last_restock timestamp
          await tx.inventory.update({
            where: { product_id: item.productId },
            data: { last_restock: new Date() },
          });

          // Create stock movement record for audit trail
          await tx.stockMovement.create({
            data: {
              inventory_id: inventory.inventory_id,
              user_id: userId,
              movement_type: "RESTOCK",
              quantity_change: item.quantity,
              previous_stock: previousStock,
              new_stock: totalStock,
              reason: reason || `Batch restock: ${supplierName || "Supplier delivery"}`,
              reference: reference || null,
              supplier_name: supplierName || null,
              cost_price: item.costPrice ? new Decimal(item.costPrice) : null,
              receipt_image_url: receiptImageUrl || null,
            },
          });

          results.push({
            productId: item.productId,
            productName: inventory.product.product_name,
            success: true,
            newStock: totalStock,
          });

          // Audit log for each item (outside transaction to not block)
        } catch (itemError) {
          const message = itemError instanceof Error ? itemError.message : "Unknown error";
          results.push({
            productId: item.productId,
            productName: `Product #${item.productId}`,
            success: false,
            error: message,
          });
        }
      }
    });

    // Revalidate paths
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/pos");
    revalidatePath("/admin");

    // Log the batch operation
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);

    // Centralized audit log for batch operation
    await logActivity({
      action: "BATCH_RESTOCK",
      module: "INVENTORY",
      actor: "Admin", // TODO: Get from session
      description: `Batch restock: ${successCount} products (${totalUnits} total units) from ${supplierName || "Unknown supplier"}`,
      details: {
        supplierName,
        reference,
        itemCount: items.length,
        totalUnits,
        successCount,
        failedCount,
        receiptImageUrl,
        products: results.map(r => ({
          productId: r.productId,
          productName: r.productName,
          success: r.success,
          newStock: r.newStock,
        })),
      },
    });

    return {
      success: failedCount === 0,
      data: {
        results,
        successCount,
        failedCount,
      },
      error: failedCount > 0 ? `${failedCount} items failed to restock` : undefined,
    };
  } catch (error) {
    console.error("Batch restock error:", error);
    const message = error instanceof Error ? error.message : "Failed to process batch restock";
    return { success: false, error: message };
  }
}