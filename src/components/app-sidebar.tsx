"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
  History,
  BarChart3,
  FileText,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import logoFull from "../../assets/christian_minimart_logo_words.png";
import logoFullDark from "../../assets/christian_minimart_logo_dark_words.png";
import logoIcon from "../../assets/christian_minimart_logo_collapsed.png";
import logoIconDark from "../../assets/christian_minimart_logo_dark.png";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  highlight?: boolean;
}

const navItems: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/pos",
    label: "POS",
    icon: ShoppingCart,
    highlight: true,
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: ClipboardList,
  },
  {
    href: "/admin/inventory",
    label: "Inventory",
    icon: Package,
  },
  {
    href: "/admin/sales",
    label: "Sales History",
    icon: History,
  },
  {
    href: "/admin/reports",
    label: "Report",
    icon: BarChart3,
  },
  {
    href: "/admin/audit-logs",
    label: "Audit Logs",
    icon: FileText,
  },
];

interface AppSidebarProps {
  pendingOrdersCount?: number;
}

export function AppSidebar({ pendingOrdersCount = 0 }: AppSidebarProps) {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { state } = useSidebar();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 flex items-center justify-center border-b border-sidebar-border px-3 overflow-hidden">
        <Link href="/admin" className="flex items-center justify-center flex-shrink-0">
          {isCollapsed ? (
            <Image
              src={logoIcon}
              alt="Christian Minimart"
              width={32}
              height={32}
              className="w-auto h-13 object-contain"
              priority
            />
          ) : (
            <Image
              src={isDark ? logoFullDark : logoFull}
              alt="Christian Minimart"
              width={160}
              height={40}
              className="h-13 w-auto mr-3 object-contain"
              priority
            />
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className={isCollapsed ? "px-1.5" : "px-2"}>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                // Show badge on "Orders" nav item when there are pending orders
                const showBadge = item.label === "Orders" && pendingOrdersCount > 0;
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={
                        item.highlight && !isActive
                          ? isCollapsed
                            ? "ring-1 ring-secondary/50 bg-secondary/10 text-secondary hover:bg-secondary/20"
                            : "ring-1 ring-secondary/50 bg-secondary/10 text-secondary hover:bg-secondary/20 data-[active=true]:ring-0"
                          : ""
                      }
                    >
                      <Link href={item.href}>
                        <div className="relative">
                          <Icon className="size-4 shrink-0" />
                          {/* Badge overlay on icon when collapsed - Red circular badge */}
                          {showBadge && isCollapsed && (
                            <span className="absolute -top-1.5 -right-1.5 size-3.5 flex items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white ring-1 ring-sidebar">
                              {pendingOrdersCount > 9 ? "9+" : pendingOrdersCount}
                            </span>
                          )}
                        </div>
                        <span className="flex-1">{item.label}</span>
                        {/* Badge pill next to text when expanded - Red */}
                        {showBadge && !isCollapsed && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-white animate-pulse">
                            {pendingOrdersCount}
                          </span>
                        )}
                        {item.highlight && !isActive && !isCollapsed && (
                          <span className="flex h-2 w-2 rounded-full bg-secondary animate-pulse" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarTrigger className="w-full justify-center gap-2" />
      </SidebarFooter>
    </Sidebar>
  );
}
