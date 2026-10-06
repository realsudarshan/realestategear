import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
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
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contact</p>
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Connect with a Specialist</h1>
            <p className="mt-1 text-sm text-muted-foreground">Share your preferences with us and a dedicated advisor will reach out — typically within 24 hours.</p>
          </div>
          <div className="rounded-md border border-border bg-card p-6">
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
