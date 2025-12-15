import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminLayoutClient from "./layout-client";
import { getPendingOrdersCount } from "@/actions/orders";

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

  // Get pending orders count for sidebar badge
  const pendingOrdersCount = await getPendingOrdersCount();

  return (
    <AdminLayoutClient user={session.user} pendingOrdersCount={pendingOrdersCount}>
      {children}
    </AdminLayoutClient>
  );
}


