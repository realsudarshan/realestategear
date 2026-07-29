import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero } from "@/components/page-hero";
import { InquiryForm } from "@/components/inquiry-form";
import { getCommunities } from "@/lib/communities";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

export const metadata: Metadata = {
  title: `Contact | ${siteName}`,
  description:
    `Tell us what you're looking for and a ${siteName} specialist will be in touch.`,
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ area?: string; collection?: string }> }) {
  const attribution = await searchParams;
  const communityNames = getCommunities().map((c) => c.name);
  return (
    <>
      <SiteHeader />
      <main className="bg-background">
        <PageHero
          eyebrow="Contact"
          title="Connect with a Specialist"
          subtitle="Share your preferences with us and a dedicated advisor will reach out — typically within 24 hours."
        />
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
            <InquiryForm communities={communityNames} areaSlug={attribution.area} collectionSlug={attribution.collection} />
          </div>
          <p className="mt-8 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground/80">
            {siteName} is a licensed real estate brokerage.
          </p>
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
