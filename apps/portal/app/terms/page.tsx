import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero } from "@/components/page-hero";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

export const metadata: Metadata = {
  title: `Terms | ${siteName}`,
  description: `Terms of use for the ${siteName} website.`,
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-background">
        <PageHero eyebrow="Legal" title="Terms of Use" />
        <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <p className="text-lg leading-relaxed text-muted-foreground">
            Our full terms of use are being prepared ahead of launch. In brief: {siteName} is a licensed real estate brokerage. All listing data displayed on this website is sourced from the regional multiple listing service and is intended solely for consumers&rsquo; personal, non-commercial use. It may not be reproduced, redistributed, or used for any commercial purpose without explicit written permission.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Questions in the meantime?{" "}
            <Link href="/contact" className="font-semibold text-primary hover:underline">
              We&rsquo;re happy to help.
            </Link>
          </p>
        </article>
        <SiteFooter />
      </main>
    </>
  );
}
