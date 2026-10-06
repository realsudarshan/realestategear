import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LoginForm } from "@/components/login-form";
import { getSessionUser } from "@/lib/session-user-server";
import { completeAgentGoogleCallback } from "@/lib/agent-oauth";
import { safePath } from "@/lib/safe-path";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Example Realty";

export const metadata: Metadata = {
  title: `Log in | ${siteName}`,
  description: `Log in to your ${siteName} account to manage your saved homes.`,
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; oauth?: string; token?: string; redirect?: string; google_error?: string }>;
}) {
  const params = await searchParams;
  await completeAgentGoogleCallback(params);

  const user = await getSessionUser();
  if (user) redirect(safePath(params.from));

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account</p>
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Welcome back.</p>
          </div>
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
