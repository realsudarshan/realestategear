import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero } from "@/components/page-hero";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

export const metadata: Metadata = {
  title: `Privacy | ${siteName}`,
  description: `How ${siteName} handles the information you share.`,
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-background">
        <PageHero eyebrow="Legal" title="Privacy Policy" />
        <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <p className="text-lg leading-relaxed text-muted-foreground">
            Our complete privacy policy is being finalized ahead of launch. In straightforward terms: the only information we collect is what you voluntarily provide through our inquiry form — your name, contact details, and your property preferences. This information is used exclusively to connect you with a {siteName} advisor, and we will never sell or share it with third parties.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Have questions about your data in the meantime?{" "}
            <Link href="/contact" className="font-semibold text-primary hover:underline">
              Reach out to us.
            </Link>
          </p>
        </article>
        <SiteFooter />
      </main>
    </>
  );
}
