"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@realestategear/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@realestategear/ui/card";
import { Empty } from "@realestategear/ui/empty";
import { Input } from "@realestategear/ui/input";
import { NativeSelect } from "@realestategear/ui/native-select";
import { Skeleton } from "@realestategear/ui/skeleton";
import { Textarea } from "@realestategear/ui/textarea";
import { contactFormPayload, AgentContactForm } from "./agent-contact-form";
import type { AgentContact, AgentContactListResponse, AgentInteraction } from "@/lib/agent";
import { AgentNotePanel, AgentTaskPanel } from "./agent-productivity";
import { GoogleContactActivity } from "./agent-google-workspace";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("UNAUTHORIZED");
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="flex flex-col gap-3"><p className="text-sm text-destructive">{message}</p><Button variant="outline" onClick={retry}>Retry</Button></div>;
}

export function AgentContactsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [result, setResult] = useState<AgentContactListResponse | null>(null);
  const [error, setError] = useState("");
  const query = params.toString();
  const load = useCallback(async () => {
    setError("");
    try { setResult(await request(`/api/agent/contacts${query ? `?${query}` : ""}`)); }
    catch (err) { if (err instanceof Error && err.message === "UNAUTHORIZED") { router.push(`/agent/login?from=${encodeURIComponent(pathname)}`); return; } setError(err instanceof Error ? err.message : "Unable to load contacts."); }
  }, [pathname, query, router]);
  useEffect(() => { void load(); }, [load]);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  };
  if (error) return <ErrorState message={error} retry={() => void load()} />;
  if (!result) return <div aria-label="Loading contacts" aria-busy="true" className="flex flex-col gap-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-80 w-full" /></div>;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-xl font-semibold">Contacts</h1><p className="mt-1 text-sm text-muted-foreground">{result.pagination.total} contacts in your CRM.</p></div><Button asChild><Link href="/agent/contacts/new">Add contact</Link></Button></div>
      <form className="grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-4" onSubmit={(e) => e.preventDefault()} aria-label="Contact filters">
        <label className="text-sm font-medium sm:col-span-2">Search<Input defaultValue={params.get("search") ?? ""} onChange={(e) => update("search", e.target.value)} placeholder="Name, email, company, phone" /></label>
        <label className="text-sm font-medium">Lifecycle<NativeSelect value={params.get("lifecycle") ?? ""} onChange={(e) => update("lifecycle", e.target.value)}><option value="">All</option><option value="prospect">Prospect</option><option value="active-lead">Active lead</option><option value="client">Client</option><option value="vendor">Vendor</option></NativeSelect></label>
        <label className="text-sm font-medium">Sort<NativeSelect value={params.get("sortBy") ?? "created_desc"} onChange={(e) => update("sortBy", e.target.value)}><option value="created_desc">Newest</option><option value="created_asc">Oldest</option><option value="name_asc">Name A–Z</option><option value="name_desc">Name Z–A</option></NativeSelect></label>
      </form>
      {result.contacts.length === 0 ? <Empty title="No contacts found" description="Try changing your filters or add your first contact." action={<Button asChild><Link href="/agent/contacts/new">Add contact</Link></Button>} /> : <div className="overflow-x-auto rounded-md border bg-card"><table className="w-full min-w-[680px] text-left text-sm"><caption className="sr-only">Contacts</caption><thead className="border-b text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Type / stage</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Tracks</th><th className="px-4 py-3">Last contact</th></tr></thead><tbody className="divide-y">{result.contacts.map((contact) => <tr key={contact.id} className="hover:bg-accent/30"><td className="px-4 py-3"><Link className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/agent/contacts/${contact.id}`}>{contact.firstName} {contact.lastName}</Link><div className="text-xs text-muted-foreground">{contact.email || contact.phone || "No contact details"}</div></td><td className="px-4 py-3">{contact.type} · {contact.stage}</td><td className="px-4 py-3">{contact.source || "—"}</td><td className="px-4 py-3">{[contact.buyerTrack?.stage && `Buyer: ${contact.buyerTrack.stage}`, contact.sellerTrack?.stage && `Seller: ${contact.sellerTrack.stage}`].filter(Boolean).join(" · ") || "—"}</td><td className="px-4 py-3">{formatDate(contact.lastContactAt)}</td></tr>)}</tbody></table></div>}
      {result.pagination.totalPages > 1 ? <nav aria-label="Contacts pagination" className="flex items-center justify-between"><Button variant="outline" disabled={result.pagination.page <= 1} onClick={() => update("page", String(result.pagination.page - 1))}>Previous</Button><span className="text-sm text-muted-foreground">Page {result.pagination.page} of {result.pagination.totalPages}</span><Button variant="outline" disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => update("page", String(result.pagination.page + 1))}>Next</Button></nav> : null}
    </div>
  );
}

