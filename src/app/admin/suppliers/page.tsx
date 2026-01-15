import { getSuppliers } from "@/actions/supplier";
import { SuppliersClient } from "./suppliers-client";

export const metadata = {
  title: "Suppliers | Christian Minimart",
  description: "Manage supplier relationships and view delivery history",
};

export default async function SuppliersPage() {
  const result = await getSuppliers();
  
  const suppliers = result.success ? result.data ?? [] : [];

  return <SuppliersClient initialSuppliers={suppliers} />;
}
