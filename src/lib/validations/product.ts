import { z } from "zod";

/**
 * Product categories
 */
export const PRODUCT_CATEGORIES = [
  "SODA",
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

export const createProductSchema = z.object({
  product_name: z
    .string()
    .min(1, "Product name is required")
    .max(100, "Product name must be less than 100 characters"),
  category: z.enum(PRODUCT_CATEGORIES, {
    required_error: "Category is required",
  }),
  retail_price: z
    .number({ invalid_type_error: "Retail price must be a number" })
    .positive("Retail price must be positive")
    .multipleOf(0.01, "Retail price can have at most 2 decimal places"),
  wholesale_price: z
    .number({ invalid_type_error: "Wholesale price must be a number" })
    .positive("Wholesale price must be positive")
    .multipleOf(0.01, "Wholesale price can have at most 2 decimal places"),
  initial_stock: z
    .number({ invalid_type_error: "Initial stock must be a number" })
    .int("Initial stock must be a whole number")
    .nonnegative("Initial stock cannot be negative"),
  reorder_level: z
    .number({ invalid_type_error: "Reorder level must be a number" })
    .int("Reorder level must be a whole number")
    .nonnegative("Reorder level cannot be negative")
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
});

/**
 * Update Product Schema
 */
export const updateProductSchema = z.object({
  product_id: z.number().int().positive(),
  product_name: z
    .string()
    .min(1, "Product name is required")
    .max(100, "Product name must be less than 100 characters"),
  category: z.enum(PRODUCT_CATEGORIES, {
    required_error: "Category is required",
  }),
  retail_price: z
    .number({ invalid_type_error: "Retail price must be a number" })
    .positive("Retail price must be positive")
    .multipleOf(0.01, "Retail price can have at most 2 decimal places"),
  wholesale_price: z
    .number({ invalid_type_error: "Wholesale price must be a number" })
    .positive("Wholesale price must be positive")
    .multipleOf(0.01, "Wholesale price can have at most 2 decimal places"),
  current_stock: z
    .number({ invalid_type_error: "Current stock must be a number" })
    .int("Current stock must be a whole number")
    .nonnegative("Current stock cannot be negative"),
  reorder_level: z
    .number({ invalid_type_error: "Reorder level must be a number" })
    .int("Reorder level must be a whole number")
    .nonnegative("Reorder level cannot be negative"),
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
