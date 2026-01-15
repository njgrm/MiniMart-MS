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
  // Check if this is a print preview page (should be full screen, no padding)
  const isPrintPreview = pathname?.includes("/print");
  // All report pages (including index) need special handling
  const isReportsPage = pathname?.startsWith("/admin/reports");
  // Pages that manage their own scroll
  const needsOverflowHidden = isPosPage || isReportsPage;

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
          {!isPrintPreview && <AppSidebarMotion pendingOrdersCount={pendingOrdersCount} />}
          
          {/* Main content area - grows to fill remaining space */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {/* Top Navigation */}
            {!isPrintPreview && (
              <header className="h-14 shrink-0 border-b border-border bg-card z-30">
                <TopNav user={user} />
              </header>
            )}
            
            {/* Page Content - Use relative/absolute pattern for strict height containment */}
            <main
              className={cn(
                "flex-1 relative",
                // Padding: none for POS/reports, normal for other pages
                (isPosPage || isReportsPage) ? "p-0" : "p-4 md:p-6",
                !needsOverflowHidden && "overflow-auto",
                isPrintPreview ? "bg-white" : "bg-[#f5f3ef] dark:bg-muted/30"
              )}
            >
              {/* Absolute positioned wrapper for report pages to enforce height */}
              {needsOverflowHidden ? (
                <div className="absolute inset-0 flex flex-col overflow-hidden">
                  {children}
                </div>
              ) : (
                children
              )}
            </main>
          </div>
        </div>
        <Toaster richColors position="top-right" />
      </PageHeaderProvider>
    </SessionProvider>
  );
}
