"use server";

import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  loginSchema,
  vendorRegisterSchema,
  isEmail,
  type LoginInput,
  type VendorRegisterInput,
} from "@/lib/validations/auth";
import { AuthError } from "next-auth";

export type ActionResult = {
  success: boolean;
  error?: string;
  userType?: "staff" | "vendor";
};

/**
 * Unified login action
 * Accepts either username (staff) or email (vendor)
 * Returns userType for proper redirect handling
 */
export async function login(data: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) {
    // Get the first error message from Zod
    const firstError = parsed.error.errors?.[0]?.message || "Invalid input";
    return { success: false, error: firstError };
  }

  try {
    // Determine user type before signing in
    const { identifier } = parsed.data;
    let userType: "staff" | "vendor" = "staff";

    if (isEmail(identifier)) {
      // Check if this email belongs to a vendor
      const customer = await prisma.customer.findUnique({
        where: { email: identifier },
        select: { is_vendor: true },
      });
      if (customer?.is_vendor) {
        userType = "vendor";
      }
    }

    await signIn("credentials", {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      redirect: false,
    });

    return { success: true, userType };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: "Invalid username/email or password" };
    }
    throw error;
  }
}

/**
 * Vendor registration action
 */
export async function vendorRegister(data: VendorRegisterInput): Promise<ActionResult> {
  const parsed = vendorRegisterSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors?.[0]?.message ?? parsed.error.message ?? "Validation failed";
    return { success: false, error: firstError };
  }

  const { name, email, password, contactDetails } = parsed.data;

  // Check if email already exists
  const existingCustomer = await prisma.customer.findUnique({
    where: { email },
  });

  if (existingCustomer) {
    return { success: false, error: "An account with this email already exists" };
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create new vendor customer
  await prisma.customer.create({
    data: {
      name,
      email,
      password_hash: hashedPassword,
      contact_details: contactDetails || null,
      is_vendor: true,
    },
  });

  return { success: true };
}
