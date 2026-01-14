import { Suspense } from "react";
import { getVelocityReport } from "@/actions/reports";
import { VelocityReportClient } from "./velocity-client";

export const metadata = {
  title: "Inventory Velocity Report | Christian Minimart",
  description: "Identify Dead Stock vs Fast Movers for Dynamic ROP optimization",
};

export const dynamic = "force-dynamic";

export default async function VelocityReportPage() {
  const data = await getVelocityReport();

  return (
    <Suspense fallback={<div className="p-6">Loading report...</div>}>
      <VelocityReportClient data={data} />
    </Suspense>
  );
}
