"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  IconUser, 
  IconMail, 
  IconPhone, 
  IconChevronRight,
  IconHistory,
  IconShoppingCart,
  IconLogout,
  IconCamera,
  IconEdit,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { updateVendorProfile } from "@/actions/vendor";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface VendorProfileClientProps {
  customer: {
    id: number;
    name: string;
    email: string;
    contact: string;
  };
}

/**
 * VendorProfileClient - Mobile-first profile page with menu navigation
 * Design reference: Clean header with avatar, followed by grouped menu sections
 */
export function VendorProfileClient({ customer }: VendorProfileClientProps) {
  const router = useRouter();
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [email, setEmail] = useState(customer.email);
  const [contact, setContact] = useState(customer.contact);
  const [isPending, startTransition] = useTransition();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSaveEmail = () => {
    if (!email.trim()) {
      toast.error("Email cannot be empty");
      return;
    }
    
    startTransition(async () => {
      const result = await updateVendorProfile(customer.id, { email });
      if (result.success) {
        toast.success("Email updated successfully");
        setIsEditingEmail(false);
      } else {
        toast.error(result.error || "Failed to update email");
      }
    });
  };

  const handleSaveContact = () => {
    if (!contact.trim()) {
      toast.error("Contact cannot be empty");
      return;
    }
    
    startTransition(async () => {
      const result = await updateVendorProfile(customer.id, { contact });
      if (result.success) {
        toast.success("Contact updated successfully");
        setIsEditingContact(false);
      } else {
        toast.error(result.error || "Failed to update contact");
      }
    });
  };

  const handleCancelEmail = () => {
    setEmail(customer.email);
    setIsEditingEmail(false);
  };

  const handleCancelContact = () => {
    setContact(customer.contact);
    setIsEditingContact(false);
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  // Menu item component for consistent styling
  const MenuItem = ({ 
    icon: Icon, 
    label, 
    onClick, 
    rightContent,
    destructive = false,
    editing = false,
    editContent,
  }: { 
    icon: React.ElementType; 
    label: string; 
    onClick?: () => void;
    rightContent?: React.ReactNode;
    destructive?: boolean;
    editing?: boolean;
    editContent?: React.ReactNode;
  }) => (
    <div 
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 bg-[#F8F6F1] dark:bg-zinc-900",
        !editing && onClick && "active:bg-stone-200 dark:active:bg-zinc-800 cursor-pointer",
        destructive && "text-[#AC0F16]"
      )}
      onClick={!editing ? onClick : undefined}
    >
      <div className={cn(
        "size-10 rounded-full flex items-center justify-center flex-shrink-0",
        destructive ? "bg-[#AC0F16]/10" : "bg-stone-200/80 dark:bg-zinc-800"
      )}>
        <Icon className={cn("size-5", destructive ? "text-[#AC0F16]" : "text-stone-600 dark:text-zinc-400")} />
      </div>
      
      {editing ? (
        <div className="flex-1 flex items-center gap-2">
          {editContent}
        </div>
      ) : (
        <>
          <span className={cn(
            "flex-1 text-sm font-medium",
            destructive ? "text-[#AC0F16]" : "text-[#2d1b1a] dark:text-white"
          )}>
            {label}
          </span>
          {rightContent || (
            onClick && <IconChevronRight className="size-5 text-stone-400 dark:text-zinc-500" />
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-full bg-[#FAFAF9] dark:bg-zinc-950">
      {/* Header Section - Dark background with avatar */}
      <div className="bg-[#2d1b1a] dark:bg-zinc-900 pt-6 pb-10 px-0 text-center relative">
        {/* Avatar with camera icon overlay */}
        <div className="relative inline-block mb-3">
          <Avatar className="size-24 border-4 border-white/20">
            <AvatarFallback className="bg-stone-300 dark:bg-zinc-700 text-[#2d1b1a] dark:text-white text-2xl font-bold">
              {getInitials(customer.name)}
            </AvatarFallback>
          </Avatar>
          <div className="absolute bottom-0 right-0 size-8 rounded-full bg-white dark:bg-zinc-800 border-2 border-[#2d1b1a] dark:border-zinc-700 flex items-center justify-center">
            <IconCamera className="size-4 text-stone-500 dark:text-zinc-400" />
          </div>
        </div>
        
        {/* Name and email display */}
        <h1 className="text-xl font-semibold text-white">{customer.name}</h1>
        <p className="text-sm text-white/70 mt-0.5">{customer.email}</p>
      </div>

      {/* Content Area - overlaps header slightly */}
      <div className="flex-1 -mt-4 rounded-t-3xl bg-[#FAFAF9] dark:bg-zinc-950 overflow-hidden">
        {/* Profile Section */}
        <div className="pt-4">
          <div className="mx-4 rounded-xl overflow-hidden border border-stone-200 dark:border-zinc-800 divide-y divide-stone-200 dark:divide-zinc-800">
            {/* Edit Email */}
            <MenuItem
              icon={IconMail}
              label={customer.email || "Add email"}
              editing={isEditingEmail}
              onClick={() => setIsEditingEmail(true)}
              rightContent={
                !isEditingEmail && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingEmail(true);
                    }}
                    className="size-8 text-stone-400 hover:text-[#AC0F16]"
                  >
                    <IconEdit className="size-4" />
                  </Button>
                )
              }
              editContent={
                <>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-9 flex-1 bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-[#2d1b1a] dark:text-white text-sm"
                    placeholder="Enter email"
                    disabled={isPending}
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSaveEmail}
                    disabled={isPending}
                    className="size-9 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20"
                  >
                    <IconCheck className="size-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCancelEmail}
                    disabled={isPending}
                    className="size-9 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20"
                  >
                    <IconX className="size-5" />
                  </Button>
                </>
              }
            />

            {/* Edit Contact */}
            <MenuItem
              icon={IconPhone}
              label={customer.contact || "Add contact number"}
              editing={isEditingContact}
              onClick={() => setIsEditingContact(true)}
              rightContent={
                !isEditingContact && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingContact(true);
                    }}
                    className="size-8 text-stone-400 hover:text-[#AC0F16]"
                  >
                    <IconEdit className="size-4" />
                  </Button>
                )
              }
              editContent={
                <>
                  <Input
                    type="tel"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="h-9 flex-1 bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-[#2d1b1a] dark:text-white text-sm"
                    placeholder="09XX XXX XXXX"
                    disabled={isPending}
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSaveContact}
                    disabled={isPending}
                    className="size-9 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20"
                  >
                    <IconCheck className="size-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCancelContact}
                    disabled={isPending}
                    className="size-9 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20"
                  >
                    <IconX className="size-5" />
                  </Button>
                </>
              }
            />

            {/* Account ID - Read only */}
            <div className="flex items-center gap-3 px-4 py-3.5 bg-[#F8F6F1] dark:bg-zinc-900">
              <div className="size-10 rounded-full bg-stone-200/80 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <IconUser className="size-5 text-stone-600 dark:text-zinc-400" />
              </div>
              <span className="flex-1 text-sm font-medium text-[#2d1b1a] dark:text-white">
                Account ID
              </span>
              <span className="text-sm font-mono text-stone-500 dark:text-zinc-400">
                #{customer.id}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="pt-4">
          <p className="px-4 pb-2 text-xs font-medium text-stone-500 dark:text-zinc-500 uppercase tracking-wider">
            Quick Actions
          </p>
          <div className="mx-4 rounded-xl overflow-hidden border border-stone-200 dark:border-zinc-800 divide-y divide-stone-200 dark:divide-zinc-800">
            <MenuItem
              icon={IconShoppingCart}
              label="Browse Products"
              onClick={() => router.push("/vendor/order")}
            />
            <MenuItem
              icon={IconHistory}
              label="Order History"
              onClick={() => router.push("/vendor/history")}
            />
          </div>
        </div>

        {/* Logout Section */}
        <div className="pt-4 pb-8">
          <div className="mx-4 rounded-xl overflow-hidden border border-[#AC0F16]/20 dark:border-[#AC0F16]/30">
            <MenuItem
              icon={IconLogout}
              label="Logout"
              onClick={handleLogout}
              destructive
            />
          </div>
        </div>
      </div>
    </div>
  );
}























