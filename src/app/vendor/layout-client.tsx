"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { SessionProvider } from "next-auth/react";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconLayoutDashboard,
  IconShoppingCart,
  IconHistory,
  IconUser,
  IconLogout,
  IconMenu2,
  IconX,
  IconSun,
  IconMoon,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/ui/notification-bell";
import logoFull from "../../../assets/christian_minimart_logo_words.png";
import logoFullDark from "../../../assets/christian_minimart_logo_dark_words.png";

interface VendorLayoutClientProps {
  children: React.ReactNode;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
}

const navItems = [
  {
    href: "/vendor",
    label: "Dashboard",
    icon: IconLayoutDashboard,
  },
  {
    href: "/vendor/order",
    label: "New Order",
    icon: IconShoppingCart,
    highlight: true,
  },
  {
    href: "/vendor/history",
    label: "Order History",
    icon: IconHistory,
  },
  {
    href: "/vendor/profile",
    label: "Profile",
    icon: IconUser,
  },
];

function VendorLayoutContent({ children, user }: VendorLayoutClientProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const getInitials = (name?: string | null) => {
    if (!name) return "V";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-card">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card">
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-border px-4">
          <Link href="/vendor">
            <Image
              src={isDark ? logoFullDark : logoFull}
              alt="Christian Minimart"
              width={160}
              height={40}
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : item.highlight
                        ? "bg-secondary/10 text-secondary hover:bg-secondary/20 ring-1 ring-secondary/30"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="rounded-full"
              >
                <IconSun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <IconMoon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
              {user?.id && (
                <NotificationBell userId={parseInt(user.id)} userType="vendor" />
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate max-w-[100px]">
                    {user?.name || "Vendor"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user?.name || "Vendor"}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {user?.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/vendor/profile">
                    <IconUser className="mr-2 size-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <IconLogout className="mr-2 size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Vendor Portal
          </p>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border z-50 px-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(true)}
        >
          <IconMenu2 className="size-6" />
        </Button>

        <Link href="/vendor">
          <Image
            src={isDark ? logoFullDark : logoFull}
            alt="Christian Minimart"
            width={120}
            height={30}
            className="h-8 w-auto object-contain"
            priority
          />
        </Link>

        <div className="flex items-center gap-1">
          {user?.id && (
            <NotificationBell userId={parseInt(user.id)} userType="vendor" />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.name || "Vendor"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
                {isDark ? <IconSun className="mr-2 size-4" /> : <IconMoon className="mr-2 size-4" />}
                {isDark ? "Light Mode" : "Dark Mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <IconLogout className="mr-2 size-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[80%] sm:w-[350px] p-0 bg-card">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="h-16 flex items-center justify-center border-b border-border px-4">
              <Image
                src={isDark ? logoFullDark : logoFull}
                alt="Christian Minimart"
                width={140}
                height={35}
                className="h-9 w-auto object-contain"
                priority
              />
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4">
              <div className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-sm font-medium",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : item.highlight
                            ? "bg-secondary/10 text-secondary hover:bg-secondary/20"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="size-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Vendor Portal
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden md:pt-0 pt-14">
        <div className={cn(
          "flex-1 overflow-auto bg-card dark:bg-zinc-950",
          pathname === "/vendor/profile" ? "p-0" : "p-4 md:p-6"
        )}>
          {children}
        </div>
      </main>

      <Toaster richColors position="top-right" />
    </div>
  );
}

export function VendorLayoutClient(props: VendorLayoutClientProps) {
  return (
    <SessionProvider 
      // Cache session for 5 minutes to reduce API calls when offline/slow
      refetchInterval={5 * 60}
      // Only refetch when window is focused (not on every re-render)
      refetchOnWindowFocus={false}
    >
      <VendorLayoutContent {...props} />
    </SessionProvider>
  );
}

