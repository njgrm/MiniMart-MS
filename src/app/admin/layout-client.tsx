"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import Sidebar from "@/components/kokonutui/sidebar";
import TopNav from "@/components/kokonutui/top-nav";
import { PageHeaderProvider } from "@/contexts/page-header-context";

interface AdminLayoutClientProps {
  children: React.ReactNode;
  user?: {
    name?: string | null;
    role?: string;
  };
}

export default function AdminLayoutClient({ children, user }: AdminLayoutClientProps) {
  return (
    <SessionProvider>
      <PageHeaderProvider>
        <div className="flex h-screen bg-card dark:bg-background">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="h-16 border-b border-border">
              <TopNav user={user} />
            </header>
            <main className="flex-1 overflow-hidden p-6 bg-background">
              <div className="h-full flex flex-col overflow-hidden">
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
