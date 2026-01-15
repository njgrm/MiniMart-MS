import { Suspense } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Trash2,
  Activity,
  Receipt,
  Users,
  CalendarClock,
  FileText,
  Archive,
  Download,
  ExternalLink,
  CreditCard,
  Banknote,
  AlertTriangle,
  Snowflake,
  Clock,
  CheckCircle2,
  ChevronLeft,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  getEnhancedDashboardData, 
  type EnhancedDashboardData,
  type TopCategoryData,
  type TopDeadStockItem,
} from "@/actions/reports";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MiniSparkline } from "@/components/reports/mini-sparkline";

export const metadata = {
  title: "Reports | Christian Minimart",
  description: "Business reports command center",
};

// Report navigation links (same as layout-client.tsx)
const reportLinks = [
  { id: "z-read", title: "Daily Sales", href: "/admin/reports/z-read", icon: Receipt, category: "sales" },
  { id: "profit-margin", title: "Profit Margin", href: "/admin/reports/profit-margin", icon: TrendingUp, category: "sales" },
  { id: "sales-category", title: "Sales by Category", href: "/admin/reports/sales-category", icon: BarChart3, category: "sales" },
  { id: "velocity", title: "Velocity", href: "/admin/reports/velocity", icon: Activity, category: "inventory" },
  { id: "spoilage", title: "Spoilage", href: "/admin/reports/spoilage", icon: Trash2, category: "inventory" },
  { id: "expiring", title: "Expiry", href: "/admin/reports/expiring", icon: CalendarClock, category: "inventory" },
  { id: "audit-logs", title: "Audit Log", href: "/admin/audit-logs", icon: FileText, category: "audit", external: true },
  { id: "user-activity", title: "Users", href: "/admin/reports/user-activity", icon: Users, category: "audit" },
  { id: "stock-movements", title: "Stock", href: "/admin/reports/stock-movements", icon: Archive, category: "audit" },
];

const categoryColors: Record<string, string> = {
  sales: "text-[#2EAFC5]",
  inventory: "text-[#F1782F]",
  audit: "text-stone-500",
};

// ============================================================================
// Helper: Format category names (SOFTDRINKS_CASE -> Softdrinks Case)
// ============================================================================

