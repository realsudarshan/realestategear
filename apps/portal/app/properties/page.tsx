import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@realestategear/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PropertySearchForm } from "@/components/property-search-form";
import { PropertyCard } from "@/components/property-card";
import { getPortalListings } from "@/lib/listings";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

export const metadata: Metadata = {
  title: `Properties | ${siteName}`,
  description: "Search active listings in our coverage area.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseNumberParam(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseSort(sort: string | undefined): { sortBy?: string; sortOrder?: string } {
  if (!sort) return {};
  const [sortBy, sortOrder] = sort.split("_");
  return { sortBy, sortOrder };
}

function buildPageHref(
  filters: {
    q?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    bathrooms?: number;
    propertyType?: string;
    sort?: string;
  },
  page: number
) {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.minPrice != null) query.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice != null) query.set("maxPrice", String(filters.maxPrice));
  if (filters.bedrooms != null) query.set("bedrooms", String(filters.bedrooms));
  if (filters.bathrooms != null) query.set("bathrooms", String(filters.bathrooms));
  if (filters.propertyType) query.set("propertyType", filters.propertyType);
  if (filters.sort) query.set("sort", filters.sort);
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();
  return qs ? `/properties?${qs}` : "/properties";
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const q = first(params.q);
  const minPrice = parseNumberParam(first(params.minPrice));
  const maxPrice = parseNumberParam(first(params.maxPrice));
  const bedrooms = parseNumberParam(first(params.bedrooms));
  const bathrooms = parseNumberParam(first(params.bathrooms));
  const propertyType = first(params.propertyType) || undefined;
  const sort = first(params.sort) || undefined;
  const page = parseNumberParam(first(params.page)) ?? 1;
  const { sortBy, sortOrder } = parseSort(sort);
  const filters = { q, minPrice, maxPrice, bedrooms, bathrooms, propertyType, sort };

  const { readiness, properties, pagination } = await getPortalListings({
    q,
    minPrice,
    maxPrice,
    bedrooms,
    bathrooms,
    propertyType,
    sortBy,
    sortOrder,
    page,
  });

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Properties</p>
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Find your next home</h1>
            <p className="mt-1 text-sm text-muted-foreground">Search active listings in our coverage area.</p>
          </div>
          {!readiness.canShowSearch ? (
            // Same gated-state pattern as app/communities/[slug]/page.tsx.
            <div className="rounded-md border border-border bg-secondary/40 p-6">
              <h2 className="text-lg font-bold tracking-tight text-foreground">Homes are on the way</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Live listings go on as soon as our MLS access is approved. Tell us what you&rsquo;re
                looking for and we&rsquo;ll reach out the moment homes are available.
              </p>
              <Button asChild className="mt-4">
                <Link href="/contact">Talk to an agent</Link>
              </Button>
            </div>
          ) : (
            <>
              <PropertySearchForm
                q={q}
                minPrice={minPrice}
                maxPrice={maxPrice}
                bedrooms={bedrooms}
                bathrooms={bathrooms}
                propertyType={propertyType}
                sort={sort}
              />

              {properties.length === 0 ? (
                <div className="mt-8 rounded-md border border-dashed border-border bg-card/60 p-8 text-center">
                  <p className="text-sm font-semibold text-foreground">No homes match your search.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try widening your filters.</p>
                </div>
              ) : (
                <>
                  <p className="mt-6 text-sm text-muted-foreground">
                    {pagination.total.toLocaleString()} home{pagination.total === 1 ? "" : "s"} found
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {properties.map((property) => (
                      <PropertyCard key={property.id} property={property} />
                    ))}
                  </div>
                  {pagination.totalPages > 1 ? (
                    <div className="mt-8 flex items-center justify-between gap-3">
                      {pagination.hasPrev ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={buildPageHref(filters, page - 1)}>← Previous</Link>
                        </Button>
                      ) : (
                        <span />
                      )}
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      {pagination.hasNext ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={buildPageHref(filters, page + 1)}>Next →</Link>
                        </Button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
