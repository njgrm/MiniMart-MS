"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export type BulkImportResult = {
  success: boolean;
  error?: string;
  data?: {
    suppliersCreated: number;
    suppliersSkipped: number;
    batchesCreated: number;
    batchesSkipped: number;
    returnsCreated: number;
    returnsSkipped: number;
  };
};

// CSV Row schemas
const supplierRowSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Supplier name is required"),
  contact_person: z.string().optional(),
  contact_number: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
});

const batchRowSchema = z.object({
  id: z.string().optional(),
  product_barcode: z.string().min(1, "Product barcode is required"),
  product_name: z.string().optional(), // For reference, not used
  quantity: z.string().transform((v) => parseInt(v, 10) || 0),
  expiry_date: z.string().optional(),
  received_date: z.string(),
  supplier_ref: z.string().optional(),
  supplier_name: z.string().optional(),
  supplier_id: z.string().optional(),
  cost_price: z.string().transform((v) => parseFloat(v) || 0),
  status: z.string().optional(),
});

const returnRowSchema = z.object({
  id: z.string().optional(),
  batch_id: z.string().optional(),
  product_barcode: z.string().min(1, "Product barcode is required"),
  product_name: z.string().optional(),
  supplier_id: z.string().optional(),
  supplier_name: z.string().optional(),
  movement_type: z.string().optional(),
  quantity_change: z.string().transform((v) => parseInt(v, 10) || 0),
  reason: z.string().optional(),
  reference: z.string().optional(),
  cost_price: z.string().transform((v) => parseFloat(v) || 0),
  created_at: z.string(),
});

// ============================================================================
// Helper Functions
// ============================================================================

