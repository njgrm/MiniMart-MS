"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Store Settings Server Actions
 * 
 * These actions manage store-wide settings like the GCash QR code.
 * The StoreSettings table is designed as a singleton (single row).
 */

export interface StoreSettings {
  id: number;
  gcash_qr_image_url: string | null;
  store_name: string;
  store_address: string | null;
  store_contact: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Get store settings.
 * If no settings exist, create a default entry and return it.
 */
export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    // Try to find existing settings
    let settings = await prisma.storeSettings.findFirst();
    
    // If none exists, create default settings
    if (!settings) {
      settings = await prisma.storeSettings.create({
        data: {
          store_name: "Christian Minimart",
        },
      });
    }
    
    return settings;
  } catch (error) {
    console.error("[settings] Error fetching store settings:", error);
    throw new Error("Failed to fetch store settings");
  }
}

/**
 * Update the GCash QR code image URL.
 * @param url - The new URL/path for the GCash QR code image
 */
export async function updateGcashQr(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get or create settings first
    let settings = await prisma.storeSettings.findFirst();
    
    if (!settings) {
      // Create with the QR code
      await prisma.storeSettings.create({
        data: {
          store_name: "Christian Minimart",
          gcash_qr_image_url: url,
        },
      });
    } else {
      // Update existing settings
      await prisma.storeSettings.update({
        where: { id: settings.id },
        data: { gcash_qr_image_url: url },
      });
    }
    
    // Revalidate paths that might display this data
    revalidatePath("/admin/pos");
    revalidatePath("/admin/settings");
    
    return { success: true };
  } catch (error) {
    console.error("[settings] Error updating GCash QR:", error);
    return { success: false, error: "Failed to update GCash QR code" };
  }
}

/**
 * Update store information.
 * @param data - Partial store settings to update
 */
export async function updateStoreInfo(data: {
  store_name?: string;
  store_address?: string;
  store_contact?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    let settings = await prisma.storeSettings.findFirst();
    
    if (!settings) {
      await prisma.storeSettings.create({
        data: {
          store_name: data.store_name ?? "Christian Minimart",
          store_address: data.store_address,
          store_contact: data.store_contact,
        },
      });
    } else {
      await prisma.storeSettings.update({
        where: { id: settings.id },
        data,
      });
    }
    
    revalidatePath("/admin/settings");
    
    return { success: true };
  } catch (error) {
    console.error("[settings] Error updating store info:", error);
    return { success: false, error: "Failed to update store information" };
  }
}




























