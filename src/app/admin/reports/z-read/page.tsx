import { Suspense } from "react";
import { Receipt } from "lucide-react";
import { getZReadHistory } from "@/actions/reports";
import { ZReadReportClient } from "./z-read-client";

export const metadata = {
  title: "Z-Read History | Christian Minimart",
  description: "Daily closure reports with sales breakdown",
};

export const dynamic = "force-dynamic";

async function ZReadContent() {
  const data = await getZReadHistory();
  return <ZReadReportClient data={data} />;
}

export default function ZReadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Receipt className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      }
    >
      <ZReadContent />
    </Suspense>
  );
}
