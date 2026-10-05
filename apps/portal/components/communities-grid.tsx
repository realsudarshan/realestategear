"use client"

import Link from "next/link"
import type { CommunityFrontmatter } from "@/lib/communities"
import { StaggerContainer, StaggerItem, MotionCard } from "@realestategear/ui/motion"
import { ArrowRight } from "lucide-react"

function CommunityCard({ community }: { community: CommunityFrontmatter }) {
  return (
    <MotionCard>
      <Link
        href={`/communities/${community.slug}`}
        className="group flex h-full flex-col p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
              {community.name}
            </h3>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {community.subArea}
            </p>
          </div>
          {community.priceRange ? (
            <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
              {community.priceRange}
            </span>
          ) : null}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground line-clamp-2">
          {community.summary}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {community.golfClubs.map((club) => (
            <span
              key={club}
              className="rounded-full border border-border bg-accent/10 px-2.5 py-0.5 text-[0.6875rem] font-bold text-accent-foreground"
            >
              {club}
            </span>
          ))}
        </div>

        <div className="mt-auto pt-6">
          <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary transition-transform duration-300 group-hover:translate-x-1">
            View guide
            <ArrowRight className="size-3.5" />
          </span>
        </div>
      </Link>
    </MotionCard>
  )
}

export function CommunitiesGrid({ communities }: { communities: CommunityFrontmatter[] }) {
  return (
    <StaggerContainer className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {communities.map((community) => (
        <StaggerItem key={community.slug}>
          <CommunityCard community={community} />
        </StaggerItem>
      ))}
    </StaggerContainer>
  )
}
