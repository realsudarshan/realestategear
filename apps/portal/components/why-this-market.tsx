"use client"

import { StaggerContainer, StaggerItem, FadeIn } from "@realestategear/ui/motion"
import { ShieldCheck, Map, MapPin, Sun } from "lucide-react"

const POINTS = [
  {
    title: "Optimal Playing Climate",
    body: "Temperate conditions ensure the greens remain open for the vast majority of the year, extending far beyond the typical season.",
    icon: Sun,
  },
  {
    title: "Varied Community Styles",
    body: "From lakeside fairways and urban country clubs to sprawling estate lots — experience every facet of country club living within a single region.",
    icon: Map,
  },
  {
    title: "Comprehensive Details",
    body: "We highlight association benefits, membership fees, and tee-time availability — the crucial luxury factors that extend beyond mere property dimensions.",
    icon: ShieldCheck,
  },
  {
    title: "Metropolitan Access",
    body: "Top-tier dining, a major international transit hub, and a dynamic city center are all just a short drive away.",
    icon: MapPin,
  },
]

// "Why this market" - the full-home lifestyle block (B0 spec). A structured
// value-prop grid, enhanced with premium luxury aesthetics.
export function WhyThisMarket() {
  return (
    <section className="relative border-t border-border bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <FadeIn className="flex flex-col gap-3">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-accent-foreground">
            The Regional Advantage
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            A City Designed for the Fairway Lifestyle
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Enjoy seasons that permit year-round play, diverse neighborhood styles, and a bustling metropolitan backdrop. Discover an area perfectly tailored to luxury living.
          </p>
        </FadeIn>

        <StaggerContainer className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((point) => {
            const Icon = point.icon
            return (
              <StaggerItem
                key={point.title}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-primary/5 text-primary">
                  <Icon className="size-5" />
                </div>
                <h3 className="text-base font-bold tracking-tight text-foreground">
                  {point.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {point.body}
                </p>
              </StaggerItem>
            )
          })}
        </StaggerContainer>
      </div>
    </section>
  )
}
