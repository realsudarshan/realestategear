import { redirect } from "next/navigation";
import { loadAgentSession } from "@/lib/agent-session";
import { AGENT_HOME, AGENT_LOGIN, resolveAgentRouteRedirect, safeAgentPath } from "@/lib/agent";
import { AgentApiDisabled } from "@/components/agent/agent-api-disabled";
import { AgentShell } from "@/components/agent/agent-shell";

export default async function AgentAppLayout({ children }: { children: React.ReactNode }) {
  const session = await loadAgentSession();
  const gate = resolveAgentRouteRedirect("/agent", session.status === "ok");
  if (session.status === "unauthenticated") {
    redirect(gate ?? `${AGENT_LOGIN}?from=${encodeURIComponent(AGENT_HOME)}`);
  }
  if (session.status === "disabled") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <AgentApiDisabled />
      </div>
    );
  }
  return <AgentShell user={session.user}>{children}</AgentShell>;
}
