"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import { cn } from "@realestategear/tokens"

interface TableProps extends React.ComponentProps<"table"> {
  containerClassName?: string
  containerProps?: Omit<React.ComponentProps<"div">, "children" | "className">
}

type SortDirection = "ascending" | "descending" | "none"

interface SortableTableHeadProps
  extends Omit<React.ComponentProps<"th">, "aria-sort"> {
  sortDirection?: SortDirection
  onSort: () => void
  buttonProps?: Omit<
    React.ComponentProps<"button">,
    "children" | "onClick" | "type"
  >
}

function Table({ className, containerClassName, containerProps, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      className={cn("relative w-full overflow-x-auto", containerClassName)}
      {...containerProps}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-8 px-2 text-left align-middle text-xs font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function SortableTableHead({
  children,
  sortDirection = "none",
  onSort,
  buttonProps,
  ...props
}: SortableTableHeadProps) {
  const { className: buttonClassName, ...restButtonProps } = buttonProps ?? {}
  const SortIcon = sortDirection === "ascending"
    ? ArrowUp
    : sortDirection === "descending"
      ? ArrowDown
      : ChevronsUpDown

  return (
    <TableHead aria-sort={sortDirection} {...props}>
      <button
        {...restButtonProps}
        type="button"
        data-slot="sortable-table-head-button"
        onClick={onSort}
        className={cn(
          "-mx-2 inline-flex h-8 items-center gap-1 rounded-sm px-2 text-left outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
          buttonClassName
        )}
      >
        {children}
        <SortIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
    </TableHead>
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-2 py-1.5 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  SortableTableHead,
  TableRow,
  TableCell,
  TableCaption,
}
export type { SortDirection, SortableTableHeadProps, TableProps }
