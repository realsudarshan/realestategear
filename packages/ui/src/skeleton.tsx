import * as React from "react"

import { cn } from "@realestategear/tokens"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden={props["aria-label"] ? undefined : true}
      className={cn("bg-accent animate-pulse rounded-md motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }
