"use client";

import { Package, ShoppingCart, Users, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export default function AdminDashboard() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's an overview of your store."
      />
      
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-gray-200 dark:border-[#1F1F23] bg-white dark:bg-[#1A1A1E]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Total Products
              </CardTitle>
              <Package className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                --
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Items in inventory
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-[#1F1F23] bg-white dark:bg-[#1A1A1E]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Today&apos;s Sales
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                ₱0.00
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                0 transactions
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-[#1F1F23] bg-white dark:bg-[#1A1A1E]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Pending Orders
              </CardTitle>
              <Users className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                --
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Awaiting processing
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-[#1F1F23] bg-white dark:bg-[#1A1A1E]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Low Stock Items
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                --
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Need restocking
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Placeholder sections */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-gray-200 dark:border-[#1F1F23] bg-white dark:bg-[#1A1A1E]">
            <CardHeader>
              <CardTitle className="text-zinc-900 dark:text-zinc-100">
                Recent Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No recent sales to display.
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-[#1F1F23] bg-white dark:bg-[#1A1A1E]">
            <CardHeader>
              <CardTitle className="text-zinc-900 dark:text-zinc-100">
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No low stock alerts.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
