import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import { getSalesByCategory } from "@/actions/reports";
import { SalesCategoryClient } from "./sales-category-client";

export const metadata = {
  title: "Sales by Category | Christian Minimart",
  description: "Revenue breakdown by product category with trend analysis",
};

export const dynamic = "force-dynamic";

async function CategoryContent() {
  const data = await getSalesByCategory();
  return <SalesCategoryClient data={data} />;
}

export default function SalesCategoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <BarChart3 className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      }
    >
      <CategoryContent />
    </Suspense>
  );
}
