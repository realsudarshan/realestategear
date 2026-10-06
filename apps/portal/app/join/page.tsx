import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
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
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account</p>
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Save homes and pick up where you left off.</p>
          </div>
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
