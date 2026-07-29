"use client"

import { Badge } from "@realestategear/ui/badge"
import { FadeIn, StaggerContainer, StaggerItem } from "@realestategear/ui/motion"

const SUB_AREAS = ["Lake Norman", "South Charlotte", "Union County", "Fort Mill SC"] as const

// Elevated luxury hero band with motion interactions and architectural grid overlay
export function BrandBand({ siteName = `${siteName}` }: { siteName?: string }) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-primary text-primary-foreground">
      {/* Decorative gradient overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80 opacity-90"
      />
      {/* Subtle grid pattern */}
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

      <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:py-24">
        <StaggerContainer className="flex flex-col gap-6">
          <StaggerItem>
            <Badge variant="gold" className="px-3 py-1">
              Launching soon — early access available
            </Badge>
          </StaggerItem>

          <StaggerItem>
            <h1 className="max-w-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-light.svg"
                alt={siteName}
                className="w-64 max-w-full sm:w-80 lg:w-[26rem]"
              />
            </h1>
          </StaggerItem>

          <StaggerItem>
            <p className="max-w-xl text-lg leading-relaxed text-primary-foreground/80 sm:text-xl">
              Properties within the region&rsquo;s most prestigious golf enclaves — carefully organized by community, with a single elite brokerage representing every course.
            </p>
          </StaggerItem>
        </StaggerContainer>

        <FadeIn delay={0.2} duration={0.6}>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-primary-foreground/25 bg-primary-foreground/25 shadow-lg">
            {SUB_AREAS.map((area) => (
              <div
                key={area}
                className="bg-primary/95 px-5 py-6 transition-colors hover:bg-primary"
              >
                <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-primary-foreground/60">
                  Region
                </dt>
                <dd className="mt-1.5 text-base font-semibold">{area}</dd>
              </div>
            ))}
          </dl>
        </FadeIn>
      </div>
    </section>
  )
}
