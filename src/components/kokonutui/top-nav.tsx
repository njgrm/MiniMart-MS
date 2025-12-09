"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Moon, Sun, LogOut, User, Settings, ChevronDown } from "lucide-react";
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

interface TopNavProps {
  user?: {
    name?: string | null;
    role?: string;
  };
}

export default function TopNav({ user }: TopNavProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const handleLogout = async () => {
    await signOut({ redirect: false });
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

  return (
    <div className="h-full flex items-center justify-between px-6 bg-card">
      {/* Left side - Breadcrumb */}
      <div className="flex-1 mt-4 min-w-0">
        <DynamicBreadcrumb />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
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

        {/* User Profile Dropdown */}
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
              <div className="flex flex-col items-start text-left hidden sm:flex">
                <span className="text-sm font-medium text-foreground">
                  {user?.name || "User"}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {user?.role?.toLowerCase() || "Staff"}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
      </div>
    </div>
  );
}
