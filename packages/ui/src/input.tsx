import * as React from "react"

import { cn } from "@realestategear/tokens"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground",
          "selection:bg-primary/20 selection:text-primary",
          "border-input h-10 w-full min-w-0 rounded-lg border bg-card",
          "px-3.5 py-2 text-sm shadow-none transition-[color,box-shadow,border-color]",
          "outline-none",
          "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "hover:border-primary/40",
          "focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
