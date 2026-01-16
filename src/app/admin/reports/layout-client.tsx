"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Receipt,
  TrendingUp,
  BarChart3,
  Activity,
  Building2,
  CalendarClock,
  ChevronLeft,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubLink {
  id: string;
  title: string;
  href: string;
  icon: React.ElementType;
}

interface ReportLink {
  id: string;
  title: string;
  href: string;
  icon: React.ElementType;
  category: string;
  subLinks?: SubLink[];
}

// Report navigation links with nested sub-links
const reportLinks: ReportLink[] = [
  { id: "z-read", title: "Daily Sales", href: "/admin/reports/z-read", icon: Receipt, category: "sales" },
  { id: "profit-margin", title: "Profit Margin", href: "/admin/reports/profit-margin", icon: TrendingUp, category: "sales" },
  { id: "sales-category", title: "Sales by Category", href: "/admin/reports/sales-category", icon: BarChart3, category: "sales" },
  { id: "velocity", title: "Velocity", href: "/admin/reports/velocity", icon: Activity, category: "inventory" },
  { id: "suppliers", title: "Suppliers", href: "/admin/reports/suppliers", icon: Building2, category: "inventory" },
  { 
    id: "expiring", 
    title: "Expiry", 
    href: "/admin/reports/expiring", 
    icon: CalendarClock, 
    category: "inventory",
    subLinks: [
      { id: "batch-returns", title: "Batch Returns", href: "/admin/reports/expiring/return", icon: RotateCcw },
    ],
  },
];

const categoryColors: Record<string, string> = {
  sales: "text-[#2EAFC5]",
  inventory: "text-[#F1782F]",
  audit: "text-stone-500",
};

export function ReportsLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isReportIndex = pathname === "/admin/reports";

  // Main reports page - page.tsx has its own sidebar/toolbar
  if (isReportIndex) {
    return (
      <div className=" h-full overflow-hidden">
        {children}
      </div>
    );
  }

  // Individual report pages - show sidebar layout
  return (
    <div className="flex h-full overflow-hidden">
      {/* Reports Sidebar Navigation - Hidden on mobile */}
      <aside className="w-48 shrink-0 border-r border-stone-200/80 bg-card hidden lg:flex lg:flex-col">
        {/* Back Button - Height matches toolbar h-12 */}
        <div className="h-14 px-2 flex items-center border-b border-stone-200/80 shrink-0">
          <Button variant="ghost" size="sm" asChild className="h-10 px-2 gap-2 text-sm w-full justify-start">
            <Link href="/admin/reports">
              <ChevronLeft className="h-4 w-4" />
              All Reports
            </Link>
          </Button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-auto py-2 px-2">
          {reportLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            const hasSubLinks = link.subLinks && link.subLinks.length > 0;
            
            return (
              <div key={link.id}>
                <Link
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors mb-1",
                    isActive 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "" : categoryColors[link.category])} />
                  <span className="truncate">{link.title}</span>
                </Link>
                {/* Sub-links - Always visible */}
                {hasSubLinks && (
                  <div className="ml-4 pl-3 border-l border-border mb-1">
                    {link.subLinks!.map((subLink) => {
                      const SubIcon = subLink.icon;
                      const isSubActive = pathname === subLink.href;
                      return (
                        <Link
                          key={subLink.id}
                          href={subLink.href}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors",
                            isSubActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          <SubIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{subLink.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}
