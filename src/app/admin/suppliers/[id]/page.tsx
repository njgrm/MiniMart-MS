import { notFound } from "next/navigation";
import { getSupplierDetails } from "@/actions/supplier";
import { SupplierDetailsClient } from "./supplier-details-client";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const result = await getSupplierDetails(parseInt(id));
  
  if (!result.success || !result.data) {
    return { title: "Supplier Not Found" };
  }

  return {
    title: `${result.data.name} | Suppliers | Christian Minimart`,
  };
}

export default async function SupplierDetailsPage({ params }: Props) {
  const { id } = await params;
  const supplierId = parseInt(id);
  
  if (isNaN(supplierId)) {
    notFound();
  }

  const result = await getSupplierDetails(supplierId);

  if (!result.success || !result.data) {
    notFound();
  }

  return <SupplierDetailsClient supplier={result.data} />;
}