export function AgentContactCreate() {
  const router = useRouter();
  return <div className="mx-auto max-w-3xl"><Link href="/agent/contacts" className="text-sm text-muted-foreground hover:text-foreground">← Contacts</Link><h1 className="mt-4 text-xl font-semibold">Add contact</h1><Card className="mt-6"><CardContent className="pt-6"><AgentContactForm submitLabel="Create contact" onSubmit={async (values) => { const contact = await request("/api/agent/contacts", { method: "POST", body: JSON.stringify(contactFormPayload(values)) }); router.push(`/agent/contacts/${contact.id}`); }} /></CardContent></Card></div>;
}

export function AgentContactDetail({ id }: { id: string }) {
  const router = useRouter();
  const [contact, setContact] = useState<AgentContact | null>(null);
  const [interactions, setInteractions] = useState<AgentInteraction[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [interactionForm, setInteractionForm] = useState({ type: "NOTE", side: "", subject: "", body: "", occurredAt: "", duration: "" });
  const [editingInteraction, setEditingInteraction] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const load = useCallback(async () => {
    try { const [detail, timeline] = await Promise.all([request(`/api/agent/contacts/${id}`), request(`/api/agent/contacts/${id}/interactions`)]); setContact(detail); setInteractions(timeline); }
    catch (err) { if (err instanceof Error && err.message === "UNAUTHORIZED") { router.push(`/agent/login?from=/agent/contacts/${id}`); return; } setError(err instanceof Error ? err.message : "Unable to load contact."); }
  }, [id, router]);
  useEffect(() => { void load(); }, [load]);
  if (error) return <ErrorState message={error} retry={() => void load()} />;
  if (!contact) return <div aria-label="Loading contact" aria-busy="true" className="flex flex-col gap-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  const saveInteraction = async (event: React.FormEvent) => { event.preventDefault(); const payload = { ...interactionForm, duration: interactionForm.duration || null, occurredAt: interactionForm.occurredAt || undefined }; const path = editingInteraction ? `/api/agent/contacts/${id}/interactions/${editingInteraction}` : `/api/agent/contacts/${id}/interactions`; await request(path, { method: editingInteraction ? "PUT" : "POST", body: JSON.stringify(payload) }); setInteractionForm({ type: "NOTE", side: "", subject: "", body: "", occurredAt: "", duration: "" }); setEditingInteraction(null); await load(); };
  const deleteContact = async () => { if (!window.confirm(`Delete ${contact.firstName} ${contact.lastName}?`)) return; await request(`/api/agent/contacts/${id}`, { method: "DELETE" }); router.push("/agent/contacts"); };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/agent/contacts" className="text-sm text-muted-foreground hover:text-foreground">← Contacts</Link><h1 className="mt-3 text-2xl font-semibold">{contact.firstName} {contact.lastName}</h1><p className="text-sm text-muted-foreground">{contact.type} · {contact.stage}{contact.source ? ` · ${contact.source}` : ""}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel edit" : "Edit"}</Button><Button variant="destructive" onClick={() => void deleteContact()}>Delete</Button></div></div>
      {editing ? <Card><CardHeader><CardTitle>Edit contact</CardTitle></CardHeader><CardContent><AgentContactForm initial={{ ...contact, tags: contact.tags?.join(", ") ?? "", buyerStage: contact.buyerTrack?.stage ?? "", sellerStage: contact.sellerTrack?.stage ?? "" }} submitLabel="Save changes" onSubmit={async (values) => { const updated = await request(`/api/agent/contacts/${id}`, { method: "PUT", body: JSON.stringify(contactFormPayload(values)) }); setContact(updated); setEditing(false); }} /></CardContent></Card> : null}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><Card><CardHeader><CardTitle>Contact details</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2"><p><span className="text-muted-foreground">Email</span><br />{contact.email || "—"}</p><p><span className="text-muted-foreground">Phone</span><br />{contact.phone || "—"}</p><p><span className="text-muted-foreground">Company</span><br />{contact.company || "—"}</p><p><span className="text-muted-foreground">Tags</span><br />{contact.tags?.join(", ") || "—"}</p><p><span className="text-muted-foreground">Buyer track</span><br />{contact.buyerTrack?.stage || "—"}</p><p><span className="text-muted-foreground">Seller track</span><br />{contact.sellerTrack?.stage || "—"}</p></CardContent></Card><Card><CardHeader><CardTitle>Portal user</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 text-sm">{contact.user ? <><p>{contact.user.firstName} {contact.user.lastName}<br /><span className="text-muted-foreground">{contact.user.email}</span></p><Button variant="outline" onClick={async () => { await request(`/api/agent/contacts/${id}/link`, { method: "DELETE" }); await load(); }}>Unlink user</Button></> : <><label>Portal user email<Input value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} type="email" /></label><Button onClick={async () => { await request(`/api/agent/contacts/${id}/link`, { method: "PUT", body: JSON.stringify({ email: linkEmail }) }); setLinkEmail(""); await load(); }}>Link user</Button></>}</CardContent></Card></div>
      <Card><CardHeader><CardTitle>Interaction timeline</CardTitle></CardHeader><CardContent className="flex flex-col gap-5"><form onSubmit={saveInteraction} className="grid gap-3 rounded-md border p-4" aria-label="Interaction form"><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium">Type<NativeSelect value={interactionForm.type} onChange={(e) => setInteractionForm({ ...interactionForm, type: e.target.value })}><option>NOTE</option><option>CALL</option><option>EMAIL</option><option>MEETING</option><option>TOUR</option><option>CONSULT</option></NativeSelect></label><label className="text-sm font-medium">Side<Input value={interactionForm.side} onChange={(e) => setInteractionForm({ ...interactionForm, side: e.target.value })} /></label><label className="text-sm font-medium">Occurred at<Input type="datetime-local" value={interactionForm.occurredAt} onChange={(e) => setInteractionForm({ ...interactionForm, occurredAt: e.target.value })} /></label></div><label className="text-sm font-medium">Subject<Input value={interactionForm.subject} onChange={(e) => setInteractionForm({ ...interactionForm, subject: e.target.value })} /></label><label className="text-sm font-medium">Notes<Textarea value={interactionForm.body} onChange={(e) => setInteractionForm({ ...interactionForm, body: e.target.value })} /></label><div className="flex gap-2"><Button type="submit">{editingInteraction ? "Save interaction" : "Add interaction"}</Button>{editingInteraction ? <Button type="button" variant="outline" onClick={() => setEditingInteraction(null)}>Cancel</Button> : null}</div></form>{interactions.length === 0 ? <Empty compact title="No interactions yet" description="Add the first call, note, email, meeting, or tour." /> : <ol className="flex flex-col divide-y">{interactions.map((interaction) => <li key={interaction.id} className="py-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-medium">{interaction.subject || interaction.type}</p><p className="text-xs text-muted-foreground">{interaction.type} · {formatDate(interaction.occurredAt)}{interaction.side ? ` · ${interaction.side}` : ""}</p></div><div className="flex gap-2"><Button size="xs" variant="ghost" onClick={() => { setEditingInteraction(interaction.id); setInteractionForm({ type: interaction.type, side: interaction.side || "", subject: interaction.subject || "", body: interaction.body || "", occurredAt: interaction.occurredAt.slice(0, 16), duration: interaction.duration?.toString() || "" }); }}>Edit</Button><Button size="xs" variant="ghost" onClick={async () => { await request(`/api/agent/contacts/${id}/interactions/${interaction.id}`, { method: "DELETE" }); await load(); }}>Delete</Button></div></div>{interaction.body ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{interaction.body}</p> : null}</li>)}</ol>}</CardContent></Card>
      <AgentTaskPanel contactId={id} />
      <AgentNotePanel contactId={id} />
      <GoogleContactActivity contactId={id} />
    </div>
  );
}
