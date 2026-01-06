"use server";

import { prisma } from "@/lib/db";
import { AuditAction, Prisma } from "@prisma/client";
import { format } from "date-fns";

// =============================================================================
// Types
// =============================================================================

export interface LogActivityInput {
  userId?: number;
  username: string;
  action: AuditAction;
  module?: "INVENTORY" | "POS" | "CATALOG" | "AUTH" | "ORDERS"; // System area
  entity: string; // "Product", "Supplier", "InventoryBatch", "Order"
  entityId?: number;
  entityName: string;
  details?: string; // Manual details string
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

// Field display names for human-readable diffs
const FIELD_LABELS: Record<string, string> = {
  product_name: "Product Name",
  retail_price: "Retail Price",
  wholesale_price: "Wholesale Price",
  cost_price: "Cost Price",
  category: "Category",
  barcode: "Barcode",
  current_stock: "Stock Level",
  reorder_level: "Reorder Level",
  expiry_date: "Expiry Date",
  quantity: "Quantity",
  supplier_name: "Supplier",
  reference: "Reference",
  status: "Status",
  total_amount: "Total Amount",
  image_url: "Product Image",
};

// Fields that are high-risk and should be highlighted
const HIGH_RISK_FIELDS = new Set([
  "expiry_date",
  "current_stock",
  "quantity",
  "cost_price",
]);

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format a value for human-readable display
 */
function formatValue(value: unknown, fieldName?: string): string {
  if (value === null || value === undefined) {
    return "(empty)";
  }

  // Handle dates
  if (value instanceof Date) {
    return format(value, "MMM d, yyyy");
  }

  // Handle date strings
  if (typeof value === "string" && fieldName?.toLowerCase().includes("date")) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return format(date, "MMM d, yyyy");
      }
    } catch {
      // Not a valid date, use as string
    }
  }

  // Handle numbers (prices)
  if (typeof value === "number") {
    if (fieldName?.toLowerCase().includes("price") || fieldName?.toLowerCase().includes("amount")) {
      return `₱${value.toFixed(2)}`;
    }
    return value.toString();
  }

  // Handle booleans
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

/**
 * Get human-readable field label
 */
function getFieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] || fieldName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Compare old and new data objects and generate human-readable change descriptions
 */
function generateChangeDiff(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): { changes: string[]; highRiskChanges: string[]; changedFields: string[] } {
  const changes: string[] = [];
  const highRiskChanges: string[] = [];
  const changedFields: string[] = [];

  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    const oldVal = oldData[key];
    const newVal = newData[key];

    // Skip if values are the same
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
      continue;
    }

    // Skip internal fields
    if (key.startsWith("_") || key === "updated_at" || key === "created_at") {
      continue;
    }

    const label = getFieldLabel(key);
    const oldFormatted = formatValue(oldVal, key);
    const newFormatted = formatValue(newVal, key);

    const changeText = `Changed ${label} from "${oldFormatted}" to "${newFormatted}"`;
    
    changedFields.push(key);
    
    if (HIGH_RISK_FIELDS.has(key)) {
      highRiskChanges.push(changeText);
    } else {
      changes.push(changeText);
    }
  }

  return { changes, highRiskChanges, changedFields };
}

// =============================================================================
// Main Logging Function
// =============================================================================

/**
 * Centralized logging utility for audit trail
 * 
 * Features:
 * - Automatic diff generation between old and new data
 * - Human-readable change descriptions
 * - High-risk field highlighting (expiry, stock, cost)
 * - Graceful failure (never breaks the main operation)
 * 
 * @example
 * // For CREATE actions
 * await logActivity({
 *   username: "Admin",
 *   action: "CREATE",
 *   entity: "Product",
 *   entityId: 123,
 *   entityName: "Coca Cola 1.5L",
 *   details: "Created product with initial stock of 50 units"
 * });
 * 
 * @example
 * // For UPDATE actions with diff
 * await logActivity({
 *   username: "Admin",
 *   action: "UPDATE",
 *   entity: "Product",
 *   entityId: 123,
 *   entityName: "Coca Cola 1.5L",
 *   oldData: { retail_price: 50, expiry_date: "2024-01-01" },
 *   newData: { retail_price: 55, expiry_date: "2024-06-01" }
 * });
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    let details = input.details || "";
    let metadata: Record<string, unknown> = input.metadata || {};

    // If old and new data are provided, generate diff
    if (input.oldData && input.newData) {
      const { changes, highRiskChanges, changedFields } = generateChangeDiff(
        input.oldData,
        input.newData
      );

      // Combine all changes into details string
      const allChanges = [...highRiskChanges, ...changes];
      
      if (allChanges.length > 0) {
        details = allChanges.join(". ") + ".";
      } else if (!details) {
        details = "No significant changes detected.";
      }

      // Store structured data in metadata
      metadata = {
        ...metadata,
        old_values: input.oldData,
        new_values: input.newData,
        changed_fields: changedFields,
        has_high_risk_changes: highRiskChanges.length > 0,
      };
    }

    // Ensure we have some details
    if (!details) {
      details = `${input.action} operation on ${input.entity}`;
    }

    await prisma.auditLog.create({
      data: {
        user_id: input.userId ?? null,
        username: input.username,
        action: input.action,
        module: input.module ?? null,
        entity_type: input.entity,
        entity_id: input.entityId ?? null,
        entity_name: input.entityName,
        details,
        metadata: Object.keys(metadata).length > 0 
          ? (metadata as Prisma.InputJsonValue) 
          : Prisma.JsonNull,
        ip_address: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    // CRITICAL: Never throw - audit logging should never break the main operation
    console.error("[AuditLog] Failed to log activity:", error);
  }
}

// =============================================================================
// Convenience Functions for Common Operations
// =============================================================================

/**
 * Log a product creation
 */
