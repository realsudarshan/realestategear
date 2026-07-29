"use client";

import { useState, useTransition } from "react";

export type OwnerLead = {
  id: string;
  source: "PORTAL_ANONYMOUS" | "PORTAL_AUTHENTICATED";
  status: "NEW" | "READ" | "RESPONDED" | "ARCHIVED";
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string | null;
  message: string;
  contactPreference: string | null;
  areaSnapshot: string | null;
  collectionSnapshot: string | null;
  createdAt: string;
  portal: { name: string };
  listing: { id: string; slug: string | null; property: { address: string; city: string; state: string } } | null;
};

export type LeadsResponse = {
  leads: OwnerLead[];
  nextCursor: string | null;
  counts: Record<OwnerLead["status"] | "total", number>;
};

const STATUSES = ["NEW", "READ", "RESPONDED", "ARCHIVED"] as const;

export function OwnerLeadsInbox({ initial }: { initial: LeadsResponse }) {
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function load(filters: { status?: string; source?: string; cursor?: string } = {}) {
    setError(null);
    setIsLoading(true);
    const query = new URLSearchParams({ limit: "25" });
    const nextStatus = filters.status ?? status;
    const nextSource = filters.source ?? source;
    if (nextStatus) query.set("status", nextStatus);
    if (nextSource) query.set("source", nextSource);
    if (filters.cursor) query.set("cursor", filters.cursor);
    try {
      const response = await fetch(`/api/proxy/owner/leads?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load leads");
      const next = await response.json() as LeadsResponse;
      setData((current) => filters.cursor
        ? { ...next, leads: [...current.leads, ...next.leads], counts: current.counts }
        : next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load leads");
    } finally {
      setIsLoading(false);
    }
  }

  function changeFilters(nextStatus: string, nextSource: string) {
    setStatus(nextStatus);
    setSource(nextSource);
    startTransition(() => { void load({ status: nextStatus, source: nextSource }); });
  }

  async function updateStatus(id: string, nextStatus: OwnerLead["status"]) {
    setError(null);
    try {
      const response = await fetch(`/api/proxy/owner/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Could not update lead");
      const updated = await response.json() as OwnerLead;
      setData((current) => ({
        ...current,
        leads: current.leads.map((lead) => lead.id === id ? updated : lead),
        counts: {
          ...current.counts,
          [current.leads.find((lead) => lead.id === id)?.status ?? nextStatus]: Math.max(0, current.counts[current.leads.find((lead) => lead.id === id)?.status ?? nextStatus] - 1),
          [nextStatus]: current.counts[nextStatus] + 1,
        },
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update lead");
    }
  }

  const exportQuery = new URLSearchParams();
  if (status) exportQuery.set("status", status);
  if (source) exportQuery.set("source", source);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Owner workspace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Lead inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review and follow up on every portal inquiry.</p>
        </div>
        <a className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted" href={`/api/proxy/owner/leads/export.csv?${exportQuery}`}>
          Export CSV
        </a>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <button className={`rounded-md border p-3 text-left ${!status ? "border-foreground bg-card" : "border-border bg-background"}`} onClick={() => changeFilters("", source)}><span className="block text-xs text-muted-foreground">All</span><strong>{data.counts.total}</strong></button>
        {STATUSES.map((item) => <button key={item} className={`rounded-md border p-3 text-left ${status === item ? "border-foreground bg-card" : "border-border bg-background"}`} onClick={() => changeFilters(item, source)}><span className="block text-xs text-muted-foreground">{item.toLowerCase()}</span><strong>{data.counts[item]}</strong></button>)}
      </div>

      <div className="mb-5 flex items-center gap-3">
        <label className="text-sm font-medium" htmlFor="lead-source">Source</label>
        <select id="lead-source" className="h-9 rounded-md border border-border bg-card px-3 text-sm" value={source} onChange={(event) => changeFilters(status, event.target.value)}>
          <option value="">All sources</option>
          <option value="PORTAL_ANONYMOUS">Visitor</option>
          <option value="PORTAL_AUTHENTICATED">Signed-in visitor</option>
        </select>
        {isPending || isLoading ? <span className="text-sm text-muted-foreground">Loading...</span> : null}
      </div>

      {error ? <div role="alert" className="mb-4 rounded-md border border-destructive p-3 text-sm text-destructive">{error}</div> : null}
      {!isPending && !isLoading && data.leads.length === 0 ? <div className="rounded-md border border-border bg-card p-10 text-center"><p className="font-semibold">No leads in this view.</p><p className="mt-1 text-sm text-muted-foreground">New inquiries will appear here as soon as they arrive.</p></div> : null}

      <div className="space-y-3">
        {data.leads.map((lead) => (
          <article key={lead.id} className="rounded-md border border-border bg-card p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{lead.visitorName}</h2><span className="rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold">{lead.status}</span><span className="text-xs text-muted-foreground">{lead.source === "PORTAL_AUTHENTICATED" ? "Signed in" : "Visitor"}</span></div>
                <div className="mt-1 flex flex-wrap gap-3 text-sm"><a className="underline underline-offset-2" href={`mailto:${lead.visitorEmail}`}>{lead.visitorEmail}</a>{lead.visitorPhone ? <a className="underline underline-offset-2" href={`tel:${lead.visitorPhone}`}>{lead.visitorPhone}</a> : null}</div>
              </div>
              <time className="text-xs text-muted-foreground">{new Date(lead.createdAt).toLocaleString()}</time>
            </div>
            {lead.listing ? <p className="mt-3 border-l-2 border-primary pl-3 text-sm"><span className="text-muted-foreground">Listing:</span> {lead.listing.property.address}, {lead.listing.property.city}</p> : lead.areaSnapshot || lead.collectionSnapshot ? <p className="mt-3 text-sm text-muted-foreground">Context: {lead.areaSnapshot ?? lead.collectionSnapshot}</p> : null}
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{lead.message}</p>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
              {lead.status === "NEW" ? <button className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold" onClick={() => void updateStatus(lead.id, "READ")}>Mark read</button> : null}
              {!lead.status.match(/RESPONDED|ARCHIVED/) ? <button className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold" onClick={() => void updateStatus(lead.id, "RESPONDED")}>Mark responded</button> : null}
              {lead.status !== "ARCHIVED" ? <button className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold" onClick={() => void updateStatus(lead.id, "ARCHIVED")}>Archive</button> : null}
            </div>
          </article>
        ))}
      </div>
      {data.nextCursor ? <button className="mt-5 w-full rounded-md border border-border bg-card py-2 text-sm font-semibold" disabled={isPending || isLoading} onClick={() => startTransition(() => { void load({ cursor: data.nextCursor! }); })}>Load more</button> : null}
      <aside className="mt-8 border-t border-border pt-5 text-sm text-muted-foreground"><strong className="text-foreground">Need shared follow-up and workflow automation?</strong> Agent HQ adds team CRM and response assistance when your inbox outgrows manual follow-up.</aside>
    </div>
  );
}
