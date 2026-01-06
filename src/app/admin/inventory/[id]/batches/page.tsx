import { notFound } from "next/navigation";
import { getProductForBatchAudit, getProductBatches } from "@/actions/inventory";
import { BatchAuditClient } from "./batch-audit-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BatchAuditPage({ params }: PageProps) {
  const { id } = await params;
  const productId = parseInt(id, 10);

  if (isNaN(productId)) {
    notFound();
  }

  const [product, batches] = await Promise.all([
    getProductForBatchAudit(productId),
    getProductBatches(productId),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <BatchAuditClient 
      product={product} 
      initialBatches={batches} 
    />
  );
}
