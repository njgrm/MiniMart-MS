import { getExpiringReport } from "@/actions/reports";
import { getSuppliersForSelect } from "@/actions/supplier";
import { BatchReturnClient } from "./return-client";

export const metadata = {
  title: "Batch Return to Supplier | Christian Minimart",
  description: "Return expired or expiring batches to suppliers",
};

export default async function BatchReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ batchId?: string }>;
}) {
  const params = await searchParams;
  const preSelectedBatchId = params.batchId ? parseInt(params.batchId, 10) : null;

  // Fetch data server-side
  const [expiringData, suppliersResult] = await Promise.all([
    getExpiringReport(),
    getSuppliersForSelect(),
  ]);

  const suppliers = suppliersResult.success && suppliersResult.data ? suppliersResult.data : [];

  return (
    <BatchReturnClient
      expiringItems={expiringData.items}
      suppliers={suppliers}
      preSelectedBatchId={preSelectedBatchId}
    />
  );
}
