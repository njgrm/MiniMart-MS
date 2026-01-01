"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

// Stock movement type (matches Prisma enum)
type StockMovementType = 
  | "INITIAL_STOCK"
  | "RESTOCK" 
  | "SALE" 
  | "ADJUSTMENT" 
  | "DAMAGE" 
  | "RETURN" 
  | "INTERNAL_USE";

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
// Stock Movement Actions
// ============================================================================

/**
 * Restock (Add stock from supplier)
 * Creates a RESTOCK movement record and updates inventory
 */
export async function restockProduct(input: RestockInput): Promise<ActionResult> {
  const { productId, quantity, supplierName, reference, costPrice, reason, receiptImageUrl, userId = 1 } = input;

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
      const newStock = previousStock + quantity;

      // Update inventory
      await tx.inventory.update({
        where: { product_id: productId },
        data: {
          current_stock: newStock,
          last_restock: new Date(),
        },
      });

      // Update product cost price if provided
      if (costPrice !== undefined && costPrice > 0) {
        await tx.product.update({
          where: { product_id: productId },
          data: { cost_price: new Decimal(costPrice) },
        });
      }

      // Create stock movement record
      const movement = await tx.stockMovement.create({
        data: {
          inventory_id: inventory.inventory_id,
          user_id: userId,
          movement_type: "RESTOCK",
          quantity_change: quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: reason || "Stock replenishment",
          reference: reference || null,
          supplier_name: supplierName || null,
          cost_price: costPrice ? new Decimal(costPrice) : null,
          receipt_image_url: receiptImageUrl || null,
        },
      });

      return { movement, newStock };
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/pos");

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
      // Get current inventory
      const inventory = await tx.inventory.findUnique({
        where: { product_id: productId },
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

      return { movement, newStock };
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/pos");

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
 * Get inventory alerts (out of stock and low stock counts)
 * Used for global stock alerts component
 */
export async function getInventoryAlerts(): Promise<{ outOfStock: number; lowStock: number }> {
  try {
    // Get all products with inventory to compute status
    const products = await prisma.product.findMany({
      where: { is_archived: false },
      include: { inventory: true },
    });

    let outOfStock = 0;
    let lowStock = 0;

    for (const product of products) {
      const currentStock = product.inventory?.current_stock ?? 0;
      const reorderLevel = product.inventory?.reorder_level ?? 10;

      if (currentStock === 0) {
        outOfStock++;
      } else if (currentStock <= reorderLevel) {
        lowStock++;
      }
    }

    return { outOfStock, lowStock };
  } catch (error) {
    console.error("Error fetching inventory alerts:", error);
    return { outOfStock: 0, lowStock: 0 };
  }
}