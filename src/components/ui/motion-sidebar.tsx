"use client";

import { cn } from "@/lib/utils";
import Link, { LinkProps } from "next/link";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

/**
 * Motion Sidebar - Auto-expanding sidebar with framer-motion animations
 * 
 * Features:
 * - Hover-to-expand on desktop (collapsed by default)
 * - Full-screen slide-in on mobile
 * - Smooth width transitions that push content
 * - Customizable widths and animations
 */

// Configurable widths
const SIDEBAR_WIDTH_EXPANDED = "180px";
const SIDEBAR_WIDTH_COLLAPSED = "60px";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface MotionSidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const MotionSidebarContext = createContext<MotionSidebarContextProps | undefined>(
  undefined
);

export const useMotionSidebar = () => {
  const context = useContext(MotionSidebarContext);
  if (!context) {
    throw new Error("useMotionSidebar must be used within a MotionSidebarProvider");
  }
  return context;
};

export const MotionSidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <MotionSidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </MotionSidebarContext.Provider>
  );
};

export const MotionSidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <MotionSidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </MotionSidebarProvider>
  );
};

export const MotionSidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopMotionSidebar {...props} />
      <MobileMotionSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopMotionSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useMotionSidebar();
  
  return (
    <motion.div
      className={cn(
        "h-full hidden md:flex md:flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0 overflow-hidden",
        className
      )}
      animate={{
        width: animate ? (open ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED) : SIDEBAR_WIDTH_EXPANDED,
      }}
      transition={{
        duration: 0.2,
        ease: "easeInOut",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileMotionSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useMotionSidebar();
  
  return (
    <>
      {/* Mobile header bar with menu button */}
      <div
        className={cn(
          "h-14 px-4 flex flex-row md:hidden items-center justify-between bg-sidebar border-b border-sidebar-border w-full"
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-sidebar-foreground cursor-pointer h-6 w-6"
            onClick={() => setOpen(!open)}
          />
        </div>
        
        {/* Full-screen mobile sidebar overlay */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-sidebar p-6 z-[100] flex flex-col justify-between",
                className
              )}
            >
              <div
                className="absolute right-4 top-4 z-50 text-sidebar-foreground cursor-pointer p-2 hover:bg-sidebar-accent rounded-md"
                onClick={() => setOpen(!open)}
              >
                <X className="h-6 w-6" />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const MotionSidebarLink = ({
  link,
  className,
  isActive = false,
  ...props
}: {
  link: Links;
  className?: string;
  isActive?: boolean;
  props?: LinkProps;
}) => {
  const { open, animate } = useMotionSidebar();
  
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-3 group/sidebar-link py-2.5 px-3 rounded-md transition-colors duration-150",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
        className
      )}
      {...props}
    >
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {link.icon}
      </div>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        transition={{
          duration: 0.15,
          ease: "easeInOut",
        }}
        className={cn(
          "text-sm whitespace-nowrap overflow-hidden",
          "group-hover/sidebar-link:translate-x-0.5 transition-transform duration-150"
        )}
      >
        {link.label}
      </motion.span>
    </Link>
  );
};

// Header component for logo area
export const MotionSidebarHeader = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      className={cn(
        "h-14 flex items-center border-b border-sidebar-border px-3 overflow-hidden flex-shrink-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Content area for navigation items
export const MotionSidebarContent = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto overflow-x-hidden py-4 px-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Footer area
export const MotionSidebarFooter = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      className={cn(
        "border-t border-sidebar-border p-2 flex-shrink-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Separator
export const MotionSidebarSeparator = ({
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      className={cn("h-px bg-sidebar-border mx-2 my-2", className)}
      {...props}
    />
  );
};

// Export width constants for layout calculations
export { SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED };



