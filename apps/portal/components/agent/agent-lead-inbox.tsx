"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@realestategear/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@realestategear/ui/card";
import { Empty } from "@realestategear/ui/empty";
import { Input } from "@realestategear/ui/input";
import { NativeSelect } from "@realestategear/ui/native-select";
import { Skeleton } from "@realestategear/ui/skeleton";

type Status = "NEW" | "READ" | "RESPONDED" | "ARCHIVED";
type Inquiry = {
  id: string; portalId?: string; status: Status; visitorName: string; visitorEmail: string;
  visitorPhone?: string | null; message: string; agentResponse?: string | null;
  contactPreference?: string | null; createdAt: string;
  portal?: { id?: string; name: string; slug?: string } | null;
  property?: { address: string; city: string; state: string; price?: number | string | null } | null;
  listing?: { property?: { address: string; city: string; state: string } } | null;
};
type ResponseData = { inquiries: Inquiry[]; pagination: { page: number; limit: number; total: number; totalPages: number } };

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("UNAUTHORIZED");
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="flex flex-col gap-3"><p className="text-sm text-destructive">{message}</p><Button variant="outline" onClick={retry}>Retry</Button></div>;
}

export function AgentLeadInbox() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<Status, number>>({ NEW: 0, READ: 0, RESPONDED: 0, ARCHIVED: 0 });
  const [portals, setPortals] = useState<Array<{ id: string; name: string }>>([]);
  const [portalId, setPortalId] = useState("");
  const query = useMemo(() => { const params = new URLSearchParams({ page: String(page), limit: "20" }); if (status) params.set("status", status); if (search.trim()) params.set("search", search.trim()); return params.toString(); }, [page, search, status]);
  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const next = portalId
        ? await request(`/api/agent/portals/${portalId}/inquiries?limit=20${status ? `&status=${status}` : ""}`).then((body) => ({ inquiries: body.inquiries, pagination: { page: 1, limit: 20, total: body.counts.total, totalPages: 1 } }))
        : await request(`/api/agent/inquiries?${query}`) as ResponseData;
      setData(next);
      if (portalId && page === 1) {
        const portalBody = await request(`/api/agent/portals/${portalId}/inquiries?limit=1${status ? `&status=${status}` : ""}`);
        setCounts((current) => ({ ...current, ...(portalBody.counts as Record<Status, number>) }));
      } else if (page === 1 && !search.trim()) {
        const countResults = await Promise.all((["NEW", "READ", "RESPONDED", "ARCHIVED"] as Status[]).map((item) => request(`/api/agent/inquiries?status=${item}&limit=1`)));
        setCounts(Object.fromEntries((["NEW", "READ", "RESPONDED", "ARCHIVED"] as Status[]).map((item, index) => [item, countResults[index].pagination.total])) as Record<Status, number>);
      }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load inquiries."); }
    finally { setLoading(false); }
  }, [portalId, query, status]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void request("/api/agent/portals").then((body) => { if (Array.isArray(body)) setPortals(body); }).catch(() => undefined); }, []);
  if (error) return <ErrorState message={error === "UNAUTHORIZED" ? "Your Agent session has expired." : error} retry={() => void load()} />;
  if (!data) return <Skeleton aria-label="Loading inquiries" className="h-96 w-full" />;
  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold">Lead inbox</h1><p className="mt-1 text-sm text-muted-foreground">{data.pagination.total} inquiries</p></div><a className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent" href={`/api/proxy/owner/leads/export.csv?${new URLSearchParams({ ...(status ? { status } : {}), ...(search ? { search } : {}) })}`}>Export CSV</a></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(["NEW", "READ", "RESPONDED", "ARCHIVED"] as Status[]).map((item) => <button type="button" key={item} className={`rounded-md border p-3 text-left ${status === item ? "border-primary bg-card" : "bg-background"}`} onClick={() => { setStatus(status === item ? "" : item); setPage(1); }}><span className="block text-xs text-muted-foreground">{item}</span><strong>{status === item ? data.pagination.total : counts[item]}</strong></button>)}</div>
    <div className="grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-4"><label className="text-sm font-medium sm:col-span-2">Search visitor name, email, or property address<Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label><label className="text-sm font-medium">Status<NativeSelect value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option>NEW</option><option>READ</option><option>RESPONDED</option><option>ARCHIVED</option></NativeSelect></label>{portals.length ? <label className="text-sm font-medium">Portal<NativeSelect value={portalId} onChange={(event) => { setPortalId(event.target.value); setPage(1); }}><option value="">All portals</option>{portals.map((portal) => <option key={portal.id} value={portal.id}>{portal.name}</option>)}</NativeSelect></label> : null}</div>
    {loading ? <Skeleton aria-label="Refreshing inquiries" className="h-32 w-full" /> : data.inquiries.length ? <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]"><div className="flex flex-col gap-3">{data.inquiries.map((inquiry) => <InquiryRow key={inquiry.id} inquiry={inquiry} selected={selected?.id === inquiry.id} onSelect={() => setSelected(inquiry)} onChange={load} />)}</div><InquiryDetail inquiry={selected} onChange={load} /></div> : <Empty title="No inquiries found" description="New portal inquiries will appear here." />}
    {data.pagination.totalPages > 1 ? <nav aria-label="Inquiry pagination" className="flex items-center justify-between"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm text-muted-foreground">Page {page} of {data.pagination.totalPages}</span><Button variant="outline" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button></nav> : null}
  </div>;
}

