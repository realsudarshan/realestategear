"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@realestategear/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@realestategear/ui/card";
import { Empty } from "@realestategear/ui/empty";
import { Input } from "@realestategear/ui/input";
import { NativeSelect } from "@realestategear/ui/native-select";
import { Skeleton } from "@realestategear/ui/skeleton";
import { Textarea } from "@realestategear/ui/textarea";
import type { AgentContact, AgentContactListResponse, AgentTransaction, AgentTransactionListResponse, AgentTransactionTemplate } from "@/lib/agent";
import { AgentTransactionDocuments } from "./agent-transaction-documents";
import { AgentNotePanel, AgentTaskPanel } from "./agent-productivity";

const STAGES = ["PROSPECT", "SIGNED", "LISTED", "PENDING", "CLOSED"];

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("UNAUTHORIZED");
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

function money(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount) : String(value);
}

function date(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="flex flex-col gap-3"><p className="text-sm text-destructive">{message}</p><Button variant="outline" onClick={retry}>Retry</Button></div>;
}

function TransactionFields({ value, onChange }: { value: Record<string, string>; onChange: (key: string, value: string) => void }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-medium">Type<Input required value={value.type} onChange={(e) => onChange("type", e.target.value)} placeholder="BUY" /></label>
    <label className="text-sm font-medium">Stage<NativeSelect value={value.stage} onChange={(e) => onChange("stage", e.target.value)}>{STAGES.map((stage) => <option key={stage}>{stage}</option>)}</NativeSelect></label>
    <label className="text-sm font-medium sm:col-span-2">Address<Input value={value.address} onChange={(e) => onChange("address", e.target.value)} /></label>
    <label className="text-sm font-medium">MLS ID<Input value={value.mlsId} onChange={(e) => onChange("mlsId", e.target.value)} /></label>
    <label className="text-sm font-medium">List price<Input type="number" value={value.listPrice} onChange={(e) => onChange("listPrice", e.target.value)} /></label>
    <label className="text-sm font-medium">Sale price<Input type="number" value={value.salePrice} onChange={(e) => onChange("salePrice", e.target.value)} /></label>
    <label className="text-sm font-medium">Commission rate<Input type="number" step="0.01" value={value.commissionRate} onChange={(e) => onChange("commissionRate", e.target.value)} /></label>
    <label className="text-sm font-medium">Closing date<Input type="date" value={value.closingDate} onChange={(e) => onChange("closingDate", e.target.value)} /></label>
    <label className="text-sm font-medium sm:col-span-2">Notes<Textarea value={value.notes} onChange={(e) => onChange("notes", e.target.value)} /></label>
  </div>;
}

function transactionPayload(value: Record<string, string>) {
  return { ...value, listPrice: value.listPrice || null, salePrice: value.salePrice || null, commissionRate: value.commissionRate || null, closingDate: value.closingDate || null, address: value.address || null, mlsId: value.mlsId || null, notes: value.notes || null };
}

