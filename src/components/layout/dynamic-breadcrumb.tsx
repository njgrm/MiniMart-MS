"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const segmentMap: Record<string, string> = {
  admin: "Admin",
  vendor: "Vendor",
  portal: "Vendor",
  pos: "Point of Sale",
  inventory: "Inventory",
  orders: "Orders",
};

function toLabel(segment: string) {
  return segmentMap[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

const ITEMS_TO_DISPLAY = 3;

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (segments.length === 0) {
    return null;
  }

  const items = segments.map((segment, idx) => {
    const href = `/${segments.slice(0, idx + 1).join("/")}`;
    const label = toLabel(segment);
    const isLast = idx === segments.length - 1;
    return { href, label, isLast };
  });

  // For short paths, render simple breadcrumbs without collapsing to avoid duplicates
  if (items.length <= ITEMS_TO_DISPLAY) {
    return (
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          {items.map((item, idx) => (
            <BreadcrumbItem key={item.href || idx}>
              {item.isLast ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              )}
              {idx < items.length - 1 && <BreadcrumbSeparator />}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {/* Root */}
        <BreadcrumbItem>
          {items[0].isLast ? (
            <BreadcrumbPage>{items[0].label}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href={items[0].href}>{items[0].label}</Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        {/* Collapsed middle */}
        {items.length > ITEMS_TO_DISPLAY ? (
          <>
            <BreadcrumbItem>
              {isDesktop ? (
                <DropdownMenu open={open} onOpenChange={setOpen}>
                  <DropdownMenuTrigger
                    className="flex items-center gap-1"
                    aria-label="Toggle menu"
                  >
                    <BreadcrumbEllipsis className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {items.slice(1, -2).map((item, index) => (
                      <DropdownMenuItem key={item.href || index}>
                        <Link href={item.href}>{item.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Drawer open={open} onOpenChange={setOpen}>
                  <DrawerTrigger aria-label="Toggle Menu">
                    <BreadcrumbEllipsis className="h-4 w-4" />
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader className="text-left">
                      <DrawerTitle>Navigate to</DrawerTitle>
                      <DrawerDescription>Select a page to navigate to.</DrawerDescription>
                    </DrawerHeader>
                    <div className="grid gap-1 px-4">
                      {items.slice(1, -2).map((item, index) => (
                        <Link key={item.href || index} href={item.href} className="py-1 text-sm">
                          {item.label}
                        </Link>
                      ))}
                    </div>
                    <DrawerFooter className="pt-4">
                      <DrawerClose asChild>
                        <Button variant="outline">Close</Button>
                      </DrawerClose>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : null}

        {/* Tail items */}
        {items.slice(-ITEMS_TO_DISPLAY + 1).map((item, index) => {
          const isLast = item.isLast;
          return (
            <BreadcrumbItem key={item.href || index}>
              {isLast ? (
                <BreadcrumbPage className="max-w-20 truncate md:max-w-none">
                  {item.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild className="max-w-20 truncate md:max-w-none">
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

