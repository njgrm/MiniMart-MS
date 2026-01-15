"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, LogOut, User, Settings, ChevronDown, AlertTriangle, AlertCircle } from "lucide-react";
import { useTheme } from "next-themes";
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
import { DynamicBreadcrumb } from "@/components/layout/dynamic-breadcrumb";
import { NotificationBell } from "@/components/ui/notification-bell";
import { getInventoryAlerts } from "@/actions/inventory";
import { logout } from "@/actions/auth";

interface TopNavProps {
  user?: {
    id?: string;
    name?: string | null;
    role?: string;
  };
}

export default function TopNav({ user }: TopNavProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [stockAlerts, setStockAlerts] = useState({ outOfStock: 0, criticalStock: 0, lowStock: 0 });

  useEffect(() => {
    setMounted(true);
    
    // Fetch stock alerts
    const fetchAlerts = async () => {
      try {
        const alerts = await getInventoryAlerts();
        setStockAlerts(alerts);
      } catch (err) {
        console.error("Failed to fetch stock alerts:", err);
      }
    };
    
    fetchAlerts();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    // Use the server action for proper audit logging
    await logout(user?.name || "Admin", "staff");
    router.push("/login");
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Calculate combined urgent alerts (out of stock + critical)
  const urgentCount = stockAlerts.outOfStock + stockAlerts.criticalStock;
  const hasAlerts = urgentCount > 0 || stockAlerts.lowStock > 0;

  return (
    <div className="h-full flex items-center dark:bg-sidebar justify-between px-4 bg-card">
      {/* Left side - Breadcrumb + Stock Alerts */}
      <div className="flex justify-start gap-4 mt-0 ml-4 min-w-0">
        <div className="flex-1 min-w-0 mt-4">
          <DynamicBreadcrumb />
        </div>
        
        {/* Stock Alerts - inline badges with critical prominence */}
        {mounted && hasAlerts && (
          <div className="flex items-center gap-2 shrink-0">
            {/* URGENT: Out of Stock + Critical (≤2 days) - Combined RED badge */}
            {urgentCount > 0 && (
              <button
                onClick={() => router.push("/admin/inventory?status=critical")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-colors animate-pulse"
              >
                <AlertTriangle className="size-3.5 text-destructive" />
                <span className="text-[13px] font-medium text-destructive">
                  {urgentCount} critical
                </span>
              </button>
            )}
            {/* LOW STOCK (2-7 days) - Orange badge */}
            {stockAlerts.lowStock > 0 && (
              <button
                onClick={() => router.push("/admin/inventory?status=low")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#F1782F]/10 border border-[#F1782F]/30 hover:bg-[#F1782F]/20 transition-colors"
              >
                <AlertCircle className="size-3.5 text-[#F1782F]" />
                <span className="text-[13px] font-medium text-[#F1782F]">{stockAlerts.lowStock} low stock</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Notification Bell - Only render on client */}
        {mounted && user?.id && (
          <NotificationBell userId={parseInt(user.id)} userType="staff" />
        )}

        {/* User Profile Dropdown - Only render on client to avoid hydration mismatch */}
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left hidden md:flex">
                  <span className="text-sm font-medium text-foreground">
                    {user?.name || "User"}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {user?.role?.toLowerCase() || "Staff"}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user?.name || "User"}</span>
                  <span className="text-xs font-normal text-muted-foreground capitalize">
                    {user?.role?.toLowerCase() || "Staff"}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // Placeholder during SSR to prevent layout shift
          <Button
            variant="ghost"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
            disabled
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start text-left hidden md:flex">
              <span className="text-sm font-medium text-foreground">
                {user?.name || "User"}
              </span>
              <span className="text-xs text-muted-foreground capitalize">
                {user?.role?.toLowerCase() || "Staff"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
          </Button>
        )}
      </div>
    </div>
  );
}
