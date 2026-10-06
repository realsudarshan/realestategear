import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero } from "@/components/page-hero";
import { JoinForm } from "@/components/join-form";
import { getSessionUser } from "@/lib/session-user-server";
import { safePath } from "@/lib/safe-path";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

export const metadata: Metadata = {
  title: `Join | ${siteName}`,
  description: `Create an ${siteName} account to save your favorite homes.`,
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect(safePath((await searchParams).from));

  return (
    <>
      <SiteHeader />
      <main className="bg-background">
        <PageHero
          eyebrow="Account"
          title="Create an account"
          subtitle="Save homes and pick up where you left off."
        />
        <div className="mx-auto max-w-md px-4 py-8 sm:px-6 sm:py-10">
          <div className="rounded-md border border-border bg-card p-6">
            <Suspense fallback={null}>
              <JoinForm />
            </Suspense>
          </div>
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
