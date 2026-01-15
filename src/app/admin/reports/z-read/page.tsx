import { Suspense } from "react";
import { Receipt } from "lucide-react";
import { getZReadHistory } from "@/actions/reports";
import { ZReadReportClient } from "./z-read-client";
import { startOfMonth } from "date-fns";

export const metadata = {
  title: "Daily Sales Log | Christian Minimart",
  description: "Daily closure reports with sales breakdown",
};

export const dynamic = "force-dynamic";

async function ZReadContent() {
  // Default to "This Month" (1st of month to today)
  const today = new Date();
  const monthStart = startOfMonth(today);
  
  const data = await getZReadHistory({ from: monthStart, to: today });
  return <ZReadReportClient initialData={data} />;
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
