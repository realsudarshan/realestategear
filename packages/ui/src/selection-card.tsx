"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"

import { cn } from "@realestategear/tokens"
import { FormMessage } from "./form-message"

type SelectionCardProps = Omit<
  React.ComponentProps<"input">,
  "children" | "className" | "id" | "type"
> & {
  type: "checkbox" | "radio"
  label: React.ReactNode
  description?: React.ReactNode
  error?: React.ReactNode
  visual?: React.ReactNode
  id?: string
  className?: string
  containerClassName?: string
}

function SelectionCard({
  type,
  label,
  description,
  error,
  visual,
  id,
  className,
  containerClassName,
  disabled,
  required,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: SelectionCardProps) {
  const generatedId = React.useId()
  const inputId = id ?? `selection-card-${generatedId}`
  const descriptionId = `${inputId}-description`
  const errorId = `${inputId}-error`
  const describedBy = [
    ariaDescribedBy,
    description ? descriptionId : undefined,
    error ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(" ") || undefined

  return (
    <div
      data-slot="selection-card"
      data-disabled={disabled || undefined}
      className={cn("grid gap-1.5", containerClassName)}
    >
      <input
        {...props}
        id={inputId}
        type={type}
        disabled={disabled}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={error ? true : ariaInvalid}
        className="peer sr-only"
      />
      <label
        htmlFor={inputId}
        data-slot="selection-card-label"
        className={cn(
          "flex min-h-16 cursor-pointer items-start gap-3 rounded-sm border border-border bg-card p-3 text-card-foreground transition-[background-color,border-color,box-shadow] hover:bg-accent/40 peer-checked:border-primary peer-checked:bg-accent/50 peer-focus-visible:ring-2 peer-focus-visible:ring-ring/80 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-aria-invalid:border-destructive peer-aria-invalid:ring-destructive/20 peer-checked:[&_[data-slot=selection-card-indicator]]:border-primary peer-checked:[&_[data-slot=selection-card-indicator]]:bg-primary peer-checked:[&_[data-slot=selection-card-indicator-mark]]:opacity-100 motion-reduce:transition-none",
          className
        )}
      >
        <span
          data-slot="selection-card-indicator"
          aria-hidden="true"
          className={cn(
            "mt-0.5 grid size-4 shrink-0 place-content-center border border-input bg-background transition-colors",
            type === "radio" ? "rounded-full" : "rounded-[4px]"
          )}
        >
          {type === "radio" ? (
            <span
              data-slot="selection-card-indicator-mark"
              className="size-1.5 rounded-full bg-primary-foreground opacity-0"
            />
          ) : (
            <CheckIcon
              data-slot="selection-card-indicator-mark"
              className="size-3 text-primary-foreground opacity-0"
            />
          )}
        </span>
        {visual ? (
          <span data-slot="selection-card-visual" className="shrink-0">
            {visual}
          </span>
        ) : null}
        <span className="grid min-w-0 gap-1">
          <span className="text-sm font-medium leading-5">
            {label}
            {required ? <span aria-hidden="true"> *</span> : null}
          </span>
          {description ? (
            <span
              id={descriptionId}
              data-slot="selection-card-description"
              className="text-xs leading-5 text-muted-foreground"
            >
              {description}
            </span>
          ) : null}
        </span>
      </label>
      {error ? (
        <FormMessage id={errorId} variant="error">
          {error}
        </FormMessage>
      ) : null}
    </div>
  )
}

SelectionCard.displayName = "SelectionCard"

export { SelectionCard }
export type { SelectionCardProps }
