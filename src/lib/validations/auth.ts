import { z } from "zod";

/**
 * Unified Login Schema
 * Accepts either username (for staff) or email (for vendors)
 */
export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Username or email is required")
    .max(100, "Must be less than 100 characters"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(100, "Password must be less than 100 characters"),
});

/**
 * Vendor Registration Schema
 * Used for new vendor sign-up
 */
export const vendorRegisterSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address"),
  password: z
    .string()
    .min(5, "Password must be at least 5 characters")
    .max(100, "Password must be less than 100 characters"),
  contactDetails: z
    .string()
    .max(200, "Contact details must be less than 200 characters")
    .optional(),
});

/**
 * Helper to check if identifier is an email
 */
export function isEmail(identifier: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
}

export type LoginInput = z.infer<typeof loginSchema>;
export type VendorRegisterInput = z.infer<typeof vendorRegisterSchema>;
