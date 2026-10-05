import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHero } from "@/components/page-hero";
import { LoginForm } from "@/components/login-form";
import { getSessionUser } from "@/lib/session-user-server";
import { safePath } from "@/lib/safe-path";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

export const metadata: Metadata = {
  title: `Log in | ${siteName}`,
  description: `Log in to your ${siteName} account to manage your saved homes.`,
};

export default async function LoginPage({
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
        <PageHero eyebrow="Account" title="Log in" subtitle="Welcome back." />
        <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
          <div className="rounded-md border border-border bg-card p-6">
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
