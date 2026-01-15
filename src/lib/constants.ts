/**
 * Shared constants for the application
 * These can be safely imported by both client and server components
 */

// ============================================================================
// Batch Status Constants
// ============================================================================

/** Batch status constants for the "Marked for Return" workflow */
export const BATCH_STATUS = {
  ACTIVE: "ACTIVE",
  MARKED_FOR_RETURN: "MARKED_FOR_RETURN",
  RETURNED: "RETURNED",
} as const;

export type BatchStatus = typeof BATCH_STATUS[keyof typeof BATCH_STATUS];

// ============================================================================
// Order Status Constants
// ============================================================================

export const ORDER_STATUS = {
  PENDING: "PENDING",
  PREPARING: "PREPARING",
  READY: "READY",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

// ============================================================================
// Stock Movement Types
// ============================================================================

export const STOCK_MOVEMENT_TYPE = {
  INITIAL_STOCK: "INITIAL_STOCK",
  RESTOCK: "RESTOCK",
  SALE: "SALE",
  ADJUSTMENT: "ADJUSTMENT",
  DAMAGE: "DAMAGE",
  RETURN: "RETURN",
  INTERNAL_USE: "INTERNAL_USE",
  ORDER_SHORTAGE: "ORDER_SHORTAGE",
  SUPPLIER_RETURN: "SUPPLIER_RETURN",
} as const;

export type StockMovementType = typeof STOCK_MOVEMENT_TYPE[keyof typeof STOCK_MOVEMENT_TYPE];
