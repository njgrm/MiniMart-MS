"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Receipt, BarChart3 } from "lucide-react";

/**
 * Sales Layout - Provides sub-navigation tabs for Sales section
 * Tabs: Transactions | Financial Breakdown
 */
export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    {
      name: "Transactions",
      href: "/admin/sales",
      icon: Receipt,
      active: pathname === "/admin/sales",
    },
    {
      name: "Financial Breakdown",
      href: "/admin/sales/financial",
      icon: BarChart3,
      active: pathname === "/admin/sales/financial",
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Sub-Navigation Tabs */}
      <div className="shrink-0 border-b border-border bg-transparent px-1">
        <nav className="flex gap-1" aria-label="Sales navigation">
          {tabs.map((tab) => (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative",
                tab.active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
              {tab.active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
              )}
            </Link>
          ))}
        </nav>
      </div>

      {/* Page Content */}
      <div className="flex-1 min-h-0 p-4">
        {children}
      </div>
    </div>
  );
}



