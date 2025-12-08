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
        <div className="flex h-screen bg-white dark:bg-[#0F0F12]">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="h-16 border-b border-gray-200 dark:border-[#1F1F23]">
              <TopNav user={user} />
            </header>
            <main className="flex-1 overflow-hidden p-6 bg-zinc-50 dark:bg-[#0F0F12]">
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
