"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button } from "@realestategear/ui/button";
import { Card, CardContent } from "@realestategear/ui/card";
import { Input } from "@realestategear/ui/input";
import type { AgentPublicUser } from "@/lib/agent";

type NavItem = { href: string; label: string; match?: string; adminOnly?: boolean };
const sections: Array<{ label: string; items: NavItem[] }> = [
  { label: "Workspace", items: [{ href: "/agent", label: "Dashboard" }, { href: "/agent/contacts", label: "Contacts" }, { href: "/agent/transactions", label: "Transactions" }, { href: "/agent/tasks", label: "Tasks" }, { href: "/agent/events", label: "Calendar" }, { href: "/agent/inquiries", label: "Inquiries" }] },
  { label: "Listings", items: [{ href: "/agent/properties", label: "Properties" }, { href: "/agent/listings", label: "Listings" }, { href: "/agent/segments", label: "Segments" }, { href: "/agent/portals", label: "Portals" }] },
  { label: "Insights", items: [{ href: "/agent/reports", label: "Reports" }, { href: "/agent/reports#market-reports", label: "Market Reports", match: "/agent/reports" }, { href: "/agent/campaigns", label: "Campaigns" }, { href: "/agent/ai", label: "AI Assistant" }, { href: "/agent/ai#actions", label: "Action Queue", match: "/agent/ai" }] },
  { label: "Integrations", items: [{ href: "/agent/mls", label: "MLS" }, { href: "/agent/google", label: "Google Workspace" }, { href: "/agent/settings", label: "Settings" }] },
];

function isActive(pathname: string, item: NavItem) {
  if (item.href === "/agent") return pathname === "/agent";
  return pathname === (item.match ?? item.href) || pathname.startsWith(`${item.match ?? item.href}/`);
}
function resultHref(type: string, item: Record<string, unknown>) {
  const id = String(item.id ?? "");
  if (type === "contacts") return `/agent/contacts/${id}`;
  if (type === "transactions") return `/agent/transactions/${id}`;
  if (type === "tasks") return `/agent/tasks?search=${encodeURIComponent(String(item.title ?? ""))}`;
  if (type === "properties") return `/agent/properties?search=${encodeURIComponent(String(item.address ?? ""))}`;
  return "/agent";
}

export function AgentNavigation({ user }: { user: AgentPublicUser }) {
  const pathname = usePathname(); const searchParams = useSearchParams(); const router = useRouter(); const [mobileOpen, setMobileOpen] = useState(false); const [searchOpen, setSearchOpen] = useState(false);
  const allowedSections = useMemo(() => sections.map((section) => ({ ...section, items: section.items.filter((item) => !item.adminOnly || user.role === "ADMIN") })).filter((section) => section.items.length), [user.role]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); } if (event.key === "Escape") { setSearchOpen(false); setMobileOpen(false); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);
  const go = (href: string) => { const currentQuery = searchParams.toString(); const target = href.includes("#") ? href : `${href}${currentQuery ? `?${currentQuery}` : ""}`; router.push(target); setMobileOpen(false); };
  return <><div className="flex items-center gap-2 lg:hidden"><Button variant="outline" aria-label="Open Agent navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)}>Menu</Button><Button variant="outline" aria-label="Open Agent command palette" onClick={() => setSearchOpen(true)}>Search <span className="ml-1 text-xs">Ctrl K</span></Button></div><div className={`${mobileOpen ? "block" : "hidden"} absolute left-0 right-0 top-full border-b bg-card p-4 shadow-lg lg:static lg:block lg:border-0 lg:p-0 lg:shadow-none`}><nav aria-label="Agent sections" className="grid gap-4 lg:flex lg:items-center lg:gap-1">{allowedSections.map((section) => <div key={section.label} className="flex flex-col gap-1 lg:relative lg:group"><span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:hidden">{section.label}</span>{section.items.map((item) => <Link key={item.label} href={item.href} aria-current={isActive(pathname, item) ? "page" : undefined} onClick={() => setMobileOpen(false)} className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive(pathname, item) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"}`}>{item.label}</Link>)}</div>)}</nav></div><AgentCommandPalette open={searchOpen} close={() => setSearchOpen(false)} onNavigate={go} /></>;
}

function AgentCommandPalette({ open, close, onNavigate }: { open: boolean; close: () => void; onNavigate: (href: string) => void }) {
  const [query, setQuery] = useState(""); const [data, setData] = useState<Record<string, { items: Array<Record<string, unknown>>; total: number }> | null>(null); const [error, setError] = useState(""); const [selected, setSelected] = useState(0);
  const results = data ? Object.entries(data).flatMap(([type, group]) => group.items.map((item) => ({ type, item }))) : [];
  useEffect(() => { if (!open) { setQuery(""); setData(null); setError(""); return; } setSelected(0); if (!query.trim()) { setData(null); return; } const timer = window.setTimeout(() => { void fetch(`/api/agent/search?q=${encodeURIComponent(query)}&limit=8`, { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("Search is unavailable."); return response.json(); }).then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "Search is unavailable.")); }, 200); return () => window.clearTimeout(timer); }, [open, query]);
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => { if (event.key === "ArrowDown") { event.preventDefault(); setSelected((value) => Math.min(value + 1, Math.max(results.length - 1, 0))); } else if (event.key === "ArrowUp") { event.preventDefault(); setSelected((value) => Math.max(value - 1, 0)); } else if (event.key === "Enter" && results[selected]) { event.preventDefault(); onNavigate(resultHref(results[selected].type, results[selected].item)); } };
  if (!open) return null;
  return <div role="dialog" aria-modal="true" aria-label="Agent command palette" className="fixed inset-0 z-50 bg-background/80 p-4 backdrop-blur-sm" onClick={close}><Card className="mx-auto mt-16 max-w-2xl" onClick={(event) => event.stopPropagation()}><CardContent className="space-y-3 pt-6"><Input autoFocus aria-label="Command palette search" placeholder="Search contacts, transactions, properties, tasks" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleKeyDown} />{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}{data ? <div className="grid gap-3 sm:grid-cols-2">{Object.entries(data).map(([type, group]) => <section key={type}><h2 className="text-xs font-semibold uppercase text-muted-foreground">{type} ({group.total})</h2>{group.items.map((item) => { const index = results.findIndex((result) => result.type === type && result.item === item); return <button type="button" key={`${type}-${String(item.id)}`} aria-selected={selected === index} className={`block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === index ? "bg-accent" : ""}`} onClick={() => onNavigate(resultHref(type, item))}>{String(item.address ?? item.title ?? item.fullName ?? item.name ?? item.firstName ?? "Result")}</button>; })}</section>)}</div> : query ? <p className="text-sm text-muted-foreground">Searching…</p> : <p className="text-sm text-muted-foreground">Search contacts, transactions, properties, and tasks.</p>}<Button variant="outline" onClick={close}>Close</Button></CardContent></Card></div>;
}
