import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@realestategear/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

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
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">About Us</p>
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">{siteName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Exclusive golf-community real estate in your market.</p>
          </div>
          <article>
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
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
