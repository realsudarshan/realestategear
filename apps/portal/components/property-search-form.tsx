import { Input } from "@realestategear/ui/input"
import { Button } from "@realestategear/ui/button"
import { NativeSelect } from "@realestategear/ui/native-select"
import { Search } from "lucide-react"

// Mirrors the Prisma `PropertyType` enum (packages/db/prisma/schema.prisma).
// apps/portal talks to apps/api over HTTP and doesn't depend on `db` directly,
// so this small, stable list is duplicated here rather than shared.
const PROPERTY_TYPES = [
  { value: "SINGLE_FAMILY", label: "Single Family" },
  { value: "CONDO", label: "Condo" },
  { value: "TOWNHOUSE", label: "Townhouse" },
  { value: "MULTI_FAMILY", label: "Multi-Family" },
  { value: "LAND", label: "Land" },
  { value: "COMMERCIAL", label: "Commercial" },
]

const PRICE_STEPS = [100000, 200000, 300000, 400000, 500000, 750000, 1000000, 1500000, 2000000]
const BEDROOM_STEPS = [1, 2, 3, 4, 5]
const BATHROOM_STEPS = [1, 2, 3, 4]

// Sort options are limited to what portalReadinessService's sortOption() can
// express today (Property-level fields only — price lives on the related
// Listing and isn't sortable via a one-to-many Prisma orderBy).
const SORT_OPTIONS = [
  { value: "", label: "Newest" },
  { value: "yearBuilt_desc", label: "Year built: newest" },
  { value: "yearBuilt_asc", label: "Year built: oldest" },
  { value: "squareFeet_desc", label: "Square footage: largest" },
  { value: "squareFeet_asc", label: "Square footage: smallest" },
]

const selectClass =
  "mt-1.5 h-10 min-w-0 rounded-lg border-border bg-card py-1 shadow-none transition-[border-color] hover:border-primary/40 focus:border-primary"
const labelClass =
  "text-[0.6875rem] font-semibold uppercase tracking-widest text-muted-foreground"

function formatPriceOption(value: number) {
  return value >= 1000000 ? `$${value / 1000000}M` : `$${value / 1000}k`
}

export function PropertySearchForm({
  q,
  minPrice,
  maxPrice,
  bedrooms,
  bathrooms,
  propertyType,
  sort,
}: {
  q?: string
  minPrice?: number
  maxPrice?: number
  bedrooms?: number
  bathrooms?: number
  propertyType?: string
  sort?: string
}) {
  return (
    <form
      method="get"
      action="/properties"
      className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="lg:col-span-4">
        <label htmlFor="q" className={labelClass}>
          Search
        </label>
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Address, city, ZIP, or subdivision"
            className="pl-9"
          />
        </div>
      </div>

      <div>
        <label htmlFor="minPrice" className={labelClass}>
          Min price
        </label>
        <NativeSelect
          id="minPrice"
          name="minPrice"
          defaultValue={minPrice != null ? String(minPrice) : ""}
          className={selectClass}
        >
          <option value="">No min</option>
          {PRICE_STEPS.map((value) => (
            <option key={value} value={value}>
              {formatPriceOption(value)}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div>
        <label htmlFor="maxPrice" className={labelClass}>
          Max price
        </label>
        <NativeSelect
          id="maxPrice"
          name="maxPrice"
          defaultValue={maxPrice != null ? String(maxPrice) : ""}
          className={selectClass}
        >
          <option value="">No max</option>
          {PRICE_STEPS.map((value) => (
            <option key={value} value={value}>
              {formatPriceOption(value)}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div>
        <label htmlFor="bedrooms" className={labelClass}>
          Bedrooms
        </label>
        <NativeSelect
          id="bedrooms"
          name="bedrooms"
          defaultValue={bedrooms != null ? String(bedrooms) : ""}
          className={selectClass}
        >
          <option value="">Any</option>
          {BEDROOM_STEPS.map((value) => (
            <option key={value} value={value}>
              {value}+
            </option>
          ))}
        </NativeSelect>
      </div>

      <div>
        <label htmlFor="bathrooms" className={labelClass}>
          Bathrooms
        </label>
        <NativeSelect
          id="bathrooms"
          name="bathrooms"
          defaultValue={bathrooms != null ? String(bathrooms) : ""}
          className={selectClass}
        >
          <option value="">Any</option>
          {BATHROOM_STEPS.map((value) => (
            <option key={value} value={value}>
              {value}+
            </option>
          ))}
        </NativeSelect>
      </div>

      <div>
        <label htmlFor="propertyType" className={labelClass}>
          Property type
        </label>
        <NativeSelect
          id="propertyType"
          name="propertyType"
          defaultValue={propertyType ?? ""}
          className={selectClass}
        >
          <option value="">Any type</option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div>
        <label htmlFor="sort" className={labelClass}>
          Sort
        </label>
        <NativeSelect
          id="sort"
          name="sort"
          defaultValue={sort ?? ""}
          className={selectClass}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex items-end lg:col-span-4">
        <Button type="submit" className="gap-2">
          <Search className="size-4" />
          Search
        </Button>
      </div>
    </form>
  )
}