export async function logProductCreate(
  username: string,
  productId: number,
  productName: string,
  details: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logActivity({
    username,
    action: "CREATE",
    entity: "Product",
    entityId: productId,
    entityName: productName,
    details,
    metadata,
  });
}

/**
 * Log a product update with automatic diff
 */
export async function logProductUpdate(
  username: string,
  productId: number,
  productName: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): Promise<void> {
  await logActivity({
    username,
    action: "UPDATE",
    entity: "Product",
    entityId: productId,
    entityName: productName,
    oldData,
    newData,
  });
}

/**
 * Log a product deletion
 */
export async function logProductDelete(
  username: string,
  productId: number,
  productName: string,
  reason?: string
): Promise<void> {
  await logActivity({
    username,
    action: "DELETE",
    entity: "Product",
    entityId: productId,
    entityName: productName,
    details: `Deleted product "${productName}"${reason ? ` - Reason: ${reason}` : ""}`,
  });
}

/**
 * Log a stock restock operation
 */
export async function logRestock(
  username: string,
  productId: number,
  productName: string,
  quantity: number,
  newStock: number,
  supplierName?: string,
  expiryDate?: Date | null
): Promise<void> {
  let details = `Added ${quantity} stock. New stock level: ${newStock}.`;
  if (supplierName) details += ` Supplier: ${supplierName}.`;
  if (expiryDate) details += ` Expiry: ${format(expiryDate, "MMM d, yyyy")}.`;

  await logActivity({
    username,
    action: "RESTOCK",
    entity: "Inventory",
    entityId: productId,
    entityName: productName,
    details,
    metadata: {
      quantity_added: quantity,
      new_stock_level: newStock,
      supplier_name: supplierName || null,
      expiry_date: expiryDate?.toISOString() || null,
    },
  });
}

/**
 * Log a stock adjustment operation
 */
export async function logStockAdjust(
  username: string,
  productId: number,
  productName: string,
  oldStock: number,
  newStock: number,
  reason: string,
  movementType: string
): Promise<void> {
  const change = newStock - oldStock;
  const changeStr = change > 0 ? `+${change}` : `${change}`;
  
  await logActivity({
    username,
    action: "ADJUST_STOCK",
    entity: "Inventory",
    entityId: productId,
    entityName: productName,
    details: `Adjusted stock from ${oldStock} to ${newStock} (${changeStr}). Type: ${movementType}. Reason: ${reason}.`,
    metadata: {
      previous_stock: oldStock,
      new_stock: newStock,
      quantity_change: change,
      movement_type: movementType,
      reason,
    },
  });
}

/**
 * Log a batch expiry date edit (HIGH RISK)
 */
export async function logExpiryEdit(
  username: string,
  productId: number,
  productName: string,
  batchId: number,
  oldExpiry: Date | null,
  newExpiry: Date | null
): Promise<void> {
  const oldStr = oldExpiry ? format(oldExpiry, "MMM d, yyyy") : "(no expiry)";
  const newStr = newExpiry ? format(newExpiry, "MMM d, yyyy") : "(no expiry)";
  
  await logActivity({
    username,
    action: "EDIT_EXPIRY",
    entity: "InventoryBatch",
    entityId: batchId,
    entityName: productName,
    details: `⚠️ Modified Expiry Date for "${productName}" from ${oldStr} to ${newStr}`,
    metadata: {
      product_id: productId,
      batch_id: batchId,
      old_expiry: oldExpiry?.toISOString() || null,
      new_expiry: newExpiry?.toISOString() || null,
    },
  });
}

/**
 * Log a batch quantity edit (HIGH RISK)
 */
export async function logBatchEdit(
  username: string,
  productId: number,
  productName: string,
  batchId: number,
  oldQuantity: number,
  newQuantity: number,
  reason: string
): Promise<void> {
  const change = newQuantity - oldQuantity;
  const changeStr = change > 0 ? `+${change}` : `${change}`;
  
  await logActivity({
    username,
    action: "EDIT_BATCH",
    entity: "InventoryBatch",
    entityId: batchId,
    entityName: productName,
    details: `⚠️ Batch #${batchId} quantity changed from ${oldQuantity} to ${newQuantity} (${changeStr}). Reason: ${reason}.`,
    metadata: {
      product_id: productId,
      batch_id: batchId,
      old_quantity: oldQuantity,
      new_quantity: newQuantity,
      quantity_change: change,
      reason,
    },
  });
}

/**
 * Log an order cancellation
 */
export async function logOrderCancel(
  username: string,
  orderId: number,
  orderValue: number,
  customerName?: string,
  reason?: string
): Promise<void> {
  let details = `Cancelled Order #${orderId}. Value: ₱${orderValue.toFixed(2)}.`;
  if (customerName) details += ` Customer: ${customerName}.`;
  if (reason) details += ` Reason: ${reason}.`;
  
  await logActivity({
    username,
    action: "ORDER_CANCEL",
    entity: "Order",
    entityId: orderId,
    entityName: `Order #${orderId}`,
    details,
    metadata: {
      order_value: orderValue,
      customer_name: customerName || null,
      reason: reason || null,
    },
  });
}
