"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@realestategear/tokens"

function Spinner({ className, "aria-label": ariaLabel, ...props }: React.ComponentProps<typeof Loader2>) {
  return (
    <Loader2
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Spinner }