export function AgentTransactionsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [result, setResult] = useState<AgentTransactionListResponse | null>(null);
  const [error, setError] = useState("");
  const query = params.toString();
  const load = useCallback(async () => {
    try { setError(""); setResult(await request(`/api/agent/transactions${query ? `?${query}` : ""}`)); }
    catch (err) { if (err instanceof Error && err.message === "UNAUTHORIZED") { router.push(`/agent/login?from=${encodeURIComponent(pathname)}`); return; } setError(err instanceof Error ? err.message : "Unable to load transactions."); }
  }, [pathname, query, router]);
  useEffect(() => { void load(); }, [load]);
  const update = (key: string, value: string) => { const next = new URLSearchParams(params.toString()); if (value) next.set(key, value); else next.delete(key); if (key !== "page") next.delete("page"); router.replace(`${pathname}?${next.toString()}`); };
  if (error) return <ErrorState message={error} retry={() => void load()} />;
  if (!result) return <div aria-label="Loading transactions" aria-busy="true" className="flex flex-col gap-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-80 w-full" /></div>;
  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-xl font-semibold">Transactions</h1><p className="mt-1 text-sm text-muted-foreground">{result.pagination.total} transactions in your CRM.</p></div><Button asChild><Link href="/agent/transactions/new">Add transaction</Link></Button></div>
    <div className="flex flex-wrap gap-2" aria-label="Transaction views"><Button asChild variant="outline"><Link href="/agent/transactions/pipeline">Pipeline</Link></Button><Button asChild variant="outline"><Link href="/agent/transactions/new?mode=milestones">Create from milestones</Link></Button></div>
    <form className="grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-4" aria-label="Transaction filters" onSubmit={(e) => e.preventDefault()}><label className="text-sm font-medium sm:col-span-2">Search<Input value={params.get("search") ?? ""} onChange={(e) => update("search", e.target.value)} placeholder="Address or party name" /></label><label className="text-sm font-medium">Stage<NativeSelect value={params.get("stage") ?? ""} onChange={(e) => update("stage", e.target.value)}><option value="">All stages</option>{STAGES.map((stage) => <option key={stage}>{stage}</option>)}</NativeSelect></label><label className="text-sm font-medium">Sort<NativeSelect value={params.get("sortBy") ?? "created_desc"} onChange={(e) => update("sortBy", e.target.value)}><option value="created_desc">Newest</option><option value="closing_asc">Closing date</option><option value="price_desc">Highest price</option></NativeSelect></label></form>
    {result.transactions.length === 0 ? <Empty title="No transactions found" description="Create a transaction or adjust your filters." action={<Button asChild><Link href="/agent/transactions/new">Add transaction</Link></Button>} /> : <div className="overflow-x-auto rounded-md border bg-card"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Transactions</caption><thead className="border-b text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Address</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Closing</th><th className="px-4 py-3">Parties</th></tr></thead><tbody className="divide-y">{result.transactions.map((tx) => <tr key={tx.id}><td className="px-4 py-3"><Link className="font-medium text-primary hover:underline" href={`/agent/transactions/${tx.id}`}>{tx.address || tx.property?.address || "Untitled transaction"}</Link></td><td className="px-4 py-3">{tx.stage}</td><td className="px-4 py-3">{money(tx.listPrice)}</td><td className="px-4 py-3">{date(tx.closingDate)}</td><td className="px-4 py-3">{tx.parties.length}</td></tr>)}</tbody></table></div>}
    {result.pagination.totalPages > 1 ? <nav aria-label="Transaction pagination" className="flex items-center justify-between"><Button variant="outline" disabled={result.pagination.page <= 1} onClick={() => update("page", String(result.pagination.page - 1))}>Previous</Button><span className="text-sm text-muted-foreground">Page {result.pagination.page} of {result.pagination.totalPages}</span><Button variant="outline" disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => update("page", String(result.pagination.page + 1))}>Next</Button></nav> : null}
  </div>;
}

