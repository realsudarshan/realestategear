import { Suspense } from "react";
import type { Metadata } from "next";
import { AgentAuthHeading } from "@/components/agent/agent-auth-heading";
import { AgentLoginForm } from "@/components/agent/agent-login-form";
import { isGoogleSignInAvailable } from "@/lib/agent-google";
import { completeAgentGoogleCallback } from "@/lib/agent-oauth";

export const metadata: Metadata = {
  title: "Agent sign in",
  description: "Sign in to the agent workspace.",
};

export default async function AgentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ oauth?: string; token?: string; redirect?: string; google_error?: string }>;
}) {
  const params = await searchParams;
  if (params.oauth === "google" && params.token) {
    await completeAgentGoogleCallback(params);
  }

  let googleAvailable = false;
  try {
    googleAvailable = await isGoogleSignInAvailable();
  } catch {
    googleAvailable = false;
  }

  return (
    <>
      <AgentAuthHeading title="Sign in" subtitle="Access your contacts, transactions, and tasks." />
      <div className="rounded-md border border-border bg-card p-6">
        <Suspense fallback={null}>
          <AgentLoginForm googleAvailable={googleAvailable} />
        </Suspense>
      </div>
    </>
  );
}
