"use client";

import { useState, useTransition, useRef } from "react";
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
  IconLoader,
} from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { updateVendorProfile } from "@/actions/vendor";
import { uploadImageRaw } from "@/actions/upload";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface VendorProfileClientProps {
  customer: {
    id: number;
    name: string;
    email: string;
    contact: string;
    avatarUrl?: string | null;
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
  const [avatarUrl, setAvatarUrl] = useState(customer.avatarUrl || null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const result = await uploadImageRaw(file);
      if (result.success && result.path) {
        // Update the avatar URL locally
        setAvatarUrl(result.path);
        // Update in the database
        const updateResult = await updateVendorProfile(customer.id, { avatarUrl: result.path });
        if (updateResult.success) {
          toast.success("Profile photo updated!");
        } else {
          toast.error(updateResult.error || "Failed to save profile photo");
        }
      } else {
        toast.error(result.error || "Failed to upload image");
      }
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setIsUploadingAvatar(false);
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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
    <div className="flex flex-col min-h-full bg-gradient-to-br from-[#AC0F16]/90 via-[#8a0c12] to-[#ac0f16] dark:bg-zinc-950">
      {/* Hidden file input for avatar upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        capture="environment"
      />

      {/* Header Section - Gradient for light mode, solid dark for dark mode */}
      <div className="dark:bg-none dark:bg-zinc-900 pt-6 pb-10 px-0 text-center relative">
        {/* Avatar with camera icon overlay - clickable for upload */}
        <button
          type="button"
          onClick={handleAvatarClick}
          disabled={isUploadingAvatar}
          className="relative inline-block mb-3 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-[#AC0F16] rounded-full"
        >
          <Avatar className="size-24 border-4 border-white/20 shadow-lg transition-transform group-hover:scale-105">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={customer.name} />}
            <AvatarFallback className="bg-stone-200 dark:bg-zinc-700 text-[#2d1b1a] dark:text-white text-2xl font-bold">
              {getInitials(customer.name)}
            </AvatarFallback>
          </Avatar>
          <div className={cn(
            "absolute bottom-0 right-0 size-8 rounded-full bg-white dark:bg-zinc-800 border-2 border-white/50 dark:border-zinc-700 flex items-center justify-center shadow-md transition-all group-hover:scale-110",
            isUploadingAvatar && "animate-pulse"
          )}>
            {isUploadingAvatar ? (
              <IconLoader className="size-4 text-primary animate-spin" />
            ) : (
              <IconCamera className="size-4 text-stone-500 dark:text-zinc-400" />
            )}
          </div>
        </button>
        
        {/* Name and email display */}
        <h1 className="text-xl font-semibold text-white drop-shadow-sm">{customer.name}</h1>
        <p className="text-sm text-white/80 mt-0.5">{customer.email}</p>
      </div>

      {/* Content Area - overlaps header slightly */}
      <div className="flex-1 -mt-0 pt-5 rounded-t-3xl bg-[#FAF6F1] dark:bg-zinc-950 overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
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
              onClick={() => setShowLogoutConfirm(true)}
              destructive
            />
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out? You will need to sign in again to access your vendor account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-[#AC0F16] hover:bg-[#8a0c12] text-white"
            >
              <IconLogout className="size-4 mr-2" />
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}





















