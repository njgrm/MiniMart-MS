"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
  History,
  BarChart3,
} from "lucide-react";
import {
  MotionSidebar,
  MotionSidebarBody,
  MotionSidebarHeader,
  MotionSidebarContent,
  MotionSidebarFooter,
  MotionSidebarLink,
  useMotionSidebar,
} from "@/components/ui/motion-sidebar";
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
    label: "Incoming Orders",
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
    label: "Reports",
    icon: BarChart3,
  },
];

interface AppSidebarMotionProps {
  pendingOrdersCount?: number;
}

function SidebarContent({ pendingOrdersCount = 0 }: AppSidebarMotionProps) {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { open } = useMotionSidebar();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <MotionSidebarBody className="text-sidebar-foreground">
      {/* Header with Logo */}
      <MotionSidebarHeader className="justify-center">
        <Link href="/admin" className="flex items-center justify-center flex-shrink-0 overflow-hidden">
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
            const isActive = pathname === item.href;
            const showBadge = item.label === "Incoming Orders" && pendingOrdersCount > 0;
            const Icon = item.icon;

            return (
              <MotionSidebarLink
                key={item.href}
                link={{
                  label: item.label,
                  href: item.href,
                  icon: (
                    <Icon 
                      className={cn(
                        "w-6 h-6",
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
            );
          })}
        </nav>
      </MotionSidebarContent>

      {/* Footer */}
      <MotionSidebarFooter>
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

