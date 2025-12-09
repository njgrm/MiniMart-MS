import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        // Solid in light mode, transparent in dark mode
        secondary:
          "border-secondary bg-secondary text-white dark:border-secondary/40 dark:bg-secondary/20 dark:text-secondary [a&]:hover:bg-secondary/90 dark:[a&]:hover:bg-secondary/30",
        // Solid in light mode, transparent in dark mode
        accent:
          "border-accent bg-accent text-white dark:border-accent/40 dark:bg-accent/20 dark:text-accent [a&]:hover:bg-accent/90 dark:[a&]:hover:bg-accent/30",
        destructive:
          "border-destructive bg-destructive text-white dark:border-destructive/40 dark:bg-destructive/20 dark:text-destructive [a&]:hover:bg-destructive/90 dark:[a&]:hover:bg-destructive/30 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "text-foreground border-border bg-card [a&]:hover:bg-muted [a&]:hover:text-foreground",
        muted:
          "border-transparent bg-muted text-muted-foreground [a&]:hover:bg-muted/80",
        // Always transparent variants
        "transparent-secondary":
          "border-secondary/30 bg-secondary/15 text-secondary dark:border-secondary/40 dark:bg-secondary/20 [a&]:hover:bg-secondary/25",
        "transparent-accent":
          "border-accent/30 bg-accent/15 text-accent dark:border-accent/40 dark:bg-accent/20 [a&]:hover:bg-accent/25",
        // Always solid variants
        "solid-secondary":
          "border-transparent bg-secondary text-white [a&]:hover:bg-secondary/90",
        "solid-accent":
          "border-transparent bg-accent text-white [a&]:hover:bg-accent/90",
        "solid-destructive":
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
