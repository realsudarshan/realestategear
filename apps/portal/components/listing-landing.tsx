import Link from "next/link"
import { Button } from "@realestategear/ui/button"
import { SiteHeader } from "./site-header"
import { SiteFooter } from "./site-footer"
import { PropertyCard } from "./property-card"
import type { LandingResult } from "@/lib/landings"

export function ListingLanding({
  landing,
  kind,
}: {
  landing: LandingResult
  kind: "area" | "collection"
}) {
  const attribution =
    kind === "area"
      ? `area=${landing.metadata.slug}`
      : `collection=${landing.metadata.slug}`

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border bg-primary">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              color: "white",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-14">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-primary-foreground/55">
              {kind}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-primary-foreground sm:text-4xl">
              {landing.metadata.name}
            </h1>
            {landing.metadata.description ? (
              <p className="mt-3 max-w-2xl text-primary-foreground/75">
                {landing.metadata.description}
              </p>
            ) : null}
            <Button asChild variant="gold" className="mt-6">
              <Link href={`/contact?${attribution}`}>Ask about this {kind}</Link>
            </Button>
          </div>
        </section>

        {/* Listings */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          {landing.gated ? (
            <div className="rounded-xl border border-border bg-card p-7 shadow-sm">
              <h2 className="font-semibold">Listings are not available yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This page is ready, but public MLS display is currently gated.
              </p>
            </div>
          ) : landing.properties.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {landing.properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <h2 className="font-semibold">No matching homes right now</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Inventory changes often. Ask an agent to watch this page for you.
              </p>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
