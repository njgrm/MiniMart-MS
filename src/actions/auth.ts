"use server";

import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  loginSchema,
  vendorRegisterSchema,
  type LoginInput,
  type VendorRegisterInput,
} from "@/lib/validations/auth";
import { AuthError } from "next-auth";

export type ActionResult = {
  success: boolean;
  error?: string;
};

/**
 * Unified login action
 * Accepts either username (staff) or email (vendor)
 */
export async function login(data: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    await signIn("credentials", {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      redirect: false,
    });
    return { success: true };
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
    return { success: false, error: parsed.error.errors[0].message };
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
