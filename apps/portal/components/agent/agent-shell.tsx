import type { AgentPublicUser } from "@/lib/agent";
import { AgentLogoutButton } from "./agent-logout-button";
import { AgentNavigation } from "./agent-navigation";

export function AgentShell({
  user,
  children,
}: {
  user: AgentPublicUser;
  children: React.ReactNode;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#agent-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agent workspace</p>
            <p className="text-sm font-semibold">{name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2"><AgentNavigation user={user} /><AgentLogoutButton /></div>
        </div>
      </header>
      <main id="agent-main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
