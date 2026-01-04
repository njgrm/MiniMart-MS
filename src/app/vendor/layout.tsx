import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { VendorLayoutClient } from "./layout-client";

/**
 * Vendor Portal Layout
 * Separate layout for wholesale customers to place pre-orders
 */
export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect("/login");
  }

  // Only allow vendors to access this portal
  if (session.user.userType !== "vendor") {
    redirect("/admin");
  }

  return (
    <VendorLayoutClient 
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      }}
    >
      {children}
    </VendorLayoutClient>
  );
}


