function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx].trim().replace(/"/g, "");
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ============================================================================
// Import Actions
// ============================================================================

/**
 * Import suppliers from CSV content
 */
export async function importSuppliersFromCSV(csvContent: string): Promise<BulkImportResult> {
  try {
    const rows = parseCSV(csvContent);
    if (rows.length === 0) {
      return { success: false, error: "No valid rows found in CSV" };
    }

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const parsed = supplierRowSchema.safeParse(row);
      if (!parsed.success) {
        skipped++;
        continue;
      }

      const { name, contact_person, contact_number, email, address, notes, status } = parsed.data;

      // Check if supplier already exists
      const existing = await prisma.supplier.findUnique({
        where: { name },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.supplier.create({
        data: {
          name,
          contact_person: contact_person || null,
          contact_number: contact_number || null,
          email: email || null,
          address: address || null,
          notes: notes || null,
          status: status || "ACTIVE",
        },
      });
      created++;
    }

    revalidatePath("/admin/suppliers");
    revalidatePath("/admin/reports/suppliers");

    return {
      success: true,
      data: {
        suppliersCreated: created,
        suppliersSkipped: skipped,
        batchesCreated: 0,
        batchesSkipped: 0,
        returnsCreated: 0,
        returnsSkipped: 0,
      },
    };
  } catch (error) {
    console.error("Import suppliers error:", error);
    return { success: false, error: "Failed to import suppliers" };
  }
}

/**
 * Import inventory batches (deliveries) from CSV content
 */
export async function importBatchesFromCSV(csvContent: string): Promise<BulkImportResult> {
  try {
    const rows = parseCSV(csvContent);
    if (rows.length === 0) {
      return { success: false, error: "No valid rows found in CSV" };
    }

    // Pre-fetch all products and suppliers for lookup
    const products = await prisma.product.findMany({
      select: { product_id: true, barcode: true },
    });
    const productMap = new Map(products.map((p) => [p.barcode, p.product_id]));

    const suppliers = await prisma.supplier.findMany({
      select: { id: true, name: true },
    });
    const supplierMap = new Map(suppliers.map((s) => [s.name.toLowerCase(), s.id]));

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const parsed = batchRowSchema.safeParse(row);
      if (!parsed.success) {
        console.error("Batch parse error:", parsed.error);
        skipped++;
        continue;
      }

      const { product_barcode, quantity, expiry_date, received_date, supplier_ref, supplier_name, supplier_id, cost_price, status } = parsed.data;

      // Find product by barcode
      const productId = productMap.get(product_barcode);
      if (!productId) {
        skipped++;
        continue;
      }

      // Resolve supplier ID
      let resolvedSupplierId: number | null = null;
      if (supplier_id) {
        resolvedSupplierId = parseInt(supplier_id, 10);
      } else if (supplier_name) {
        resolvedSupplierId = supplierMap.get(supplier_name.toLowerCase()) || null;
      }

      // Parse dates
      const receivedDate = new Date(received_date);
      const expiryDate = expiry_date ? new Date(expiry_date) : null;

      if (isNaN(receivedDate.getTime())) {
        skipped++;
        continue;
      }

      await prisma.inventoryBatch.create({
        data: {
          product_id: productId,
          quantity,
          expiry_date: expiryDate,
          received_date: receivedDate,
          supplier_ref: supplier_ref || null,
          supplier_name: supplier_name || null,
          supplier_id: resolvedSupplierId,
          cost_price: cost_price || null,
          status: status || "ACTIVE",
        },
      });

      // Update inventory current stock
      await prisma.inventory.upsert({
        where: { product_id: productId },
        update: {
          current_stock: { increment: quantity },
          last_restock: receivedDate,
        },
        create: {
          product_id: productId,
          current_stock: quantity,
          last_restock: receivedDate,
        },
      });

      created++;
    }

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/suppliers");
    revalidatePath("/admin/reports/suppliers");

    return {
      success: true,
      data: {
        suppliersCreated: 0,
        suppliersSkipped: 0,
        batchesCreated: created,
        batchesSkipped: skipped,
        returnsCreated: 0,
        returnsSkipped: 0,
      },
    };
  } catch (error) {
    console.error("Import batches error:", error);
    return { success: false, error: "Failed to import inventory batches" };
  }
}

/**
 * Import supplier returns (stock movements) from CSV content
 */
export async function importReturnsFromCSV(csvContent: string): Promise<BulkImportResult> {
  try {
    const rows = parseCSV(csvContent);
    if (rows.length === 0) {
      return { success: false, error: "No valid rows found in CSV" };
    }

    // Pre-fetch products and suppliers
    const products = await prisma.product.findMany({
      include: { inventory: true },
    });
    const productMap = new Map(products.map((p) => [p.barcode, p]));

    const suppliers = await prisma.supplier.findMany({
      select: { id: true, name: true },
    });
    const supplierMap = new Map(suppliers.map((s) => [s.name.toLowerCase(), s.id]));

    // Get admin user for stock movement logging
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });
    if (!adminUser) {
      return { success: false, error: "No admin user found for logging" };
    }

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const parsed = returnRowSchema.safeParse(row);
      if (!parsed.success) {
        console.error("Return parse error:", parsed.error);
        skipped++;
        continue;
      }

      const { product_barcode, supplier_id, supplier_name, quantity_change, reason, reference, cost_price, created_at } = parsed.data;

      // Find product
      const product = productMap.get(product_barcode);
      if (!product || !product.inventory) {
        skipped++;
        continue;
      }

      // Resolve supplier ID
      let resolvedSupplierId: number | null = null;
      if (supplier_id) {
        resolvedSupplierId = parseInt(supplier_id, 10);
      } else if (supplier_name) {
        resolvedSupplierId = supplierMap.get(supplier_name.toLowerCase()) || null;
      }

      const createdAt = new Date(created_at);
      if (isNaN(createdAt.getTime())) {
        skipped++;
        continue;
      }

      const previousStock = product.inventory.current_stock;
      const newStock = Math.max(0, previousStock + quantity_change); // quantity_change is negative

      // Create stock movement
      await prisma.stockMovement.create({
        data: {
          inventory_id: product.inventory.inventory_id,
          user_id: adminUser.user_id,
          movement_type: "SUPPLIER_RETURN",
          quantity_change: quantity_change,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: reason || null,
          reference: reference || null,
          supplier_name: supplier_name || null,
          supplier_id: resolvedSupplierId,
          cost_price: cost_price || null,
          created_at: createdAt,
        },
      });

      // Update inventory
      await prisma.inventory.update({
        where: { inventory_id: product.inventory.inventory_id },
        data: { current_stock: newStock },
      });

      created++;
    }

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/suppliers");
    revalidatePath("/admin/reports/suppliers");

    return {
      success: true,
      data: {
        suppliersCreated: 0,
        suppliersSkipped: 0,
        batchesCreated: 0,
        batchesSkipped: 0,
        returnsCreated: created,
        returnsSkipped: skipped,
      },
    };
  } catch (error) {
    console.error("Import returns error:", error);
    return { success: false, error: "Failed to import supplier returns" };
  }
}

/**
 * Combined import for all three CSVs
 * Expects: { suppliers: string, batches: string, returns: string }
 */
export async function importAllSupplierData(data: {
  suppliers?: string;
  batches?: string;
  returns?: string;
}): Promise<BulkImportResult> {
  try {
    const result = {
      suppliersCreated: 0,
      suppliersSkipped: 0,
      batchesCreated: 0,
      batchesSkipped: 0,
      returnsCreated: 0,
      returnsSkipped: 0,
    };

    // Import suppliers first (so batches can reference them)
    if (data.suppliers) {
      const suppliersResult = await importSuppliersFromCSV(data.suppliers);
      if (suppliersResult.success && suppliersResult.data) {
        result.suppliersCreated = suppliersResult.data.suppliersCreated;
        result.suppliersSkipped = suppliersResult.data.suppliersSkipped;
      }
    }

    // Import batches
    if (data.batches) {
      const batchesResult = await importBatchesFromCSV(data.batches);
      if (batchesResult.success && batchesResult.data) {
        result.batchesCreated = batchesResult.data.batchesCreated;
        result.batchesSkipped = batchesResult.data.batchesSkipped;
      }
    }

    // Import returns
    if (data.returns) {
      const returnsResult = await importReturnsFromCSV(data.returns);
      if (returnsResult.success && returnsResult.data) {
        result.returnsCreated = returnsResult.data.returnsCreated;
        result.returnsSkipped = returnsResult.data.returnsSkipped;
      }
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("Import all supplier data error:", error);
    return { success: false, error: "Failed to import supplier data" };
  }
}
