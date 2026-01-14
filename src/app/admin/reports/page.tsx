import { Suspense } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Package,
  AlertTriangle,
  FileText,
  ShieldAlert,
  BarChart3,
  Clock,
  DollarSign,
  Trash2,
  Activity,
  ArrowRight,
  Archive,
  Receipt,
  Users,
  CalendarClock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Reports | Christian Minimart",
  description: "Business reports and analytics exports",
};

// Report card configuration
interface ReportCardConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  href: string;
  badge?: { label: string; variant: "default" | "secondary" | "destructive" | "outline" };
}

// Group reports by category
const reportGroups: {
  title: string;
  description: string;
  icon: React.ElementType;
  reports: ReportCardConfig[];
}[] = [
  {
    title: "Sales & Financial",
    description: "Revenue tracking, profit analysis, and transaction history",
    icon: DollarSign,
    reports: [
      {
        id: "z-read",
        title: "Z-Read History",
        description: "Daily closure reports with gross sales, payment breakdown, and void transactions",
        icon: Receipt,
        iconColor: "text-[#2EAFC5]",
        iconBg: "bg-[#e6f7fa]",
        href: "/admin/reports/z-read",
        badge: { label: "Daily", variant: "outline" as const },
      },
      {
        id: "profit-margin",
        title: "Profit Margin Analysis",
        description: "Compare cost vs retail price, identify low-margin products needing repricing",
        icon: TrendingUp,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-100",
        href: "/admin/reports/profit-margin",
      },
      {
        id: "sales-by-category",
        title: "Sales by Category",
        description: "Revenue breakdown by product category with trend analysis",
        icon: BarChart3,
        iconColor: "text-purple-600",
        iconBg: "bg-purple-100",
        href: "/admin/reports/sales-category",
      },
    ],
  },
  {
    title: "Inventory Health",
    description: "Stock movement, velocity, and wastage tracking",
    icon: Package,
    reports: [
      {
        id: "inventory-velocity",
        title: "Inventory Velocity",
        description: "Identify Dead Stock (0 sales in 30 days) vs Fast Movers for Dynamic ROP optimization",
        icon: Activity,
        iconColor: "text-orange-600",
        iconBg: "bg-orange-100",
        href: "/admin/reports/velocity",
        badge: { label: "Critical", variant: "secondary" as const },
      },
      {
        id: "spoilage-wastage",
        title: "Spoilage & Wastage",
        description: "Track damaged, expired, and returned stock. Proves FEFO system captures loss",
        icon: Trash2,
        iconColor: "text-red-600",
        iconBg: "bg-red-100",
        href: "/admin/reports/spoilage",
        badge: { label: "Loss Prevention", variant: "destructive" as const },
      },
      {
        id: "expiry-tracker",
        title: "Expiry Tracker",
        description: "Products expiring within 7, 14, and 30 days with batch details",
        icon: CalendarClock,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-100",
        href: "/admin/reports/expiry",
      },
    ],
  },
  {
    title: "Audit & Security",
    description: "Administrative actions, user activity, and compliance logs",
    icon: ShieldAlert,
    reports: [
      {
        id: "audit-log",
        title: "Audit Log Report",
        description: "All administrative actions: stock adjustments, price changes, user management",
        icon: FileText,
        iconColor: "text-slate-600",
        iconBg: "bg-slate-100",
        href: "/admin/audit-logs",
      },
      {
        id: "user-activity",
        title: "User Activity",
        description: "Transaction count and sales volume by cashier for performance tracking",
        icon: Users,
        iconColor: "text-indigo-600",
        iconBg: "bg-indigo-100",
        href: "/admin/reports/user-activity",
      },
      {
        id: "stock-movements",
        title: "Stock Movement History",
        description: "Complete audit trail of all inventory changes with reasons and references",
        icon: Archive,
        iconColor: "text-teal-600",
        iconBg: "bg-teal-100",
        href: "/admin/reports/stock-movements",
      },
    ],
  },
];

function ReportCard({ report }: { report: ReportCardConfig }) {
  const Icon = report.icon;
  
  return (
    <Link href={report.href} className="group">
      <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/30 bg-[#F8F6F1]">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className={`p-2.5 rounded-lg ${report.iconBg}`}>
              <Icon className={`h-5 w-5 ${report.iconColor}`} />
            </div>
            {report.badge && (
              <Badge variant={report.badge.variant} className="text-xs">
                {report.badge.label}
              </Badge>
            )}
          </div>
          <CardTitle className="text-base font-semibold text-[#2d1b1a] mt-3 group-hover:text-primary transition-colors">
            {report.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <CardDescription className="text-sm text-muted-foreground line-clamp-2">
            {report.description}
          </CardDescription>
          <div className="mt-4 flex items-center text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View Report
            <ArrowRight className="h-3 w-3 ml-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ReportGroup({ group }: { group: (typeof reportGroups)[0] }) {
  const Icon = group.icon;
  
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#F8F6F1] border">
          <Icon className="h-5 w-5 text-[#2d1b1a]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#2d1b1a]">{group.title}</h2>
          <p className="text-sm text-muted-foreground">{group.description}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {group.reports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </section>
  );
}

export default function ReportsPage() {
  return (
    <div className="space-y-8 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#2d1b1a]">Reports</h1>
            <p className="text-muted-foreground">
              Generate and export business reports for analysis and record-keeping
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Clock className="h-3 w-3" />
              Last updated: {new Date().toLocaleDateString()}
            </Badge>
          </div>
        </div>
      </div>

      {/* Quick Actions Banner */}
      <Card className="bg-gradient-to-r from-[#2EAFC5]/10 to-[#2EAFC5]/5 border-[#2EAFC5]/30">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#2EAFC5]/20">
                <FileText className="h-5 w-5 text-[#2EAFC5]" />
              </div>
              <div>
                <p className="font-medium text-[#2d1b1a]">Digital First, Paper Ready</p>
                <p className="text-sm text-muted-foreground">
                  Preview reports on screen, then print or export to Excel
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/analytics">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics Dashboard
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Groups */}
      <div className="space-y-10">
        {reportGroups.map((group) => (
          <ReportGroup key={group.title} group={group} />
        ))}
      </div>

      {/* Footer Note */}
      <div className="text-center text-sm text-muted-foreground py-4 border-t">
        <p>
          All reports support <strong>Print</strong> (A4 format) and <strong>Export to Excel</strong> (.xlsx)
        </p>
      </div>
    </div>
  );
}
