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
  IconSun,
  IconMoon,
} from "@tabler/icons-react";
import {
  MotionSidebar,
  MotionSidebarBody,
  MotionSidebarHeader,
  MotionSidebarContent,
  MotionSidebarFooter,
  MotionSidebarLink,
  useMotionSidebar,
} from "@/components/ui/motion-sidebar";
import { Button } from "@/components/ui/button";
import logoFull from "../../assets/christian_minimart_logo_words.png";
import logoFullDark from "../../assets/christian_minimart_logo_dark_words.png";
import logoIcon from "../../assets/christian_minimart_logo_collapsed.png";

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
    label: "Incoming Orders",
    icon: IconClipboardList,
  },
  {
    href: "/admin/inventory",
    label: "Inventory",
    icon: IconPackage,
  },
  {
    href: "/admin/sales",
    label: "Sales History",
    icon: IconHistory,
  },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: IconChartBar,
  },
];

interface AppSidebarMotionProps {
  pendingOrdersCount?: number;
}

function SidebarContent({ pendingOrdersCount = 0 }: AppSidebarMotionProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { open, setOpen } = useMotionSidebar();

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
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/admin" && pathname.startsWith(item.href));
            const showBadge = item.label === "Incoming Orders" && pendingOrdersCount > 0;
            const Icon = item.icon;

            return (
              <div key={item.href} onClick={handleLinkClick}>
                <MotionSidebarLink
                  link={{
                    label: item.label,
                    href: item.href,
                    icon: (
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
                    ),
                  }}
                  isActive={isActive}
                  className={
                    item.highlight && !isActive
                      ? "ring-1 ring-secondary/50 bg-secondary/10 text-secondary font-medium hover:bg-secondary/20"
                      : ""
                  }
                />
              </div>
            );
          })}
        </nav>
      </MotionSidebarContent>

      {/* Footer with Theme Toggle */}
      <MotionSidebarFooter>
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="rounded-full text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
          >
            <IconSun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <IconMoon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          <motion.span
            animate={{
              opacity: open ? 1 : 0,
              width: open ? "auto" : 0,
            }}
            transition={{ duration: 0.15 }}
            className="text-xs text-sidebar-foreground/60 overflow-hidden whitespace-nowrap"
          >
            {isDark ? "Dark" : "Light"} mode
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
      <SidebarContent pendingOrdersCount={pendingOrdersCount} />
    </MotionSidebar>
  );
}
