import { Suspense } from "react";
import { TrendingUp } from "lucide-react";
import { getMarginAnalysis } from "@/actions/reports";
import { ProfitMarginClient } from "./profit-margin-client";

export const metadata = {
  title: "Profit Margin Analysis | Christian Minimart",
  description: "Compare cost vs retail price and identify low-margin products",
};

export const dynamic = "force-dynamic";

async function MarginContent() {
  const data = await getMarginAnalysis();
  return <ProfitMarginClient data={data} />;
}

export default function ProfitMarginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <TrendingUp className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      }
    >
      <MarginContent />
    </Suspense>
  );
}
