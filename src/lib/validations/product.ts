import { z } from "zod";

/**
 * Product categories
 */
export const PRODUCT_CATEGORIES = [
  "SODA",
  "SOFTDRINKS_CASE",
  "SNACK",
  "CANNED_GOODS",
  "BEVERAGES",
  "DAIRY",
  "BREAD",
  "INSTANT_NOODLES",
  "CONDIMENTS",
  "PERSONAL_CARE",
  "HOUSEHOLD",
  "OTHER",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/**
 * Create Product Schema
 */
// Helper to allow File on client but not require it on server
const fileSchema = z.custom<File>((val) => {
  if (typeof File === "undefined") return false;
  return val instanceof File;
}, "Invalid file");

/**
 * Create Product Schema
 * 
 * Pricing Logic:
 * - retail_price = 0 means "Not available for Retail" (Wholesale only)
 * - wholesale_price = 0 means "Not available for Wholesale" (Retail only)
 * - At least one price must be > 0
 * 
 * Stock Movement:
 * - Creating a product automatically records an INITIAL_STOCK movement
 * - Supplier/receipt fields are optional for tracking initial stock source
 */
export const createProductSchema = z.object({
  product_name: z
    .string()
    .min(1, "Product name is required")
    .max(100, "Product name must be less than 100 characters"),
  category: z.enum(PRODUCT_CATEGORIES),
  retail_price: z
    .number()
    .min(0, "Retail price cannot be negative")
    .max(999999.99, "Retail price is too high"),
  wholesale_price: z
    .number()
    .min(0, "Wholesale price cannot be negative")
    .max(999999.99, "Wholesale price is too high"),
  cost_price: z
    .number()
    .min(0, "Cost price cannot be negative")
    .max(999999.99, "Cost price is too high")
    .default(0),
  initial_stock: z
    .number()
    .int("Initial stock must be a whole number")
    .min(0, "Initial stock cannot be negative"),
  reorder_level: z
    .number()
    .int("Reorder level must be a whole number")
    .min(0, "Reorder level cannot be negative")
    .default(10),
  barcode: z
    .string()
    .max(50, "Barcode must be less than 50 characters")
    .optional()
    .nullable(),
  image_url: z
    .union([
      z.string().max(500, "Image path must be less than 500 characters"),
      fileSchema,
    ])
    .optional()
    .nullable()
    .or(z.literal("")),
  // Optional: Stock movement tracking fields
  supplier_name: z
    .string()
    .max(200, "Supplier name must be less than 200 characters")
    .optional()
    .nullable(),
  reference: z
    .string()
    .max(100, "Reference must be less than 100 characters")
    .optional()
    .nullable(),
  receipt_image_url: z
    .string()
    .max(500, "Receipt image path must be less than 500 characters")
    .optional()
    .nullable(),
  // Optional: Expiry date for initial stock batch
  expiry_date: z
    .date()
    .optional()
    .nullable(),
});

/**
 * Update Product Schema
 * 
 * Pricing Logic:
 * - retail_price = 0 means "Not available for Retail" (Wholesale only)
 * - wholesale_price = 0 means "Not available for Wholesale" (Retail only)
 * - At least one price must be > 0
 */
export const updateProductSchema = z.object({
  product_id: z.number().int().positive(),
  product_name: z
    .string()
    .min(1, "Product name is required")
    .max(100, "Product name must be less than 100 characters"),
  category: z.enum(PRODUCT_CATEGORIES),
  retail_price: z
    .number()
    .min(0, "Retail price cannot be negative")
    .max(999999.99, "Retail price is too high"),
  wholesale_price: z
    .number()
    .min(0, "Wholesale price cannot be negative")
    .max(999999.99, "Wholesale price is too high"),
  cost_price: z
    .number()
    .min(0, "Cost price cannot be negative")
    .max(999999.99, "Cost price is too high")
    .optional()
    .default(0),
  current_stock: z
    .number()
    .int("Current stock must be a whole number")
    .min(0, "Current stock cannot be negative"),
  reorder_level: z
    .number()
    .int("Reorder level must be a whole number")
    .min(0, "Reorder level cannot be negative"),
  barcode: z
    .string()
    .max(50, "Barcode must be less than 50 characters")
    .optional()
    .nullable(),
  image_url: z
    .union([
      z.string().max(500, "Image path must be less than 500 characters"),
      fileSchema,
    ])
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
