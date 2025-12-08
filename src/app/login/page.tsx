"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Store, Eye, EyeOff, User } from "lucide-react";
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

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
        router.push("/admin");
        router.refresh();
      } else {
        setError(result.error || "Login failed");
      }
    });
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-50 dark:bg-[#0F0F12] p-6 md:p-10">
      {/* Theme Toggle - Top Right */}
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-md flex-col gap-6">
        {/* Logo/Brand */}
        <div className="flex items-center gap-3 self-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-100 shadow-lg">
            <Store className="size-5 text-white dark:text-zinc-900" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Christian Minimart
          </span>
        </div>

        {/* Login Card */}
        <Card className="border-gray-200 dark:border-[#1F1F23] bg-white dark:bg-[#1A1A1E] shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-zinc-500 dark:text-zinc-400">
              Sign in with your username or email
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-zinc-700 dark:text-zinc-300">
                  Username or Email
                </Label>
                <div className="relative">
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="Enter username or email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    disabled={isPending}
                    className="h-11 pl-10 bg-white dark:bg-[#0F0F12] border-gray-200 dark:border-[#1F1F23]"
                  />
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-700 dark:text-zinc-300">
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
                    className="h-11 pr-10 bg-white dark:bg-[#0F0F12] border-gray-200 dark:border-[#1F1F23]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-medium bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
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
              <span className="text-zinc-500 dark:text-zinc-400">
                Vendor without an account?{" "}
              </span>
              <Link
                href="/register"
                className="font-medium text-zinc-900 dark:text-zinc-100 underline-offset-4 hover:underline"
              >
                Sign up here
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          By signing in, you agree to our{" "}
          <Link href="#" className="underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-200">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="#" className="underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-200">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
