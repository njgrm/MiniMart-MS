"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export type ActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

export interface SupplierInfo {
  id: number;
  name: string;
  contact_person: string | null;
  contact_number: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  // Stats
  total_batches: number;
  total_returns: number;
  last_delivery_date: Date | null;
}

export interface SupplierDetails extends SupplierInfo {
  deliveries: {
    id: number;
    product_name: string;
    quantity: number;
    cost_price: number | null;
    received_date: Date;
    expiry_date: Date | null;
    batch_number: string | null;
  }[];
  returns: {
    id: number;
    product_name: string;
    quantity_change: number;
    reason: string | null;
    created_at: Date;
  }[];
}

// ============================================================================
// Validation Schemas
// ============================================================================

const createSupplierSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  contact_person: z.string().optional(),
  contact_number: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
});

const updateSupplierSchema = createSupplierSchema.partial().extend({
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

// ============================================================================
// CRUD Actions
// ============================================================================

/**
 * Get all suppliers with basic stats
 */
export async function getSuppliers(): Promise<ActionResult<SupplierInfo[]>> {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            batches: true,
            stockMovements: {
              where: { movement_type: "SUPPLIER_RETURN" },
            },
          },
        },
        batches: {
          orderBy: { received_date: "desc" },
          take: 1,
          select: { received_date: true },
        },
      },
    });

    const result: SupplierInfo[] = suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      contact_person: s.contact_person,
      contact_number: s.contact_number,
      email: s.email,
      address: s.address,
      notes: s.notes,
      status: s.status,
      created_at: s.created_at,
      updated_at: s.updated_at,
      total_batches: s._count.batches,
      total_returns: s._count.stockMovements,
      last_delivery_date: s.batches[0]?.received_date || null,
    }));

    return { success: true, data: result };
  } catch (error) {
    console.error("Get suppliers error:", error);
    return { success: false, error: "Failed to fetch suppliers" };
  }
}

/**
 * Get supplier details with deliveries and returns
 */
export async function getSupplierDetails(
  supplierId: number
): Promise<ActionResult<SupplierDetails>> {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        batches: {
          orderBy: { received_date: "desc" },
          take: 50,
          include: {
            product: {
              select: { product_name: true },
            },
          },
        },
        stockMovements: {
          where: { movement_type: "SUPPLIER_RETURN" },
          orderBy: { created_at: "desc" },
          take: 50,
          include: {
            inventory: {
              include: {
                product: {
                  select: { product_name: true },
                },
              },
            },
          },
        },
        _count: {
          select: {
            batches: true,
            stockMovements: {
              where: { movement_type: "SUPPLIER_RETURN" },
            },
          },
        },
      },
    });

    if (!supplier) {
      return { success: false, error: "Supplier not found" };
    }

    const result: SupplierDetails = {
      id: supplier.id,
      name: supplier.name,
      contact_person: supplier.contact_person,
      contact_number: supplier.contact_number,
      email: supplier.email,
      address: supplier.address,
      notes: supplier.notes,
      status: supplier.status,
      created_at: supplier.created_at,
      updated_at: supplier.updated_at,
      total_batches: supplier._count.batches,
      total_returns: supplier._count.stockMovements,
      last_delivery_date: supplier.batches[0]?.received_date || null,
      deliveries: supplier.batches.map((b) => ({
        id: b.id,
        product_name: b.product.product_name,
        quantity: b.quantity,
        cost_price: b.cost_price ? Number(b.cost_price) : null,
        received_date: b.received_date,
        expiry_date: b.expiry_date,
        batch_number: b.supplier_ref,
      })),
      returns: supplier.stockMovements.map((m) => ({
        id: m.id,
        product_name: m.inventory.product.product_name,
        quantity_change: m.quantity_change,
        reason: m.reason,
        created_at: m.created_at,
      })),
    };

    return { success: true, data: result };
  } catch (error) {
    console.error("Get supplier details error:", error);
    return { success: false, error: "Failed to fetch supplier details" };
  }
}

/**
 * Create a new supplier
 */
