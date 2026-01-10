import type { Metadata } from "next";
import local from "next/font/local";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { NavigationProgress } from "@/components/navigation-progress";
import "./globals.css";

const geistSans = local({
  src: [
    { path: "../../Geist/static/Geist-Light.ttf", weight: "300", style: "normal" },
    { path: "../../Geist/static/Geist-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../Geist/static/Geist-Medium.ttf", weight: "500", style: "normal" },
    { path: "../../Geist/static/Geist-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-geist-sans",
  display: "swap",
});

const robotoMono = local({
  src: [
    { path: "../../Roboto_Mono/static/RobotoMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../Roboto_Mono/static/RobotoMono-Medium.ttf", weight: "500", style: "normal" },
    { path: "../../Roboto_Mono/static/RobotoMono-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Christian Minimart",
  description: "Point of Sale & Inventory Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${robotoMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* ⚡ Global navigation progress indicator */}
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
