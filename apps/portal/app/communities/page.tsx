import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCommunities, type SubArea } from "@/lib/communities";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || `${siteName}`;

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
      <main className="bg-background">
        <section className="border-b border-border bg-primary text-primary-foreground">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/60">
              Your area
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Golf communities</h1>
            <p className="mt-3 max-w-2xl text-primary-foreground/80">
              The neighborhoods, clubs, and courses we cover.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
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
