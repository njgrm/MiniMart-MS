import { notFound } from "next/navigation";
import { getSingleSupplierAnalytics } from "@/actions/reports";
import { SupplierAnalyticsClient } from "./supplier-analytics-client";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const result = await getSingleSupplierAnalytics(parseInt(id));
  
  if (!result.success || !result.data) {
    return { title: "Supplier Analytics Not Found" };
  }

  return {
    title: `${result.data.supplier.name} Analytics | Suppliers | Christian Minimart`,
  };
}

export default async function SupplierAnalyticsPage({ params }: Props) {
  const { id } = await params;
  const supplierId = parseInt(id);
  
  if (isNaN(supplierId)) {
    notFound();
  }

  const result = await getSingleSupplierAnalytics(supplierId);

  if (!result.success || !result.data) {
    notFound();
  }

  return <SupplierAnalyticsClient data={result.data} />;
}
