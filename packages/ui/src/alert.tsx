import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@realestategear/tokens"

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-md border px-3 py-2 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*3.5)_1fr] has-[>svg]:gap-x-2.5 [&>svg]:size-3.5 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        success:
          "bg-card text-success *:data-[slot=alert-description]:text-foreground [&>svg]:text-current",
        warning:
          "bg-card text-warning-foreground *:data-[slot=alert-description]:text-foreground [&>svg]:text-warning",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 text-sm font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-xs leading-5 text-muted-foreground [&_p]:leading-5",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, alertVariants }
