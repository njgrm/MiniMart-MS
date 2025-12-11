"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/app-sidebar";
import TopNav from "@/components/kokonutui/top-nav";
import { PageHeaderProvider } from "@/contexts/page-header-context";
import { SidebarProvider, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface AdminLayoutClientProps {
  children: React.ReactNode;
  user?: {
    name?: string | null;
    role?: string;
  };
}

function LayoutContent({ children, user }: AdminLayoutClientProps) {
  const pathname = usePathname();
  const isPosPage = pathname === "/admin/pos";
  const { setOpen } = useSidebar();
  const [hasMounted, setHasMounted] = useState(false);

  // Auto-collapse sidebar on POS page after mount
  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted) {
      if (isPosPage) {
        setOpen(false);
      } else {
        setOpen(true);
      }
    }
  }, [isPosPage, setOpen, hasMounted]);

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <header className="h-14 border-b border-border bg-card sticky top-0 z-10 flex-shrink-0">
          <TopNav user={user} />
        </header>
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
      </SidebarInset>
    </>
  );
}

export default function AdminLayoutClient({ children, user }: AdminLayoutClientProps) {
  return (
    <SessionProvider>
      <PageHeaderProvider>
        <SidebarProvider defaultOpen={true}>
          <LayoutContent user={user}>{children}</LayoutContent>
        </SidebarProvider>
        <Toaster richColors position="top-right" />
      </PageHeaderProvider>
    </SessionProvider>
  );
}
