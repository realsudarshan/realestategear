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
