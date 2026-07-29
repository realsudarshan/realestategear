"use client"

import type { HTMLAttributes, ReactNode } from "react"

import { cn } from "@realestategear/tokens"

interface EmptyProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  compact?: boolean
  titleAs?: "h2" | "h3" | "p" | "div"
}

function Empty({
  icon,
  title,
  description,
  action,
  compact = false,
  titleAs: Title = "h3",
  className,
  ...props
}: EmptyProps) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed bg-card/60 text-center",
        compact ? "p-4" : "p-8",
        className
      )}
      {...props}
    >
      {icon ? (
        <div className={cn("text-muted-foreground", compact ? "mb-2" : "mb-4")}>
          {icon}
        </div>
      ) : null}
      <Title className={cn("font-medium", compact ? "text-sm" : "text-base")}>
        {title}
      </Title>
      {description ? (
        <p
          className={cn(
            "text-muted-foreground",
            compact ? "mt-1 text-xs" : "mt-1 text-sm"
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className={cn(compact ? "mt-3" : "mt-4")}>{action}</div> : null}
    </div>
  )
}

export { Empty }
export type { EmptyProps }
