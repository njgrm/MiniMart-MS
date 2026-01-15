"use server";

import { signIn, signOut } from "@/auth";
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
import { logLogin, logLogout, logLoginFailed, logVendorRegister } from "@/lib/logger";

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
    const { identifier, password } = parsed.data;
    let userType: "staff" | "vendor" = "staff";
    let userId: number | undefined;
    let email: string | undefined;
    let userExists = false;
    let passwordValid = false;

    if (isEmail(identifier)) {
      // Check if this email belongs to a vendor
      const customer = await prisma.customer.findUnique({
        where: { email: identifier },
        select: { customer_id: true, is_vendor: true, email: true, password_hash: true },
      });
      if (customer?.is_vendor) {
        userExists = true;
        userType = "vendor";
        userId = customer.customer_id;
        email = customer.email || undefined;
        // Check password
        if (customer.password_hash) {
          passwordValid = await bcrypt.compare(password, customer.password_hash);
        }
      }
    } else {
      // Staff login - get user by username
      const user = await prisma.user.findUnique({
        where: { username: identifier },
        select: { user_id: true, password_hash: true },
      });
      if (user) {
        userExists = true;
        userId = user.user_id;
        // Check password
        if (user.password_hash) {
          passwordValid = await bcrypt.compare(password, user.password_hash);
        }
      }
    }

    // Log failed attempt if user not found
    if (!userExists) {
      await logLoginFailed(identifier, "user_not_found");
      return { success: false, error: "Invalid username/email or password" };
    }

    // Log failed attempt if wrong password
    if (!passwordValid) {
      await logLoginFailed(identifier, "wrong_password");
      return { success: false, error: "Invalid username/email or password" };
    }

    await signIn("credentials", {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      redirect: false,
    });

    // Log successful login
    await logLogin(identifier, userType, userId, email);

    return { success: true, userType };
  } catch (error) {
    if (error instanceof AuthError) {
      // Log failed attempt for auth errors
      await logLoginFailed(parsed.data.identifier, "unknown");
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
  const newVendor = await prisma.customer.create({
    data: {
      name,
      email,
      password_hash: hashedPassword,
      contact_details: contactDetails || null,
      is_vendor: true,
    },
  });

  // Log the vendor registration
  await logVendorRegister(newVendor.customer_id, name, email, contactDetails);

  return { success: true };
}

/**
 * Logout action with audit logging
 */
export async function logout(username: string, userType: "staff" | "vendor"): Promise<ActionResult> {
  try {
    // Log the logout event before signing out
    await logLogout(username, userType);
    
    await signOut({ redirect: false });
    
    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: false, error: "Failed to logout" };
  }
}
