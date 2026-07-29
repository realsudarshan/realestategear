import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@realestategear/tokens"

function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span data-slot="native-select-wrapper" className="relative inline-flex w-full items-center">
      <select
        data-slot="native-select"
        className={cn(
          "h-9 w-full appearance-none rounded-sm border border-input bg-background px-3 py-1 pr-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/30",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 size-3.5 text-muted-foreground" />
    </span>
  )
}

export { NativeSelect }
