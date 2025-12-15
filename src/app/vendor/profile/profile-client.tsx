"use client";

import { IconUser, IconMail, IconPhone, IconBuilding } from "@tabler/icons-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface VendorProfileClientProps {
  customer: {
    id: number;
    name: string;
    email: string;
    contact: string;
  };
}

/**
 * VendorProfileClient - Profile display page
 */
export function VendorProfileClient({ customer }: VendorProfileClientProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <IconUser className="size-6" />
          Profile
        </h1>
        <p className="text-muted-foreground">
          Your vendor account information
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Avatar className="size-24">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {getInitials(customer.name)}
              </AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="text-xl">{customer.name}</CardTitle>
          <CardDescription>
            <Badge variant="secondary" className="mt-1">
              <IconBuilding className="size-3 mr-1" />
              Wholesale Vendor
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account Info */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                <IconMail className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{customer.email}</p>
              </div>
            </div>

            {customer.contact && (
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <IconPhone className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="font-medium">{customer.contact}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                <IconUser className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account ID</p>
                <p className="font-medium font-mono">#{customer.id}</p>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="rounded-lg border border-border p-4">
            <h3 className="font-medium mb-2">Vendor Benefits</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Access to wholesale pricing</li>
              <li>• Priority order processing</li>
              <li>• Bulk order capabilities</li>
              <li>• Dedicated support</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

