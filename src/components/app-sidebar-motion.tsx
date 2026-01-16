"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  IconLayoutDashboard,
  IconShoppingCart,
  IconPackage,
  IconClipboardList,
  IconHistory,
  IconChartBar,
  IconBrain,
  IconFileText,
  IconBuildingStore,
  IconCalendarEvent,
} from "@tabler/icons-react";
import {
  MotionSidebar,
  MotionSidebarBody,
  MotionSidebarHeader,
  MotionSidebarContent,
  MotionSidebarFooter,
  MotionSidebarLink,
} from "@/components/ui/motion-sidebar";
import { Button } from "@/components/ui/button";
import logoFull from "../../assets/christian_minimart_logo_words.png";
import logoFullDark from "../../assets/christian_minimart_logo_dark_words.png";
import logoIcon from "../../assets/christian_minimart_logo_collapsed.png";

interface SubNavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  highlight?: boolean;
  subItems?: SubNavItem[];
}

const navItems: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: IconLayoutDashboard,
  },
  {
    href: "/admin/pos",
    label: "POS",
    icon: IconShoppingCart,
    highlight: true,
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: IconClipboardList,
  },
  {
    href: "/admin/inventory",
    label: "Inventory",
    icon: IconPackage,
  },
  {
    href: "/admin/suppliers",
    label: "Suppliers",
    icon: IconBuildingStore,
  },
  {
    href: "/admin/sales",
    label: "Sales History",
    icon: IconHistory,
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: IconBrain,
    subItems: [
      {
        href: "/admin/analytics/events",
        label: "Events",
        icon: IconCalendarEvent,
      },
    ],
  },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: IconChartBar,
  },
  {
    href: "/admin/audit-logs",
    label: "Audit Logs",
    icon: IconFileText,
  },
];

interface AppSidebarMotionProps {
  pendingOrdersCount?: number;
}

interface SidebarContentProps extends AppSidebarMotionProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

function SidebarContent({ pendingOrdersCount = 0, open, setOpen }: SidebarContentProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  // Close mobile sidebar when navigating
  const handleLinkClick = () => {
    // Only close on mobile (full screen mode)
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setOpen(false);
    }
  };

  return (
    <MotionSidebarBody className="text-sidebar-foreground">
      {/* Header with Logo */}
      <MotionSidebarHeader className="justify-center">
        <Link 
          href="/admin" 
          className="flex items-center justify-center flex-shrink-0 overflow-hidden"
          onClick={handleLinkClick}
        >
          <motion.div
            animate={{
              width: open ? "auto" : "40px",
            }}
            transition={{ duration: 0.1, ease: "easeInOut" }}
            className="flex items-center justify-center"
          >
            {open ? (
              <Image
                src={isDark ? logoFullDark : logoFull}
                alt="Christian Minimart"
                width={160}
                height={40}
                className="h-12 w-auto object-contain mr-6"
                priority
              />
            ) : (
              <Image
                src={logoIcon}
                alt="Christian Minimart"
                width={32}
                height={32}
                className="w-auto h-12 object-contain"
                priority
              />
            )}
          </motion.div>
        </Link>
      </MotionSidebarHeader>

      {/* Navigation Links */}
      <MotionSidebarContent>
        <nav className="flex flex-col gap-1 font-semibold">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/admin" && pathname.startsWith(item.href));
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isSubActive = hasSubItems && item.subItems?.some(sub => pathname === sub.href);
            // Show badge on "Orders" nav item when there are pending orders
            const showBadge = item.label === "Orders" && pendingOrdersCount > 0;
            const Icon = item.icon;

            return (
              <div key={item.href} className="relative group/nav">
                <div onClick={hasSubItems ? undefined : handleLinkClick}>
                  <MotionSidebarLink
                    link={{
                      label: item.label,
                      href: item.href,
                      icon: (
                        <div className="relative">
                          <Icon 
                            className={cn(
                              "size-5",
                              isActive 
                                ? "text-primary-foreground" 
                                : item.highlight 
                                  ? "text-secondary" 
                                  : "text-sidebar-foreground"
                            )} 
                          />
                          {/* Badge overlay on icon when collapsed - Red circular badge */}
                          {showBadge && !open && (
                            <span className="absolute -top-1.5 -right-1.5 size-4 flex items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white ring-2 ring-sidebar">
                              {pendingOrdersCount > 9 ? "9+" : pendingOrdersCount}
                            </span>
                          )}
                        </div>
                      ),
                    }}
                    isActive={isActive}
                    className={cn(
                      item.highlight && !isActive
                        ? "ring-1 ring-secondary/50 bg-secondary/10 text-secondary font-medium hover:bg-secondary/20"
                        : ""
                    )}
                  />
                </div>
                {/* Badge shown inline when sidebar is open */}
                {showBadge && open && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-bold rounded-full bg-destructive text-white animate-pulse">
                    {pendingOrdersCount}
                  </span>
                )}
                
                {/* Sub-items: Show directly when open, show on hover when collapsed */}
                {hasSubItems && open && (
                  <div className="ml-6 mt-1 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                    {item.subItems?.map((subItem) => {
                      const isSubItemActive = pathname === subItem.href;
                      const SubIcon = subItem.icon;
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          onClick={handleLinkClick}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors",
                            isSubItemActive
                              ? "bg-primary text-primary-foreground font-medium"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                          )}
                        >
                          <SubIcon className="size-4" />
                          <span>{subItem.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
                
                {/* Sub-items popup on hover when collapsed */}
                {hasSubItems && !open && (
                  <div className="absolute left-full top-0 ml-2 opacity-0 pointer-events-none group-hover/nav:opacity-100 group-hover/nav:pointer-events-auto transition-opacity z-50">
                    <div className="bg-sidebar border border-sidebar-border rounded-lg shadow-lg py-2 min-w-[140px]">
                      {item.subItems?.map((subItem) => {
                        const isSubItemActive = pathname === subItem.href;
                        const SubIcon = subItem.icon;
                        return (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            onClick={handleLinkClick}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                              isSubItemActive
                                ? "bg-primary text-primary-foreground font-medium"
                                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                          >
                            <SubIcon className="size-4" />
                            <span>{subItem.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </MotionSidebarContent>

      {/* Footer with Theme Toggle */}
      <MotionSidebarFooter>
        <div className="flex items-center justify-center gap-2">
          
          <motion.span
            animate={{
              opacity: open ? 1 : 0,
              width: open ? "auto" : 0,
            }}
            transition={{ duration: 0.15 }}
            className="text-xs text-sidebar-foreground/60 overflow-hidden whitespace-nowrap"
          >
            
          </motion.span>
        </div>
        <motion.div
          animate={{
            opacity: open ? 1 : 0,
            height: open ? "auto" : 0,
          }}
          transition={{ duration: 0.15 }}
          className="overflow-hidden"
        >
          <p className="text-xs text-sidebar-foreground/60 text-center py-2">
            © {new Date().getFullYear()} Christian Minimart
          </p>
        </motion.div>
      </MotionSidebarFooter>
    </MotionSidebarBody>
  );
}

// Helper function for className merging
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function AppSidebarMotion({ pendingOrdersCount = 0 }: AppSidebarMotionProps) {
  const [open, setOpen] = useState(false);

  return (
    <MotionSidebar open={open} setOpen={setOpen}>
      <SidebarContent pendingOrdersCount={pendingOrdersCount} open={open} setOpen={setOpen} />
    </MotionSidebar>
  );
}