export async function createSupplier(
  input: z.infer<typeof createSupplierSchema>
): Promise<ActionResult<{ id: number; name: string }>> {
  try {
    const parsed = createSupplierSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    // Check for duplicate name
    const existing = await prisma.supplier.findUnique({
      where: { name: parsed.data.name },
    });

    if (existing) {
      return { success: false, error: "A supplier with this name already exists" };
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: parsed.data.name,
        contact_person: parsed.data.contact_person || null,
        contact_number: parsed.data.contact_number || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
      },
    });

    revalidatePath("/admin/suppliers");

    return {
      success: true,
      data: { id: supplier.id, name: supplier.name },
    };
  } catch (error) {
    console.error("Create supplier error:", error);
    return { success: false, error: "Failed to create supplier" };
  }
}

/**
 * Update a supplier
 */
export async function updateSupplier(
  supplierId: number,
  input: z.infer<typeof updateSupplierSchema>
): Promise<ActionResult<{ id: number; name: string }>> {
  try {
    const parsed = updateSupplierSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    // Check if supplier exists
    const existing = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!existing) {
      return { success: false, error: "Supplier not found" };
    }

    // Check for duplicate name if changing
    if (parsed.data.name && parsed.data.name !== existing.name) {
      const duplicate = await prisma.supplier.findUnique({
        where: { name: parsed.data.name },
      });
      if (duplicate) {
        return { success: false, error: "A supplier with this name already exists" };
      }
    }

    const supplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ...(parsed.data.name && { name: parsed.data.name }),
        ...(parsed.data.contact_person !== undefined && {
          contact_person: parsed.data.contact_person || null,
        }),
        ...(parsed.data.contact_number !== undefined && {
          contact_number: parsed.data.contact_number || null,
        }),
        ...(parsed.data.email !== undefined && { email: parsed.data.email || null }),
        ...(parsed.data.address !== undefined && { address: parsed.data.address || null }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes || null }),
        ...(parsed.data.status && { status: parsed.data.status }),
      },
    });

    revalidatePath("/admin/suppliers");
    revalidatePath(`/admin/suppliers/${supplierId}`);

    return {
      success: true,
      data: { id: supplier.id, name: supplier.name },
    };
  } catch (error) {
    console.error("Update supplier error:", error);
    return { success: false, error: "Failed to update supplier" };
  }
}

/**
 * Archive/Unarchive a supplier
 */
export async function toggleSupplierStatus(
  supplierId: number
): Promise<ActionResult<{ id: number; status: string }>> {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return { success: false, error: "Supplier not found" };
    }

    const newStatus = supplier.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: { status: newStatus },
    });

    revalidatePath("/admin/suppliers");

    return {
      success: true,
      data: { id: updated.id, status: updated.status },
    };
  } catch (error) {
    console.error("Toggle supplier status error:", error);
    return { success: false, error: "Failed to update supplier status" };
  }
}

/**
 * Get suppliers for dropdown (simple list)
 */
export async function getSuppliersForSelect(): Promise<
  ActionResult<{ id: number; name: string }[]>
> {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return { success: true, data: suppliers };
  } catch (error) {
    console.error("Get suppliers for select error:", error);
    return { success: false, error: "Failed to fetch suppliers" };
  }
}

/**
 * Backfill suppliers from existing batch data
 * Creates Supplier records for unique supplier_name values in InventoryBatch
 */
export async function backfillSuppliersFromBatches(): Promise<
  ActionResult<{ created: number; linked: number }>
> {
  try {
    // Get unique supplier names from batches
    const uniqueSuppliers = await prisma.inventoryBatch.findMany({
      where: {
        supplier_name: { not: null },
        supplier_id: null, // Only unlinked batches
      },
      distinct: ["supplier_name"],
      select: { supplier_name: true },
    });

    let created = 0;
    let linked = 0;

    for (const { supplier_name } of uniqueSuppliers) {
      if (!supplier_name) continue;

      // Check if supplier exists
      let supplier = await prisma.supplier.findUnique({
        where: { name: supplier_name },
      });

      // Create if not exists
      if (!supplier) {
        supplier = await prisma.supplier.create({
          data: { name: supplier_name },
        });
        created++;
      }

      // Link all batches with this supplier name
      const updateResult = await prisma.inventoryBatch.updateMany({
        where: {
          supplier_name: supplier_name,
          supplier_id: null,
        },
        data: { supplier_id: supplier.id },
      });

      linked += updateResult.count;
    }

    revalidatePath("/admin/suppliers");

    return {
      success: true,
      data: { created, linked },
    };
  } catch (error) {
    console.error("Backfill suppliers error:", error);
    return { success: false, error: "Failed to backfill suppliers" };
  }
}