function formatCategoryName(name: string): string {
  return name
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ============================================================================
// Helper: Format Peso with medium weight (₱ is normal, numbers are bold)
// ============================================================================

function formatPeso(amount: number, options?: { decimals?: number }) {
  const decimals = options?.decimals ?? 0;
  const formatted = amount.toLocaleString(undefined, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
  return (
    <>
      <span className="font-normal">₱</span>{formatted}
    </>
  );
}

// ============================================================================
// Sidebar Navigation Component (Exact match to layout-client.tsx)
// ============================================================================

function ReportsSidebar() {
  return (
    <aside className="w-44 shrink-0 border-r border-stone-200/80 bg-card hidden lg:flex lg:flex-col">
      {/* Back Button */}
      <div className="h-10 px-2 flex items-center border-b border-stone-200/80 shrink-0">
        <Button variant="ghost" size="sm" asChild className="h-7 px-2 gap-1 text-xs w-full justify-start">
          <Link href="/admin/dashboard">
            <ChevronLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
        </Button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-auto py-1 px-1.5">
        {reportLinks.map((link) => {
          const Icon = link.icon;
          
          return (
            <Link
              key={link.id}
              href={link.href}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors mb-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", categoryColors[link.category])} />
              <span className="truncate">{link.title}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

// ============================================================================
// Today's Snapshot - Standard Card Style
// ============================================================================

function TodaySnapshotHero({ data }: { data: EnhancedDashboardData }) {
  const snapshot = data.todaySnapshot;
  const hasData = snapshot && snapshot.transactionCount > 0;

  return (
    <Card className="border-stone-200/80 bg-[#F8F6F1]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary">
              <Receipt className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-[#2d1b1a]">Today&apos;s Snapshot</CardTitle>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </p>
            </div>
          </div>
          <Link href="/admin/reports/z-read">
            <Button size="sm" className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90">
              <ExternalLink className="h-3.5 w-3.5" />
              Full Report
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Gross Sales */}
            <div className="bg-white rounded-lg p-3 border border-stone-200/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">Gross Sales</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-bold font-mono tabular-nums text-[#2d1b1a]">
                  {formatPeso(snapshot.grossSales)}
                </span>
                {snapshot.salesChangePercent !== 0 && (
                  <Badge className={cn(
                    "text-[10px] h-5 gap-0.5",
                    snapshot.salesChangePercent > 0 
                      ? "bg-[#2EAFC5]/10 text-[#2EAFC5]" 
                      : "bg-[#AC0F16]/10 text-[#AC0F16]"
                  )}>
                    {snapshot.salesChangePercent > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(snapshot.salesChangePercent)}%
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">vs same day last week</p>
            </div>

            {/* Transactions */}
            <div className="bg-white rounded-lg p-3 border border-stone-200/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">Transactions</p>
              <span className="text-2xl font-bold font-mono tabular-nums text-[#2d1b1a]">
                {snapshot.transactionCount}
              </span>
              <p className="text-[10px] text-muted-foreground mt-1">
                Avg <span className="font-normal">₱</span>{snapshot.avgTicket.toFixed(0)}/ticket
              </p>
            </div>

            {/* Cash */}
            <div className="bg-white rounded-lg p-3 border border-stone-200/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium flex items-center gap-1">
                <Banknote className="h-3 w-3 text-green-600" /> Cash
              </p>
              <span className="text-xl font-bold font-mono tabular-nums text-[#2d1b1a]">
                {formatPeso(snapshot.cashSales)}
              </span>
            </div>

            {/* GCash */}
            <div className="bg-white rounded-lg p-3 border border-stone-200/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium flex items-center gap-1">
                <CreditCard className="h-3 w-3 text-blue-600" /> GCash
              </p>
              <span className="text-xl font-bold font-mono tabular-nums text-[#2d1b1a]">
                {formatPeso(snapshot.gcashSales)}
              </span>
            </div>

            {/* Est. Profit */}
            <div className="bg-[#2EAFC5]/5 rounded-lg p-3 border border-[#2EAFC5]/20">
              <p className="text-xs text-[#2EAFC5] uppercase tracking-wider mb-1 font-medium">Est. Profit</p>
              <span className="text-xl font-bold font-mono tabular-nums text-[#2EAFC5]">
                {formatPeso(snapshot.grossProfit)}
              </span>
              <p className="text-[10px] text-[#2EAFC5]/70 mt-1">~12% margin</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 bg-card rounded-lg">
            <Clock className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-muted-foreground">No transactions recorded today yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Data will appear as sales are made.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Segmented Inventory Health Bar
// ============================================================================

interface InventorySegmentedBarProps {
  fast: number;
  slow: number;
  dead: number;
  total: number;
}

function InventorySegmentedBar({ fast, slow, dead, total }: InventorySegmentedBarProps) {
  if (total === 0) return null;
  
  const MIN_WIDTH = 5;
  
  let fastPercent = (fast / total) * 100;
  let slowPercent = (slow / total) * 100;
  let deadPercent = (dead / total) * 100;
  
  if (dead > 0 && deadPercent < MIN_WIDTH) deadPercent = MIN_WIDTH;
  if (slow > 0 && slowPercent < MIN_WIDTH) slowPercent = MIN_WIDTH;
  
  const totalCalc = fastPercent + slowPercent + deadPercent;
  if (totalCalc > 100) {
    const scale = 100 / totalCalc;
    fastPercent *= scale;
    slowPercent *= scale;
    deadPercent *= scale;
  }
  
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-stone-100 border border-stone-200">
        {fastPercent > 0 && (
          <div className="bg-[#2EAFC5] transition-all" style={{ width: `${fastPercent}%` }} />
        )}
        {slowPercent > 0 && (
          <div className="bg-[#F1782F] transition-all" style={{ width: `${slowPercent}%` }} />
        )}
        {deadPercent > 0 && (
          <div className="bg-[#AC0F16] transition-all" style={{ width: `${deadPercent}%` }} />
        )}
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#2EAFC5]" />
          <span className="text-muted-foreground">Fast</span>
          <span className="font-mono font-semibold text-[#2EAFC5]">{fast}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#F1782F]" />
          <span className="text-muted-foreground">Slow</span>
          <span className="font-mono font-semibold text-[#F1782F]">{slow}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#AC0F16]" />
          <span className="text-muted-foreground">Dead</span>
          <span className="font-mono font-semibold text-[#AC0F16]">{dead}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Top Categories List (with Title Case formatting)
// ============================================================================

function TopCategoriesList({ categories }: { categories: TopCategoryData[] }) {
  if (categories.length === 0) {
    return <p className="text-xs text-muted-foreground">No sales data</p>;
  }

  const colors = ["#2EAFC5", "#F1782F", "#AC0F16"];
  
  return (
    <div className="space-y-1.5">
      {categories.map((cat, i) => (
        <div key={cat.category} className="flex items-center gap-2">
          <div 
            className="w-2 h-2 rounded-full shrink-0" 
            style={{ backgroundColor: colors[i] }}
          />
          <span className="text-xs truncate flex-1">{formatCategoryName(cat.category)}</span>
          <span className="text-xs font-mono text-muted-foreground">{cat.percent}%</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Dead Stock List
// ============================================================================

function TopDeadStockList({ items }: { items: TopDeadStockItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 text-[#2EAFC5] py-2">
        <CheckCircle2 className="h-4 w-4" />
        <span className="text-xs font-medium">All products moving!</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.slice(0, 3).map((item, index) => (
        <div key={item.productId} className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">{index + 1}.</span>
          <span className="text-xs truncate flex-1 text-foreground min-w-0" title={item.productName}>
            {item.productName || "Unknown Product"}
          </span>
          <span className="text-xs font-mono font-semibold text-[#AC0F16] shrink-0">
            <span className="font-normal">₱</span>{item.capitalTied.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
      {items.length > 0 && (
        <div className="pt-1.5 border-t border-stone-100">
          <p className="text-xs text-muted-foreground">
            Total at risk: <span className="font-mono font-semibold text-[#AC0F16]">
              <span className="font-normal">₱</span>{items.reduce((sum, i) => sum + i.capitalTied, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Widget Card Component - Ghost Buttons
// ============================================================================

interface WidgetCardProps {
  title: string;
  href: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  children: React.ReactNode;
  footerActions?: boolean;
  disableExport?: boolean;
}

function WidgetCard({ title, href, icon: Icon, iconColor, iconBg, children, footerActions = true, disableExport = false }: WidgetCardProps) {
  return (
    <Card className="border-stone-200/80 bg-card hover:shadow-md transition-shadow h-full flex flex-col">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", iconBg)}>
              <Icon className={cn("h-4 w-4", iconColor)} />
            </div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-2">
        {children}
      </CardContent>
      {footerActions && (
        <div className="px-3 py-2 border-t border-stone-100 flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    "h-7 px-2 text-xs gap-1",
                    disableExport && "opacity-40 cursor-not-allowed"
                  )}
                  disabled={disableExport}
                  asChild={!disableExport}
                >
                  {disableExport ? (
                    <span className="flex items-center gap-1">
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </span>
                  ) : (
                    <Link href={`${href}?export=xlsx`} className="flex items-center gap-1">
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </Link>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {disableExport ? "Nothing to export" : "Download Excel"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" asChild>
                  <Link href={href} className="flex items-center gap-1">
                    <ExternalLink className="h-3.5 w-3.5" />
                    View
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open full report</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// Main Dashboard Content
// ============================================================================

async function ReportsDashboard() {
  const data = await getEnhancedDashboardData();

  const sparklineRevenue = data.salesSparkline.map(d => d.revenue);
  const sparklineProfit = data.salesSparkline.map(d => d.profit);
  const totalInventory = data.inventoryHealth.totalProducts;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar Navigation - Exact match to individual report pages */}
      <ReportsSidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Toolbar - Same style as ReportShell */}
        <div className="shrink-0 bg-card border-b border-stone-200/80 h-10 flex items-center justify-between px-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="p-1 rounded bg-[#2EAFC5]/10 shrink-0">
              <LayoutDashboard className="h-3.5 w-3.5 text-[#2EAFC5]" />
            </div>
            <h1 className="font-semibold text-sm text-foreground shrink-0">Reports Command Center</h1>
            <span className="text-stone-300 hidden sm:inline">|</span>
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">Live business metrics and report navigation</span>
          </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto bg-[#f5f3ef]">
          <div className="p-4 space-y-4 max-w-[1600px] mx-auto">
            {/* Hero Section */}
            <TodaySnapshotHero data={data} />

            {/* Financial Reports Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <WidgetCard
                title="Sales Trend"
                href="/admin/reports/sales-category"
                icon={BarChart3}
                iconColor="text-[#2EAFC5]"
                iconBg="bg-[#2EAFC5]/10"
              >
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Last 7 Days Revenue</p>
                  <MiniSparkline data={sparklineRevenue} color="#2EAFC5" />
                  <div className="pt-2 border-t border-stone-100">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 font-medium">Top Categories</p>
                    <TopCategoriesList categories={data.topCategories} />
                  </div>
                </div>
              </WidgetCard>

              <WidgetCard
                title="Profit Trend"
                href="/admin/reports/profit-margin"
                icon={TrendingUp}
                iconColor="text-[#2EAFC5]"
                iconBg="bg-[#2EAFC5]/10"
              >
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Last 7 Days Profit</p>
                  <MiniSparkline data={sparklineProfit} color="#10b981" />
                  <div className="pt-2 border-t border-stone-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">7-Day Total</span>
                      <span className="text-sm font-mono font-semibold text-[#2EAFC5]">
                        <span className="font-normal">₱</span>{sparklineProfit.reduce((a, b) => a + b, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              </WidgetCard>

              <WidgetCard
                title="Spoilage & Loss"
                href="/admin/reports/spoilage"
                icon={Trash2}
                iconColor="text-[#AC0F16]"
                iconBg="bg-[#AC0F16]/10"
                disableExport={data.spoilageLossThisMonth === 0}
              >
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">This Month</p>
                  <div className="flex items-baseline gap-2">
                    <span className={cn(
                      "text-2xl font-bold font-mono tabular-nums",
                      data.spoilageLossThisMonth > 0 ? "text-[#AC0F16]" : "text-[#2EAFC5]"
                    )}>
                      <span className="font-normal">₱</span>{data.spoilageLossThisMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    {data.spoilageLossThisMonth === 0 && (
                      <Badge className="bg-[#2EAFC5]/10 text-[#2EAFC5] text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Zero loss!
                      </Badge>
                    )}
                  </div>
                  {data.spoilageLossThisMonth > 0 && (
                    <p className="text-xs text-[#AC0F16]">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      Review damage reports
                    </p>
                  )}
                </div>
              </WidgetCard>
            </div>

            {/* Inventory Reports Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <WidgetCard
                title="Inventory Velocity"
                href="/admin/reports/velocity"
                icon={Activity}
                iconColor="text-[#F1782F]"
                iconBg="bg-[#F1782F]/10"
              >
                <div className="space-y-3">
                  <InventorySegmentedBar 
                    fast={data.inventoryHealth.fastMoverCount}
                    slow={data.inventoryHealth.slowMoverCount}
                    dead={data.inventoryHealth.deadStockCount}
                    total={totalInventory}
                  />
                  <div className="pt-1 text-center">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono font-semibold text-foreground">{totalInventory}</span> products tracked
                    </p>
                  </div>
                </div>
              </WidgetCard>

              <WidgetCard
                title="Dead Stock Alert"
                href="/admin/reports/velocity?status=dead_stock"
                icon={Snowflake}
                iconColor="text-[#AC0F16]"
                iconBg="bg-[#AC0F16]/10"
                disableExport={data.topDeadStock.length === 0}
              >
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                    Top Capital at Risk
                  </p>
                  <TopDeadStockList items={data.topDeadStock} />
                </div>
              </WidgetCard>

              <WidgetCard
                title="Expiry Tracker"
                href="/admin/reports/expiring"
                icon={CalendarClock}
                iconColor="text-[#F1782F]"
                iconBg="bg-[#F1782F]/10"
                disableExport={data.expiringCriticalCount === 0}
              >
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Critical (≤7 days)</p>
                  <div className="flex items-baseline gap-2">
                    <span className={cn(
                      "text-2xl font-bold font-mono tabular-nums",
                      data.expiringCriticalCount > 0 ? "text-[#AC0F16]" : "text-[#2EAFC5]"
                    )}>
                      {data.expiringCriticalCount}
                    </span>
                    <span className="text-xs text-muted-foreground">batches</span>
                  </div>
                  {data.expiringCriticalCount === 0 ? (
                    <Badge className="bg-[#2EAFC5]/10 text-[#2EAFC5] text-[10px] gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      All clear!
                    </Badge>
                  ) : (
                    <p className="text-xs text-[#AC0F16]">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      Action needed
                    </p>
                  )}
                </div>
              </WidgetCard>
            </div>

            {/* System Reports Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Link href="/admin/audit-logs" className="group">
                <Card className="border-stone-200/80 bg-card hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-stone-100 group-hover:bg-stone-200 transition-colors">
                      <FileText className="h-4 w-4 text-stone-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors">Audit Log</p>
                      <p className="text-xs text-muted-foreground">System activity history</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/admin/reports/user-activity" className="group">
                <Card className="border-stone-200/80 bg-card hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-stone-100 group-hover:bg-stone-200 transition-colors">
                      <Users className="h-4 w-4 text-stone-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors">User Activity</p>
                      <p className="text-xs text-muted-foreground">Staff performance metrics</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/admin/reports/stock-movements" className="group">
                <Card className="border-stone-200/80 bg-card hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-stone-100 group-hover:bg-stone-200 transition-colors">
                      <Archive className="h-4 w-4 text-stone-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors">Stock Movements</p>
                      <p className="text-xs text-muted-foreground">Inventory transaction log</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function DashboardSkeleton() {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-44 shrink-0 border-r border-stone-200/80 bg-card hidden lg:flex lg:flex-col animate-pulse">
        <div className="h-10 px-2 flex items-center border-b border-stone-200/80">
          <div className="h-6 bg-stone-200 rounded w-24" />
        </div>
        <div className="p-2 space-y-1">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-6 bg-stone-200 rounded" />
          ))}
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="shrink-0 bg-card border-b border-stone-200/80 h-10 animate-pulse">
          <div className="h-full flex items-center px-3">
            <div className="h-5 bg-stone-200 rounded w-48" />
          </div>
        </div>
        <div className="flex-1 p-4 bg-[#f5f3ef]">
          <div className="space-y-4 max-w-[1600px] mx-auto animate-pulse">
            <div className="h-36 bg-stone-100 rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="h-44 bg-stone-100 rounded-lg" />
              <div className="h-44 bg-stone-100 rounded-lg" />
              <div className="h-44 bg-stone-100 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="h-44 bg-stone-100 rounded-lg" />
              <div className="h-44 bg-stone-100 rounded-lg" />
              <div className="h-44 bg-stone-100 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ReportsDashboard />
    </Suspense>
  );
}
