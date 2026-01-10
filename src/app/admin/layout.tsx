import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import AdminLayoutClient from "./layout-client";
import { getPendingOrdersCount } from "@/actions/orders";

/**
 * ⚡ Optimized Admin Layout
 * 
 * The layout auth check is unavoidable, but we stream the pending orders count
 * using Suspense so it doesn't block page navigation.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect("/login");
  }

  // Only allow staff (not vendors) to access admin
  if (session.user.userType !== "staff") {
    redirect("/");
  }

  // Stream the pending orders count - don't block layout render
  // The count will update when it loads
  return (
    <Suspense fallback={<AdminLayoutClient user={session.user} pendingOrdersCount={0}>{children}</AdminLayoutClient>}>
      <AdminLayoutWithOrders user={session.user}>{children}</AdminLayoutWithOrders>
    </Suspense>
  );
}

// Separate async component to stream the orders count
async function AdminLayoutWithOrders({ 
  user, 
  children 
}: { 
  user: NonNullable<Awaited<ReturnType<typeof auth>>>["user"];
  children: React.ReactNode;
}) {
  const pendingOrdersCount = await getPendingOrdersCount();
  
  return (
    <AdminLayoutClient user={user} pendingOrdersCount={pendingOrdersCount}>
      {children}
    </AdminLayoutClient>
  );
}


