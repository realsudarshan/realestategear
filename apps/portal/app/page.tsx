import { SiteHeader } from "@/components/site-header";
import { BrandBand } from "@/components/brand-band";
import { CommunitiesGrid } from "@/components/communities-grid";
import { WhyThisMarket } from "@/components/why-this-market";
import { InquiryForm } from "@/components/inquiry-form";
import { SiteFooter } from "@/components/site-footer";
import { getCommunities } from "@/lib/communities";

// Coming-soon home (v1 launch state). Live listings are gated behind MLS IDX
// approval, so the page leads with communities + lead capture. The full home
// (featured listings, lifestyle block) and per-community guides land in B2.
export default function HomePage() {
  const communityNames = getCommunities().map((c) => c.name);
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";
  
  return (
    <>
      <SiteHeader />
      <main className="bg-background">
        <BrandBand siteName={siteName} />

        <section id="communities" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Neighborhoods</p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Local Golf Communities
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              We are currently assembling comprehensive guides and real-time listings for every neighborhood. Let us know your preferred location, and we will contact you the instant properties become available.
            </p>
          </div>
          <div className="mt-8">
            <CommunitiesGrid communities={getCommunities()} />
          </div>
        </section>

        <WhyThisMarket />

        <section id="inquiry" className="scroll-mt-20 border-t border-border bg-secondary/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Join the Waitlist</p>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Connect with a {siteName} Specialist
              </h2>
              <p className="max-w-md text-sm text-muted-foreground sm:text-base">
                Properties will be visible the moment our MLS integration is finalized. Let us know what you are searching for, and you will receive priority updates.
              </p>
            </div>
            <div className="rounded-md border border-border bg-card p-6">
              <InquiryForm communities={communityNames} />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