function InquiryRow({ inquiry, selected, onSelect, onChange }: { inquiry: Inquiry; selected: boolean; onSelect: () => void; onChange: () => Promise<void> }) {
  return <article role="button" tabIndex={0} className={`w-full rounded-md border bg-card p-4 text-left hover:bg-accent/30 ${selected ? "border-primary" : ""}`} onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); } }}><div className="flex justify-between gap-3"><span className="font-medium">{inquiry.visitorName}</span><span className="text-xs text-muted-foreground">{inquiry.status}</span></div><p className="mt-1 text-sm text-muted-foreground">{inquiry.visitorEmail}</p><p className="mt-2 line-clamp-2 text-sm">{inquiry.message}</p><div className="mt-3 flex gap-2">{inquiry.status === "NEW" && inquiry.portalId ? <Button size="xs" variant="outline" onClick={async (event) => { event.stopPropagation(); await updateInquiry(inquiry, "READ"); await onChange(); }}>Mark read</Button> : null}{inquiry.status !== "ARCHIVED" && inquiry.status !== "RESPONDED" && inquiry.portalId ? <Button size="xs" variant="outline" onClick={async (event) => { event.stopPropagation(); await updateInquiry(inquiry, "ARCHIVED"); await onChange(); }}>Archive</Button> : null}</div></article>;
}

async function updateInquiry(inquiry: Inquiry, status: "READ" | "ARCHIVED") {
  if (!inquiry.portalId) throw new Error("This inquiry has no portal scope.");
  await request(`/api/agent/portals/${inquiry.portalId}/inquiries/${inquiry.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

function InquiryDetail({ inquiry, onChange }: { inquiry: Inquiry | null; onChange: () => Promise<void> }) {
  const [response, setResponse] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  if (!inquiry) return <Card><CardContent className="pt-6"><Empty compact title="Select an inquiry" description="Review the message and respond from this panel." /></CardContent></Card>;
  const property = inquiry.property ?? inquiry.listing?.property;
  return <Card className="h-fit lg:sticky lg:top-24"><CardHeader><CardTitle>Inquiry details</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div><p className="font-semibold">{inquiry.visitorName}</p><p>{inquiry.visitorEmail}</p>{inquiry.visitorPhone ? <p>{inquiry.visitorPhone}</p> : null}</div>{property ? <p className="border-l-2 border-primary pl-3">{property.address}, {property.city}, {property.state}</p> : null}<p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3">{inquiry.message}</p><p className="text-xs text-muted-foreground">Status: {inquiry.status} · {new Date(inquiry.createdAt).toLocaleString()}</p>{inquiry.agentResponse ? <div className="rounded-md border p-3"><p className="text-xs font-semibold uppercase text-muted-foreground">Response</p><p className="mt-1 whitespace-pre-wrap">{inquiry.agentResponse}</p></div> : null}{inquiry.status !== "RESPONDED" && inquiry.status !== "ARCHIVED" ? <form className="space-y-2 border-t pt-3" onSubmit={async (event) => { event.preventDefault(); if (!response.trim()) return; try { setSaving(true); setError(""); await request(`/api/agent/inquiries/${inquiry.id}/respond`, { method: "PUT", body: JSON.stringify({ agentResponse: response }) }); setResponse(""); await onChange(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to respond."); } finally { setSaving(false); } }}><label className="text-sm font-medium">Response<textarea aria-label="Inquiry response" className="mt-1 min-h-28 w-full rounded-md border bg-background p-2" value={response} onChange={(event) => setResponse(event.target.value)} /></label>{error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}<Button type="submit" disabled={saving || !response.trim()}>{saving ? "Saving..." : "Respond"}</Button></form> : <p className="text-xs text-muted-foreground">{inquiry.status === "RESPONDED" ? "This inquiry has already been responded to and cannot move backward." : "Archived inquiries cannot be responded to."}</p>}</CardContent></Card>;
}
