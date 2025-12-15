import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { VendorProfileClient } from "./profile-client";

/**
 * Vendor Profile Page
 */
export default async function VendorProfilePage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/login");
  }

  const customerId = parseInt(session.user.id);
  
  // Get customer details
  const customer = await prisma.customer.findUnique({
    where: { customer_id: customerId },
    select: {
      customer_id: true,
      name: true,
      email: true,
      contact_details: true,
    },
  });

  if (!customer) {
    redirect("/login");
  }

  return (
    <VendorProfileClient
      customer={{
        id: customer.customer_id,
        name: customer.name,
        email: customer.email || "",
        contact: customer.contact_details || "",
      }}
    />
  );
}

