import type { Metadata } from "next";
import { AgentAuthHeading } from "@/components/agent/agent-auth-heading";
import { AgentRegisterForm } from "@/components/agent/agent-register-form";

export const metadata: Metadata = {
  title: "Create agent account",
  description: "Register an agent account and company.",
};

export default function AgentRegisterPage() {
  return (
    <>
      <AgentAuthHeading
        title="Create an agent account"
        subtitle="Register with your name, email, and company."
      />
      <div className="rounded-md border border-border bg-card p-6">
        <AgentRegisterForm />
      </div>
    </>
  );
}
