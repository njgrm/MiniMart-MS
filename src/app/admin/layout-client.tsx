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

  return (
    <SessionProvider>
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
                "flex-1 overflow-auto",
                isPosPage ? "p-0 bg-background" : "p-4 md:p-6 bg-muted/30"
              )}
            >
              <div className={cn(
                "h-full flex flex-col",
                isPosPage && "overflow-hidden"
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