export function AgentTransactionPipeline() {
  const [pipeline, setPipeline] = useState<Record<string, AgentTransaction[]> | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => { try { setPipeline(await request("/api/agent/transactions/pipeline")); } catch (err) { setError(err instanceof Error && err.message === "UNAUTHORIZED" ? "Your session has expired." : err instanceof Error ? err.message : "Unable to load pipeline."); } }, []);
  useEffect(() => { void load(); }, [load]);
  if (error) return <ErrorState message={error} retry={() => void load()} />;
  if (!pipeline) return <div aria-label="Loading transaction pipeline" aria-busy="true"><Skeleton className="h-72 w-full" /></div>;
  return <div className="flex flex-col gap-6"><div className="flex items-center justify-between"><div><h1 className="text-xl font-semibold">Transaction pipeline</h1><p className="mt-1 text-sm text-muted-foreground">Select a stage to review its transactions. Stage movement is intentionally explicit.</p></div><Button asChild variant="outline"><Link href="/agent/transactions">List view</Link></Button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{STAGES.map((stage) => <section key={stage} aria-labelledby={`stage-${stage}`} className="min-h-48 rounded-md border bg-card p-3"><div className="mb-3 flex items-center justify-between"><h2 id={`stage-${stage}`} className="text-sm font-semibold">{stage}</h2><span className="font-mono text-xs text-muted-foreground">{pipeline[stage]?.length ?? 0}</span></div><div className="flex flex-col gap-2">{(pipeline[stage] ?? []).map((tx) => <Link key={tx.id} href={`/agent/transactions/${tx.id}`} className="rounded-md border p-3 text-sm hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="font-medium">{tx.address || "Untitled transaction"}</span><span className="mt-1 block text-xs text-muted-foreground">{money(tx.listPrice)} · {tx.parties.length} parties</span></Link>)}</div></section>)}</div></div>;
}

const emptyTransaction = { type: "BUY", stage: "PROSPECT", address: "", mlsId: "", listPrice: "", salePrice: "", commissionRate: "", closingDate: "", notes: "" };

export function AgentTransactionCreate() {
  const router = useRouter();
  const params = useSearchParams();
  const milestoneMode = params.get("mode") === "milestones";
  const [value, setValue] = useState(emptyTransaction);
  const [template, setTemplate] = useState<AgentTransactionTemplate | null>(null);
  const [milestones, setMilestones] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (milestoneMode) void request("/api/agent/transactions/setup-template").then(setTemplate).catch((err) => setError(err.message)); }, [milestoneMode]);
  const set = (key: string, next: string) => setValue((current) => ({ ...current, [key]: next }));
  const create = async (event: React.FormEvent) => { event.preventDefault(); try { setError(""); const body = { ...transactionPayload(value), milestoneDates: milestones }; const created = milestoneMode ? await request("/api/agent/transactions/create-from-milestones", { method: "POST", body: JSON.stringify(body) }) : await request("/api/agent/transactions", { method: "POST", body: JSON.stringify(body) }); router.push(`/agent/transactions/${created.id}`); } catch (err) { setError(err instanceof Error ? err.message : "Unable to create transaction."); } };
  const getPreview = async () => { try { setError(""); setPreview(await request("/api/agent/transactions/preview", { method: "POST", body: JSON.stringify({ milestoneDates: milestones, type: value.type }) })); } catch (err) { setError(err instanceof Error ? err.message : "Unable to preview milestones."); } };
  return <div className="mx-auto max-w-3xl"><Link href="/agent/transactions" className="text-sm text-muted-foreground hover:text-foreground">← Transactions</Link><h1 className="mt-4 text-xl font-semibold">{milestoneMode ? "Create from milestones" : "Add transaction"}</h1><Card className="mt-6"><CardContent className="pt-6"><form onSubmit={create} className="flex flex-col gap-5" aria-label="Transaction form">{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<TransactionFields value={value} onChange={set}/>{milestoneMode ? <div className="rounded-md border p-4"><h2 className="font-semibold">Milestones</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{(template?.milestones ?? []).map((milestone) => <label key={milestone.key} className="text-sm font-medium">{milestone.label}<Input required={milestone.required} type="date" value={milestones[milestone.key] ?? ""} onChange={(e) => setMilestones((current) => ({ ...current, [milestone.key]: e.target.value }))}/></label>)}</div><div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void getPreview()}>Preview plan</Button>{preview ? <span className="text-sm text-muted-foreground">{String((preview.validation as { requiredMissing?: unknown[] })?.requiredMissing?.length ?? 0)} required dates missing</span> : null}</div></div> : null}<Button type="submit">{milestoneMode ? "Create transaction and plan" : "Create transaction"}</Button></form></CardContent></Card></div>;
}

export function AgentTransactionDetail({ id }: { id: string }) {
  const router = useRouter();
  const [transaction, setTransaction] = useState<AgentTransaction | null>(null);
  const [contacts, setContacts] = useState<AgentContact[]>([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [party, setParty] = useState({ contactId: "", role: "BUYER" });
  const [value, setValue] = useState(emptyTransaction);
  const load = useCallback(async () => { try { const [detail, contactResult] = await Promise.all([request(`/api/agent/transactions/${id}`), request("/api/agent/contacts?limit=100")]); setTransaction(detail); setContacts((contactResult as AgentContactListResponse).contacts); setValue({ type: detail.type, stage: detail.stage, address: detail.address ?? "", mlsId: detail.mlsId ?? "", listPrice: detail.listPrice?.toString() ?? "", salePrice: detail.salePrice?.toString() ?? "", commissionRate: detail.commissionRate?.toString() ?? "", closingDate: detail.closingDate?.slice(0, 10) ?? "", notes: detail.notes ?? "" }); } catch (err) { setError(err instanceof Error && err.message === "UNAUTHORIZED" ? "Your session has expired." : err instanceof Error ? err.message : "Unable to load transaction."); } }, [id]);
  useEffect(() => { void load(); }, [load]);
  if (error) return <ErrorState message={error} retry={() => void load()} />;
  if (!transaction) return <div aria-label="Loading transaction" aria-busy="true"><Skeleton className="h-72 w-full" /></div>;
  const update = async (event: React.FormEvent) => { event.preventDefault(); try { const updated = await request(`/api/agent/transactions/${id}`, { method: "PUT", body: JSON.stringify(transactionPayload(value)) }); setTransaction((current) => ({ ...current, ...updated })); setEditing(false); } catch (err) { setError(err instanceof Error ? err.message : "Unable to update transaction."); } };
  const remove = async () => { if (!window.confirm("Delete this transaction?")) return; await request(`/api/agent/transactions/${id}`, { method: "DELETE" }); router.push("/agent/transactions"); };
  const addParty = async () => { await request(`/api/agent/transactions/${id}/parties`, { method: "POST", body: JSON.stringify(party) }); setParty({ contactId: "", role: "BUYER" }); await load(); };
  const removeParty = async (contactId: string, role: string) => { await request(`/api/agent/transactions/${id}/parties`, { method: "DELETE", body: JSON.stringify({ contactId, role }) }); await load(); };
  return <div className="flex flex-col gap-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/agent/transactions" className="text-sm text-muted-foreground hover:text-foreground">← Transactions</Link><h1 className="mt-3 text-2xl font-semibold">{transaction.address || "Untitled transaction"}</h1><p className="text-sm text-muted-foreground">{transaction.type} · {transaction.stage}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => setEditing((current) => !current)}>{editing ? "Cancel edit" : "Edit"}</Button><Button variant="destructive" onClick={() => void remove()}>Delete</Button></div></div>
    {editing ? <Card><CardHeader><CardTitle>Edit transaction</CardTitle></CardHeader><CardContent><form onSubmit={update} className="flex flex-col gap-4"><TransactionFields value={value} onChange={(key, next) => setValue((current) => ({ ...current, [key]: next }))}/><Button type="submit">Save changes</Button></form></CardContent></Card> : null}
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Transaction details</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2"><p><span className="text-muted-foreground">Stage</span><br />{transaction.stage}</p><p><span className="text-muted-foreground">List price</span><br />{money(transaction.listPrice)}</p><p><span className="text-muted-foreground">Sale price</span><br />{money(transaction.salePrice)}</p><p><span className="text-muted-foreground">Commission</span><br />{transaction.commissionRate ?? "—"}%</p><p><span className="text-muted-foreground">Closing date</span><br />{date(transaction.closingDate)}</p><p className="sm:col-span-2"><span className="text-muted-foreground">Notes</span><br />{transaction.notes || "—"}</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Parties</CardTitle></CardHeader><CardContent className="flex flex-col gap-4"><div className="flex flex-col gap-2">{transaction.parties.map((item) => <div key={`${item.contactId}-${item.role}`} className="flex items-center justify-between gap-2 rounded border p-2 text-sm"><span>{item.contact.firstName} {item.contact.lastName} · {item.role}</span><Button size="xs" variant="ghost" onClick={() => void removeParty(item.contactId, item.role)}>Remove</Button></div>)}</div><div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]"><NativeSelect aria-label="Contact" value={party.contactId} onChange={(e) => setParty({ ...party, contactId: e.target.value })}><option value="">Select contact</option>{contacts.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</NativeSelect><NativeSelect aria-label="Party role" value={party.role} onChange={(e) => setParty({ ...party, role: e.target.value })}><option>BUYER</option><option>SELLER</option><option>AGENT</option><option>LENDER</option></NativeSelect><Button disabled={!party.contactId} onClick={() => void addParty()}>Add</Button></div></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Milestones and tasks</CardTitle></CardHeader><CardContent>{transaction.milestones?.length ? <ul className="divide-y">{transaction.milestones.map((milestone) => <li key={milestone.id} className="flex justify-between py-2 text-sm"><span>{milestone.milestoneDefinition.label}</span><span>{date(milestone.date)}</span></li>)}</ul> : <Empty compact title="No milestones" description="This transaction was not created from a milestone plan." />}{transaction.tasks?.length ? <ul className="mt-4 divide-y">{transaction.tasks.map((task) => <li key={task.id} className="flex justify-between py-2 text-sm"><span>{task.title}</span><span>{date(task.dueDate)} · {task.status}</span></li>)}</ul> : null}</CardContent></Card>
    <AgentTransactionDocuments transactionId={id} />
    <AgentTaskPanel transactionId={id} />
    <AgentNotePanel transactionId={id} />
  </div>;
}
