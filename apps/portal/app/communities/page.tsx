import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCommunities, type SubArea } from "@/lib/communities";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

export const metadata: Metadata = {
  title: `Golf Communities | ${siteName}`,
  description:
    `Explore golf communities across the region — the neighborhoods, clubs, and courses ${siteName} covers.`,
};

const SUB_AREAS: SubArea[] = ["Lake Norman", "South Charlotte", "Union County", "Fort Mill SC"];

export default function CommunitiesPage() {
  const communities = getCommunities();
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your area</p>
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Golf communities</h1>
            <p className="mt-1 text-sm text-muted-foreground">The neighborhoods, clubs, and courses we cover.</p>
          </div>
          {SUB_AREAS.map((area) => {
            const inArea = communities.filter((c) => c.subArea === area);
            if (inArea.length === 0) return null;
            return (
              <section key={area} className="mb-12 last:mb-0">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {area}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inArea.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/communities/${c.slug}`}
                      className="group flex flex-col gap-3 rounded-md border border-border bg-card p-5 transition-colors hover:border-primary/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-bold tracking-tight text-foreground">{c.name}</h3>
                        {c.priceRange ? (
                          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                            {c.priceRange}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">{c.summary}</p>
                      <span className="mt-auto pt-1 text-xs font-semibold text-primary group-hover:underline">
                        View guide →
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <SiteFooter />
      </main>
    </>
  );
}
