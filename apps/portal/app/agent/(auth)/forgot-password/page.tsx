import type { Metadata } from "next";
import { AgentAuthHeading } from "@/components/agent/agent-auth-heading";
import { AgentForgotPasswordForm } from "@/components/agent/agent-forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request agent password reset instructions.",
};

export default function AgentForgotPasswordPage() {
  return (
    <>
      <AgentAuthHeading
        title="Forgot password"
        subtitle="We’ll email reset instructions if an agent account exists for that address."
      />
      <div className="rounded-md border border-border bg-card p-6">
        <AgentForgotPasswordForm />
      </div>
    </>
  );
}
