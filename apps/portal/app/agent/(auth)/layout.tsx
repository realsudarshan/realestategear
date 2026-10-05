import { redirect } from "next/navigation";
import { loadAgentSession } from "@/lib/agent-session";
import { AGENT_HOME } from "@/lib/agent";

export default async function AgentAuthLayout({ children }: { children: React.ReactNode }) {
  const session = await loadAgentSession();
  if (session.status === "ok") redirect(AGENT_HOME);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agent workspace</p>
        {children}
      </main>
    </div>
  );
}
