import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@realestategear/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero } from "@/components/page-hero";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

export const metadata: Metadata = {
  title: `About | ${siteName}`,
  description:
    `${siteName} is a premier licensed real estate brokerage specializing in luxury golf-community homes.`,
};

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-background">
        <PageHero
          eyebrow="About Us"
          title={siteName}
          subtitle="Exclusive golf-community real estate in your market."
        />
        <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <p className="text-lg leading-relaxed text-muted-foreground">
            {siteName} is a licensed real estate brokerage dedicated to a singular mission: connecting discerning buyers with the perfect home in an exceptional golf community. We represent the region&rsquo;s most sought-after enclaves — from serene waterfront properties and urban country clubs to sweeping estate lots.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Our exclusive listings are sourced directly from the local multiple listing service. While we finalize our premium MLS integration, please share your criteria with us, and our specialists will contact you the moment matching properties become available.
          </p>
          <Button asChild variant="gold" size="lg" className="mt-10">
            <Link href="/contact">Speak with a Specialist</Link>
          </Button>
        </article>
        <SiteFooter />
      </main>
    </>
  );
}
