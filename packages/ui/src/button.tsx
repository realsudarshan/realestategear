import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import * as Slot from "@radix-ui/react-slot"

import { cn } from "@realestategear/tokens"
import { Spinner } from "./spinner"

const buttonVariants = cva(
  [
    "group/button relative inline-flex items-center justify-center gap-2",
    "whitespace-nowrap rounded-lg border font-medium tracking-tight",
    "text-[0.8125rem] transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:shrink-0",
    "aria-invalid:ring-destructive/30 aria-invalid:border-destructive",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "border-transparent bg-primary text-primary-foreground",
          "shadow-sm hover:bg-primary/90 hover:shadow-md",
        ].join(" "),
        destructive: [
          "border-transparent bg-destructive text-white shadow-sm",
          "hover:bg-destructive/90 hover:shadow-md",
          "focus-visible:ring-destructive/40",
        ].join(" "),
        outline: [
          "border-border bg-transparent text-foreground",
          "hover:bg-accent/50 hover:border-primary/30",
        ].join(" "),
        secondary: [
          "border-border bg-secondary text-secondary-foreground",
          "hover:bg-secondary/70",
        ].join(" "),
        ghost: [
          "border-transparent text-muted-foreground",
          "hover:bg-accent/40 hover:text-foreground",
        ].join(" "),
        link: "border-transparent px-0 text-primary underline-offset-4 hover:underline",
        gold: [
          "border-transparent bg-accent text-accent-foreground",
          "shadow-sm hover:bg-accent/85 hover:shadow-md",
        ].join(" "),
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs:      "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm:      "h-8 gap-1.5 rounded-lg px-3 has-[>svg]:px-2.5",
        lg:      "h-11 rounded-xl px-6 text-[0.9375rem] has-[>svg]:px-5",
        xl:      "h-13 rounded-xl px-8 text-base has-[>svg]:px-7",
        icon:    "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
    loadingLabel?: React.ReactNode
  }

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  loadingLabel,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-loading={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className="size-3.5 shrink-0" />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
