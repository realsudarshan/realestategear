"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import type { DayPickerLocale, Matcher } from "react-day-picker"

import { cn } from "@realestategear/tokens"
import { Button } from "./button"
import { Calendar } from "./calendar"
import {
  createDateTimePickerHandlers,
  createTimeOptions,
  dateHasEnabledTime,
  getMinutesSinceMidnight,
  isTimeOptionDisabled,
  toCalendarDate,
  type DateTimePickerTimeZone,
  type MinuteStep,
} from "./date-time-picker.utils"
import { FormMessage } from "./form-message"
import { Label } from "./label"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"

type DateTimePickerProps = {
  value?: Date
  onChange: (value: Date | undefined) => void
  label: React.ReactNode
  id?: string
  name?: string
  description?: React.ReactNode
  error?: React.ReactNode
  disabled?: boolean
  required?: boolean
  min?: Date
  max?: Date
  disabledDates?: Matcher | Matcher[]
  minuteStep?: MinuteStep
  timeZone?: DateTimePickerTimeZone
  locale?: Partial<DayPickerLocale>
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  datePlaceholder?: React.ReactNode
  timeLabel?: string
  clearLabel?: React.ReactNode
  className?: string
}

function formatDate(value: Date, timeZone: DateTimePickerTimeZone, locale?: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: timeZone === "UTC" ? "UTC" : undefined,
  }).format(value)
}

function formatTime(minutesSinceMidnight: number) {
  const hours = Math.floor(minutesSinceMidnight / 60).toString().padStart(2, "0")
  const minutes = (minutesSinceMidnight % 60).toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

function DateTimePicker({
  value,
  onChange,
  label,
  id,
  name,
  description,
  error,
  disabled = false,
  required = false,
  min,
  max,
  disabledDates,
  minuteStep = 15,
  timeZone = "local",
  locale,
  weekStartsOn,
  datePlaceholder = "Select date",
  timeLabel = "Time",
  clearLabel = "Clear",
  className,
}: DateTimePickerProps) {
  const generatedId = React.useId()
  const triggerId = id ?? `date-time-picker-${generatedId}`
  const timeId = `${triggerId}-time`
  const descriptionId = `${triggerId}-description`
  const errorId = `${triggerId}-error`
  const timeZoneId = `${triggerId}-time-zone`
  const describedBy = [
    description ? descriptionId : undefined,
    error ? errorId : undefined,
    timeZoneId,
  ]
    .filter(Boolean)
    .join(" ")
  const [open, setOpen] = React.useState(false)
  const handlers = createDateTimePickerHandlers({
    value,
    min,
    max,
    minuteStep,
    timeZone,
    onChange,
    setOpen,
  })
  const calendarValue = toCalendarDate(value, timeZone)
  const calendarMin = toCalendarDate(min, timeZone)
  const calendarMax = toCalendarDate(max, timeZone)
  const consumerDisabledDates = disabledDates
    ? Array.isArray(disabledDates)
      ? disabledDates
      : [disabledDates]
    : []
  const calendarDisabled: Matcher[] = [
    ...consumerDisabledDates,
    ...(calendarMin ? [{ before: calendarMin } as Matcher] : []),
    ...(calendarMax ? [{ after: calendarMax } as Matcher] : []),
    (date: Date) => !dateHasEnabledTime(date, minuteStep, min, max, timeZone),
  ]
  const baseTimeOptions = createTimeOptions(minuteStep)
  const currentMinute = value ? getMinutesSinceMidnight(value, timeZone) : undefined
  const timeOptions =
    currentMinute !== undefined && !baseTimeOptions.includes(currentMinute)
      ? [...baseTimeOptions, currentMinute].sort((left, right) => left - right)
      : baseTimeOptions

  return (
    <div
      data-slot="date-time-picker"
      data-disabled={disabled || undefined}
      className={cn("grid gap-1.5", className)}
    >
      <Label htmlFor={triggerId}>
        {label}
        {required ? <span aria-hidden="true">*</span> : null}
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={triggerId}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-describedby={describedBy}
              aria-invalid={error ? true : undefined}
              aria-required={required || undefined}
              className="min-w-40 justify-start font-normal"
            >
              <CalendarIcon aria-hidden="true" />
              {value ? formatDate(value, timeZone, locale?.code) : datePlaceholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              required
              selected={calendarValue}
              defaultMonth={calendarValue ?? calendarMin}
              startMonth={calendarMin}
              endMonth={calendarMax}
              disabled={calendarDisabled}
              locale={locale}
              weekStartsOn={weekStartsOn}
              onSelect={(date) => handlers.selectDate(date)}
            />
          </PopoverContent>
        </Popover>
        <Select
          value={currentMinute === undefined ? undefined : String(currentMinute)}
          disabled={disabled || !value}
          onValueChange={(nextValue) => handlers.selectTime(Number(nextValue))}
        >
          <SelectTrigger
            id={timeId}
            size="sm"
            aria-label={timeLabel}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            aria-required={required || undefined}
            className="w-24 font-mono"
          >
            <SelectValue placeholder="--:--" />
          </SelectTrigger>
          <SelectContent position="popper">
            {timeOptions.map((minute) => (
              <SelectItem
                key={minute}
                value={String(minute)}
                disabled={
                  !calendarValue ||
                  isTimeOptionDisabled(calendarValue, minute, min, max, timeZone)
                }
              >
                {formatTime(minute)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || !value}
          onClick={handlers.clear}
        >
          {clearLabel}
        </Button>
      </div>
      <span id={timeZoneId} className="text-muted-foreground text-xs">
        {timeZone === "UTC" ? "UTC" : "Local time"}
      </span>
      {description ? (
        <p id={descriptionId} className="text-muted-foreground text-xs leading-5">
          {description}
        </p>
      ) : null}
      {error ? (
        <FormMessage id={errorId} variant="error">
          {error}
        </FormMessage>
      ) : null}
      {name ? <input type="hidden" name={name} value={value?.toISOString() ?? ""} /> : null}
    </div>
  )
}

DateTimePicker.displayName = "DateTimePicker"

export { DateTimePicker }
export type { DateTimePickerProps, DateTimePickerTimeZone, MinuteStep }
