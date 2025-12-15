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
    name?: string | null;
    role?: string;
  };
}

/**
 * AdminLayoutClient - Reference Dashboard Layout Pattern
 * 
 * Desktop:
 * - Sidebar auto-expands on hover (collapsed by default)
 * - Main content adapts to sidebar width
 * 
 * Mobile:
 * - Hamburger menu in motion sidebar header
 * - Full-screen slide-in sidebar overlay
 */
export default function AdminLayoutClient({ children, user }: AdminLayoutClientProps) {
  const pathname = usePathname();
  const isPosPage = pathname === "/admin/pos";

  return (
    <SessionProvider>
      <PageHeaderProvider>
        {/* Main flex container - full viewport */}
        <div className="flex h-screen w-full overflow-hidden bg-background">
          {/* Motion Sidebar - auto-expands on hover (desktop) / hamburger (mobile) */}
          <AppSidebarMotion />
          
          {/* Main content area - grows to fill remaining space */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Top Navigation - hidden on mobile (motion sidebar has hamburger) */}
            <header className="h-14 shrink-0 border-b border-border bg-card z-10 hidden md:block">
              <TopNav user={user} />
            </header>
            
            {/* Page Content - Reference Dashboard Style */}
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
