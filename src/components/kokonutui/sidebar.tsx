"use client";
import { useEffect, useState, useTransition } from "react";
import { useTheme } from "next-themes";
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
import Image from "next/image";
import logo from "../../../assets/christian_minimart_logo_words.png";
import logoDark from "../../../assets/christian_minimart_logo_dark_words.png";

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
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
        
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
          <Image
              src={mounted && resolvedTheme === "dark" ? logoDark : logo}
              alt="Christian Minimart logo"
              className="w-40"
              priority
            />
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
                  ? "bg-primary text-primary-foreground shadow-warm-md dark:shadow-primary-glow"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                item.highlight && !isActive && "ring-2 ring-secondary/50 bg-secondary/10 text-secondary hover:bg-secondary/20"
              )}
            >
              <span className={cn(
                item.highlight && !isActive && "text-secondary"
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
                <span className="flex h-2 w-2 rounded-full bg-secondary animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          © 2025 Christian Minimart
        </p>
      </div>
    </aside>
  );
}
