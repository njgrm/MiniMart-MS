"use client";

import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { AppSidebarMotion } from "@/components/app-sidebar-motion";
import TopNav from "@/components/kokonutui/top-nav";
import { PageHeaderProvider } from "@/contexts/page-header-context";
import { cn } from "@/lib/utils";

interface AdminLayoutClientProps {
  children: React.ReactNode;
  user?: {
    id?: string;
    name?: string | null;
    role?: string;
  };
  pendingOrdersCount?: number;
}

/**
 * AdminLayoutClient - Simplified Layout for Working Motion Sidebar
 * 
 * Desktop:
 * - Sidebar auto-expands on hover (collapsed by default)
 * - Main content adapts to sidebar width
 * 
 * Mobile:
 * - Motion sidebar handles its own mobile responsiveness
 */
export default function AdminLayoutClient({ children, user, pendingOrdersCount = 0 }: AdminLayoutClientProps) {
  const pathname = usePathname();
  const isPosPage = pathname === "/admin/pos";
  // Main reports page should scroll normally, only individual report pages need special handling
  const isReportPage = pathname?.startsWith("/admin/reports/") && pathname !== "/admin/reports";
  const isReportsIndex = pathname === "/admin/reports";

  return (
    <SessionProvider 
      // Cache session for 5 minutes to reduce API calls when offline/slow
      refetchInterval={5 * 60}
      // Only refetch when window is focused (not on every re-render)
      refetchOnWindowFocus={false}
    >
      <PageHeaderProvider>
        {/* Main flex container - full viewport */}
        <div className="flex h-screen w-full bg-background">
          {/* Motion Sidebar - auto-expands on hover (desktop) / hamburger (mobile) */}
          <AppSidebarMotion pendingOrdersCount={pendingOrdersCount} />
          
          {/* Main content area - grows to fill remaining space */}
          <div className="flex-1 flex flex-col">
            {/* Top Navigation */}
            <header className="h-14 shrink-0 border-b border-border bg-card z-10">
              <TopNav user={user} />
            </header>
            
            {/* Page Content */}
            <main
              className={cn(
                "flex-1",
                (isPosPage || isReportPage) ? "overflow-hidden" : "overflow-auto",
                (isPosPage || isReportPage) ? "p-0 bg-[#f5f3ef] dark:bg-muted/30" : "p-4 md:p-6 bg-[#f5f3ef] dark:bg-muted/30"
              )}
            >
              <div className={cn(
                "h-full flex flex-col",
                (isPosPage || isReportPage) && "overflow-hidden"
              )}>
                {children}
              </div>
            </main>
          </div>
        </div>
        <Toaster richColors position="top-right" />
      </PageHeaderProvider>
    </SessionProvider>
  );
}
