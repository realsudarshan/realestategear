export type DateTimePickerTimeZone = "local" | "UTC"

export type MinuteStep = 5 | 10 | 15 | 20 | 30 | 60

type DateTimePickerHandlerOptions = {
  value: Date | undefined
  min: Date | undefined
  max: Date | undefined
  minuteStep: MinuteStep
  timeZone: DateTimePickerTimeZone
  onChange: (value: Date | undefined) => void
  setOpen: (open: boolean) => void
}

function getDateParts(value: Date, timeZone: DateTimePickerTimeZone) {
  return timeZone === "UTC"
    ? {
        year: value.getUTCFullYear(),
        month: value.getUTCMonth(),
        day: value.getUTCDate(),
        hours: value.getUTCHours(),
        minutes: value.getUTCMinutes(),
        seconds: value.getUTCSeconds(),
        milliseconds: value.getUTCMilliseconds(),
      }
    : {
        year: value.getFullYear(),
        month: value.getMonth(),
        day: value.getDate(),
        hours: value.getHours(),
        minutes: value.getMinutes(),
        seconds: value.getSeconds(),
        milliseconds: value.getMilliseconds(),
      }
}

function createDate(
  parts: ReturnType<typeof getDateParts>,
  timeZone: DateTimePickerTimeZone,
) {
  const values = [
    parts.year,
    parts.month,
    parts.day,
    parts.hours,
    parts.minutes,
    parts.seconds,
    parts.milliseconds,
  ] as const

  return timeZone === "UTC"
    ? new Date(Date.UTC(...values))
    : new Date(...values)
}

export function toCalendarDate(
  value: Date | undefined,
  timeZone: DateTimePickerTimeZone,
) {
  if (!value) return undefined
  const parts = getDateParts(value, timeZone)
  return new Date(parts.year, parts.month, parts.day, 12)
}

export function combineCalendarDateAndTime(
  calendarDate: Date,
  currentValue: Date | undefined,
  timeZone: DateTimePickerTimeZone,
) {
  const currentParts = currentValue ? getDateParts(currentValue, timeZone) : undefined
  const currentTime = currentParts
    ? {
        hours: currentParts.hours,
        minutes: currentParts.minutes,
        seconds: currentParts.seconds,
        milliseconds: currentParts.milliseconds,
      }
    : { hours: 12, minutes: 0, seconds: 0, milliseconds: 0 }

  return createDate(
    {
      year: calendarDate.getFullYear(),
      month: calendarDate.getMonth(),
      day: calendarDate.getDate(),
      ...currentTime,
    },
    timeZone,
  )
}

export function setDateTimeMinutes(
  value: Date,
  minutesSinceMidnight: number,
  timeZone: DateTimePickerTimeZone,
) {
  const parts = getDateParts(value, timeZone)
  return createDate(
    {
      ...parts,
      hours: Math.floor(minutesSinceMidnight / 60),
      minutes: minutesSinceMidnight % 60,
      seconds: 0,
      milliseconds: 0,
    },
    timeZone,
  )
}

export function createTimeOptions(minuteStep: MinuteStep) {
  const options: number[] = []
  for (let minute = 0; minute < 24 * 60; minute += minuteStep) options.push(minute)
  return options
}

export function isWithinBounds(value: Date, min?: Date, max?: Date) {
  return (!min || value >= min) && (!max || value <= max)
}

export function isTimeOptionDisabled(
  calendarDate: Date,
  minutesSinceMidnight: number,
  min: Date | undefined,
  max: Date | undefined,
  timeZone: DateTimePickerTimeZone,
) {
  const candidate = setDateTimeMinutes(
    combineCalendarDateAndTime(calendarDate, undefined, timeZone),
    minutesSinceMidnight,
    timeZone,
  )
  return !isWithinBounds(candidate, min, max)
}

export function dateHasEnabledTime(
  calendarDate: Date,
  minuteStep: MinuteStep,
  min: Date | undefined,
  max: Date | undefined,
  timeZone: DateTimePickerTimeZone,
) {
  return createTimeOptions(minuteStep).some(
    (minute) => !isTimeOptionDisabled(calendarDate, minute, min, max, timeZone),
  )
}

function closestEnabledDateTime(
  calendarDate: Date,
  preferred: Date,
  minuteStep: MinuteStep,
  min: Date | undefined,
  max: Date | undefined,
  timeZone: DateTimePickerTimeZone,
) {
  return createTimeOptions(minuteStep)
    .map((minute) =>
      setDateTimeMinutes(
        combineCalendarDateAndTime(calendarDate, undefined, timeZone),
        minute,
        timeZone,
      ),
    )
    .filter((candidate) => isWithinBounds(candidate, min, max))
    .sort(
      (left, right) =>
        Math.abs(left.getTime() - preferred.getTime()) -
        Math.abs(right.getTime() - preferred.getTime()),
    )[0]
}

export function createDateTimePickerHandlers({
  value,
  min,
  max,
  minuteStep,
  timeZone,
  onChange,
  setOpen,
}: DateTimePickerHandlerOptions) {
  return {
    clear() {
      onChange(undefined)
    },
    selectDate(calendarDate: Date) {
      const preferred = combineCalendarDateAndTime(calendarDate, value, timeZone)
      const nextValue = isWithinBounds(preferred, min, max)
        ? preferred
        : closestEnabledDateTime(
            calendarDate,
            preferred,
            minuteStep,
            min,
            max,
            timeZone,
          )

      if (nextValue) onChange(nextValue)
      setOpen(false)
    },
    selectTime(minutesSinceMidnight: number) {
      if (value) onChange(setDateTimeMinutes(value, minutesSinceMidnight, timeZone))
    },
  }
}

export function getMinutesSinceMidnight(
  value: Date,
  timeZone: DateTimePickerTimeZone,
) {
  const parts = getDateParts(value, timeZone)
  return parts.hours * 60 + parts.minutes
}
