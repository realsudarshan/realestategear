import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import * as Slot from "@radix-ui/react-slot"

import { cn } from "@realestategear/tokens"

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center gap-1 rounded-full border border-transparent",
    "px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0",
    "[&>svg]:size-3 [&>svg]:pointer-events-none",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
    "transition-all duration-200 overflow-hidden",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm [a&]:hover:bg-primary/85 [a&]:hover:shadow",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        destructive:
          "bg-destructive text-white [a&]:hover:bg-destructive/85 focus-visible:ring-destructive/20 dark:bg-destructive/60",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent/50",
        gold:
          "bg-accent text-accent-foreground shadow-sm [a&]:hover:bg-accent/85",
        ghost:
          "[a&]:hover:bg-accent/50 [a&]:hover:text-accent-foreground",
        link:
          "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Badge = React.forwardRef<
  HTMLSpanElement,
  React.ComponentProps<"span"> &
    VariantProps<typeof badgeVariants> & { asChild?: boolean }
>(({ className, variant = "default", asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      ref={ref}
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
})
Badge.displayName = "Badge"

export { Badge, badgeVariants }
