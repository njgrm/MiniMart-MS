"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, User } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { login } from "@/actions/auth";
import Image from "next/image";
import logo from "../../../assets/christian_minimart_logo.png";
import logoDark from "../../../assets/christian_minimart_logo_dark.png";

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Form state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await login({
        identifier,
        password,
      });

      if (result.success) {
        // Redirect based on user type (determined by auth server action)
        if (result.userType === "vendor") {
          router.push("/vendor");
        } else {
          router.push("/admin");
        }
        router.refresh();
      } else {
        // Handle array error messages from Zod
        const errorMsg = typeof result.error === "string" 
          ? result.error 
          : "Login failed";
        setError(errorMsg);
      }
    });
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-card p-4 sm:p-6 md:p-10">
      {/* Theme Toggle - Top Right */}
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-md flex-col gap-4 sm:gap-6">
        {/* Logo/Brand */}
        <div className="flex items-center gap-3 self-center">
          <Image
            src={mounted && resolvedTheme === "dark" ? logoDark : logo}
            alt="Christian Minimart logo"
            className="w-56 sm:w-72 md:w-80"
            priority
          />
        </div>

        {/* Login Card */}
        <Card className="shadow-card-hover">
          <CardHeader className="text-center pb-2 px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">
              Welcome Back!
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Sign in with your username or email
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 px-4 sm:px-6">
            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs sm:text-sm text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-foreground text-sm">
                  Email
                </Label>
                <div className="relative">
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="Enter email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    disabled={isPending}
                    className="h-12 pl-10 text-base"
                    autoComplete="username"
                  />
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                </div>
                
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground text-sm">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isPending}
                    className="h-12 pr-10 text-base"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-5" />
                    ) : (
                      <Eye className="size-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 font-medium text-base"
                disabled={isPending}
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Sign up link for vendors */}
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">
                New vendor?{" "}
              </span>
              <Link
                href="/register"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Register here
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground px-4">
          By signing in, you agree to our{" "}
          <Link href="#" className="underline underline-offset-4 hover:text-foreground transition-colors">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="#" className="underline underline-offset-4 hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
