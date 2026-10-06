import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

export const metadata: Metadata = {
  title: `Privacy | ${siteName}`,
  description: `How ${siteName} handles the information you share.`,
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Legal</p>
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
          </div>
          <article>
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
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
