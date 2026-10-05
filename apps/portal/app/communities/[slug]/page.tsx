import * as React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import { Button } from "@realestategear/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCommunity, getCommunitySlugs } from "@/lib/communities";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

// Only the known community slugs are valid; anything else 404s (per the B0 spec).
export const dynamicParams = false;

export function generateStaticParams() {
  return getCommunitySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getCommunity(slug);
  if (!doc) return { title: `Community not found | ${siteName}` };
  return {
    title: `${doc.frontmatter.name} | ${siteName}`,
    description: doc.frontmatter.summary,
  };
}

const mdxComponents = {
  h2: (props: React.ComponentProps<"h2">) => (
    <h2 className="mt-8 text-lg font-bold tracking-tight text-foreground" {...props} />
  ),
  p: (props: React.ComponentProps<"p">) => (
    <p className="mt-3 leading-relaxed text-muted-foreground" {...props} />
  ),
  ul: (props: React.ComponentProps<"ul">) => (
    <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground" {...props} />
  ),
};

export default async function CommunityGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";
  const { slug } = await params;
  const doc = getCommunity(slug);
  if (!doc) notFound();

  const { frontmatter } = doc;
  const { content } = await compileMDX({ source: doc.content, components: mdxComponents });

  return (
    <>
      <SiteHeader />
      <main className="bg-background">
        {/* Guide hero — soft-brutalist fallback band (no community photography yet). */}
        <section className="border-b border-border bg-primary text-primary-foreground">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
            <Link
              href="/communities"
              className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/60 transition-colors hover:text-primary-foreground"
            >
              ← {frontmatter.subArea}
            </Link>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{frontmatter.name}</h1>
            <p className="mt-3 text-primary-foreground/80">{frontmatter.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {frontmatter.golfClubs.map((club) => (
                <span
                  key={club}
                  className="rounded border border-primary-foreground/30 bg-primary-foreground/10 px-2 py-0.5 text-xs font-medium"
                >
                  {club}
                </span>
              ))}
              {frontmatter.priceRange ? (
                <span className="rounded border border-primary-foreground/30 bg-primary-foreground/10 px-2 py-0.5 text-xs font-medium">
                  {frontmatter.priceRange}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          {content}

          {frontmatter.amenities.length > 0 ? (
            <div className="mt-10 rounded-md border border-border bg-card p-5">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Amenities
              </h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {frontmatter.amenities.map((a) => (
                  <span
                    key={a}
                    className="rounded border border-border bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Live listings are gated by MLS approval → coming-soon CTA. */}
          <div className="mt-8 rounded-md border border-border bg-secondary/40 p-6">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Homes in {frontmatter.name}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Live listings go on as soon as our MLS access is approved. Tell us what you&rsquo;re
              looking for and we&rsquo;ll reach out the moment homes are available.
            </p>
            <Button asChild className="mt-4">
              <Link href="/contact">Talk to an agent</Link>
            </Button>
          </div>
        </article>

        <SiteFooter />
      </main>
    </>
  );
}
