import { Suspense } from "react";
import type { Metadata } from "next";
import { AgentAuthHeading } from "@/components/agent/agent-auth-heading";
import { AgentResetPasswordForm } from "@/components/agent/agent-reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Choose a new password for your agent account.",
};

export default function AgentResetPasswordPage() {
  return (
    <>
      <AgentAuthHeading title="Reset password" subtitle="Choose a new password for your agent account." />
      <div className="rounded-md border border-border bg-card p-6">
        <Suspense fallback={null}>
          <AgentResetPasswordForm />
        </Suspense>
      </div>
    </>
  );
}
