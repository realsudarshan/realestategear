import Link from "next/link";
import { AgentLogoutButton } from "./agent-logout-button";
import type { AgentPublicUser } from "@/lib/agent";
import { AgentSearchPalette } from "./agent-property-discovery";

const NAV = [
  { href: "/agent", label: "Dashboard" },
  { href: "/agent/contacts", label: "Contacts" },
  { href: "/agent/properties", label: "Properties" },
  { href: "/agent/listings", label: "Listings" },
  { href: "/agent/portals", label: "Portals" },
  { href: "/agent/transactions", label: "Transactions" },
  { href: "/agent/tasks", label: "Tasks" },
  { href: "/agent/events", label: "Calendar" },
  { href: "/agent/notes", label: "Notes" },
  { href: "/agent/inquiries", label: "Inquiries" },
  { href: "/agent/settings", label: "Settings" },
];

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
          <nav aria-label="Agent" className="flex flex-wrap items-center gap-1">
            <AgentSearchPalette />
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </Link>
            ))}
            <AgentLogoutButton />
          </nav>
        </div>
      </header>
      <main id="agent-main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
