# @realestategear/ui

Accessible, brand-neutral React primitives for Real Estate Gear applications. Brand
assets and product-specific compositions belong to consuming applications.

The package requires React 19 and `@realestategear/tokens`. Applications using
Tailwind v4 must register `@realestategear/ui/dist` as a source in their global CSS.

For example, from a conventional Next.js `app/globals.css`:

```css
@import "@realestategear/tokens/preset.css";
@source "../../node_modules/@realestategear/ui/dist";
```

Adjust the relative path for the stylesheet location.

## Sortable Table Headings

`SortableTableHead` owns the native button and `aria-sort` semantics while the
consumer owns sorting state and behavior:

```tsx
import { SortableTableHead } from "@realestategear/ui/table";

<SortableTableHead
  sortDirection={sort === "price-asc" ? "ascending" : "none"}
  onSort={() => setSort(sort === "price-asc" ? "price-desc" : "price-asc")}
>
  Price
</SortableTableHead>
```

Use `ascending`, `descending`, or `none` for `sortDirection`. The rendered native
button supports pointer, Enter, and Space activation without application-specific
keyboard handling.

For sorting, selection, pagination, loading, empty states, keyboard behavior, and
optional TanStack composition, see the
[data table boundary](https://github.com/realestategear/realestategear/blob/main/docs/DATA_TABLES.md).

## Calendar

`Calendar` styles `react-day-picker` while leaving date policy and state with the
consumer:

```tsx
import { Calendar } from "@realestategear/ui/calendar";

<Calendar
  mode="single"
  selected={date}
  onSelect={setDate}
  locale={locale}
  weekStartsOn={1}
  startMonth={new Date(2026, 0)}
  endMonth={new Date(2026, 11)}
  disabled={{ before: new Date() }}
/>
```

Pass locale, week start, boundaries, disabled matchers, selection mode, and
callbacks explicitly when product policy requires them. The underlying DayPicker
provides labeled navigation, roving day focus, and keyboard grid navigation.

## Date And Time Picker

`DateTimePicker` is controlled and submits an ISO timestamp through a hidden input
when `name` is provided:

```tsx
import { DateTimePicker } from "@realestategear/ui/date-time-picker";

<DateTimePicker
  id="appointment"
  name="appointment"
  label="Appointment"
  description="Choose a date and time."
  value={appointment}
  onChange={setAppointment}
  min={new Date("2026-08-21T13:00:00.000Z")}
  minuteStep={15}
  timeZone="UTC"
  locale={locale}
  weekStartsOn={1}
/>
```

The `value`, `min`, and `max` props are complete instants. With `timeZone="local"`
(the default), the picker reads date and time fields with local `Date` getters and
creates changed values with the local `Date` constructor. With `timeZone="UTC"`,
it uses UTC getters and `Date.UTC`. No arbitrary IANA timezone conversion is
performed or supported. The selected timezone is shown below the controls and is
included in their accessible descriptions.

Changing the date preserves the selected time; changing the time preserves the
selected date. A first date selection starts at 12:00 as a neutral default. If the
preserved or default time falls outside `min` or `max`, the nearest valid stepped
time is used. Calendar days outside the date portion of the bounds, days with no
valid stepped time, and consumer `disabledDates` matchers are disabled. On a
boundary day, individual time options outside the complete instant bounds are
disabled. `disabledDates` follows `react-day-picker` matcher semantics against the
dates displayed by the calendar.

The clear action calls `onChange(undefined)`. A named hidden input always renders:
its value is `value.toISOString()` when selected and an empty string when clear.
`required` supplies visible and ARIA required state; validation remains controlled
by the consuming form because hidden inputs do not provide native required-value
validation. The visible label targets the date button, and description and error
messages are referenced by both date and time controls.
