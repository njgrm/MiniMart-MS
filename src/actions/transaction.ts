"use server";

import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";

type PaymentMethod = "CASH" | "GCASH";
type CustomerType = "walkin" | "vendor";

interface TransactionItemInput {
  product_id: number;
  quantity: number;
  price: number;
}

interface CreateTransactionInput {
  items: TransactionItemInput[];
  customerType: CustomerType;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  change: number;
  userId?: number; // optional fallback
  customerId?: number | null;
  // Discount & Tax fields
  discountPercent?: number;
  discountAmount?: number;
  taxAmount?: number;
}

export async function createTransaction(input: CreateTransactionInput) {
  if (!input.items || input.items.length === 0) {
    return { success: false, error: "Cart is empty." };
  }

  // Basic validation
  const items = input.items.filter((i) => i.quantity > 0 && i.price >= 0);
  if (items.length === 0) {
    return { success: false, error: "No valid items." };
  }

  const userId = input.userId ?? 1; // TODO: wire to session

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Update inventory and validate stock
      for (const item of items) {
        const inventory = await tx.inventory.findUnique({
          where: { product_id: item.product_id },
          select: { current_stock: true },
        });

        if (!inventory || inventory.current_stock < item.quantity) {
          throw new Error("Insufficient stock for one or more items.");
        }

        await tx.inventory.update({
          where: { product_id: item.product_id },
          data: { current_stock: { decrement: item.quantity } },
        });
      }

      // Calculate subtotal from items
      const subtotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      
      // Apply discount and tax if provided
      const discountAmt = input.discountAmount ?? 0;
      const taxAmt = input.taxAmount ?? 0;
      const totalAmount = subtotal - discountAmt + taxAmt;

      const transaction = await tx.transaction.create({
        data: {
          user_id: userId,
          customer_id: input.customerId ?? null,
          total_amount: new Decimal(totalAmount),
          status: "COMPLETED",
          items: {
            create: items.map((item) => ({
              product_id: item.product_id,
              quantity: item.quantity,
              price_at_sale: new Decimal(item.price),
              subtotal: new Decimal(item.price * item.quantity),
            })),
          },
          payment: {
            create: {
              payment_method: input.paymentMethod,
              amount_tendered: new Decimal(input.amountTendered),
              change: new Decimal(input.change),
            },
          },
        },
      });

      return transaction;
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin");

    return { success: true, data: result };
  } catch (error: any) {
    console.error("createTransaction error", error);
    return { success: false, error: error?.message ?? "Failed to process transaction." };
  }
}







