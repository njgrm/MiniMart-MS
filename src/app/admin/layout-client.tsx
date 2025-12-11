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

export default function AdminLayoutClient({ children, user }: AdminLayoutClientProps) {
  const pathname = usePathname();
  const isPosPage = pathname === "/admin/pos";

  return (
    <SessionProvider>
      <PageHeaderProvider>
        {/* Main flex container - sidebar pushes content */}
        <div className="flex h-screen w-full overflow-hidden bg-background">
          {/* Motion Sidebar - auto-expands on hover */}
          <AppSidebarMotion />
          
          {/* Main content area - grows to fill remaining space */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Top Navigation */}
            <header className="h-14 border-b border-border bg-card flex-shrink-0 z-10">
              <TopNav user={user} />
            </header>
            
            {/* Page Content */}
            <main
              className={cn(
                "flex-1 overflow-auto bg-muted/30",
                isPosPage ? "p-0" : "p-4 md:p-6"
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
