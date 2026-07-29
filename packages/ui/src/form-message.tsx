import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@realestategear/tokens"

const formMessageVariants = cva("text-xs leading-5", {
  variants: {
    variant: {
      default: "text-muted-foreground",
      error: "text-destructive",
      success: "text-success",
    },
  },
  defaultVariants: { variant: "default" },
})

function FormMessage({
  className,
  variant = "default",
  role,
  ...props
}: React.ComponentProps<"p"> & VariantProps<typeof formMessageVariants>) {
  return (
    <p
      data-slot="form-message"
      role={role ?? (variant === "error" ? "alert" : "status")}
      className={cn(formMessageVariants({ variant }), className)}
      {...props}
    />
  )
}

export { FormMessage, formMessageVariants }
