import { AgentProfileForm } from "@/components/agent/agent-profile-form";
import { loadAgentSession } from "@/lib/agent-session";
import { redirect } from "next/navigation";
import { AGENT_LOGIN } from "@/lib/agent";

export default async function AgentSettingsPage() {
  const session = await loadAgentSession();
  if (session.status !== "ok") redirect(`${AGENT_LOGIN}?from=/agent/settings`);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Profile settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update the name and phone number on your agent account.</p>
      </div>
      <AgentProfileForm user={session.user} />
    </div>
  );
}
