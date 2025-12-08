"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
  History,
  BarChart3,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  highlight?: boolean;
}

const navItems: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: <LayoutDashboard className="size-5" />,
  },
  {
    href: "/admin/pos",
    label: "POS",
    icon: <ShoppingCart className="size-5" />,
    highlight: true,
  },
  {
    href: "/admin/orders",
    label: "Incoming Orders",
    icon: <ClipboardList className="size-5" />,
  },
  {
    href: "/admin/inventory",
    label: "Inventory",
    icon: <Package className="size-5" />,
  },
  {
    href: "/admin/sales",
    label: "Sales History",
    icon: <History className="size-5" />,
  },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: <BarChart3 className="size-5" />,
  },
];

interface SidebarProps {
  pendingOrdersCount?: number;
}

export default function Sidebar({ pendingOrdersCount = 0 }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-gray-200 dark:border-[#1F1F23] bg-white dark:bg-[#0F0F12] flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-200 dark:border-[#1F1F23]">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100">
          <Store className="size-5 text-white dark:text-zinc-900" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Christian Minimart
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Management System
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const showBadge = item.label === "Incoming Orders" && pendingOrdersCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100",
                item.highlight && !isActive && "ring-2 ring-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
              )}
            >
              <span className={cn(
                item.highlight && !isActive && "text-emerald-600 dark:text-emerald-400"
              )}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <Badge 
                  variant="destructive" 
                  className="h-5 min-w-5 flex items-center justify-center text-xs px-1.5"
                >
                  {pendingOrdersCount}
                </Badge>
              )}
              {item.highlight && !isActive && (
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-[#1F1F23]">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
          © 2025 Christian Minimart
        </p>
      </div>
    </aside>
  );
}


