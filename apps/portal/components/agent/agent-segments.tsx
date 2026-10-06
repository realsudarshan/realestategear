"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@realestategear/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@realestategear/ui/card";
import { Empty } from "@realestategear/ui/empty";
import { Input } from "@realestategear/ui/input";
import { NativeSelect } from "@realestategear/ui/native-select";
import { Skeleton } from "@realestategear/ui/skeleton";

type Numeric = { min?: number; max?: number; nulls: "exclude" | "include" | "only" };
type Predicate = {
  areaSlugs?: string[]; tagsAny?: string[]; tagsAll?: string[]; tagsExclude?: string[];
  propertyTypes?: string[]; price?: Numeric; beds?: Numeric; baths?: Numeric;
  sqft?: Numeric; lotSize?: Numeric; yearBuilt?: Numeric;
};
type Segment = { id: string; name: string; slug: string; predicate: Predicate; isPublished?: boolean; _count?: { portals: number } };
const PROPERTY_TYPES = ["SINGLE_FAMILY", "CONDO", "TOWNHOUSE", "MULTI_FAMILY", "LAND", "COMMERCIAL"];
const NUMERIC_FIELDS = [["price", "Price"], ["beds", "Beds"], ["baths", "Baths"], ["sqft", "Square feet"], ["lotSize", "Lot size"], ["yearBuilt", "Year built"]] as const;

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("UNAUTHORIZED");
  if (!response.ok) throw new Error(body.error || "Segment request failed.");
  return body;
}
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div role="alert" className="flex flex-col gap-3"><p className="text-sm text-destructive">{message}</p><Button variant="outline" onClick={retry}>Retry</Button></div>; }
function parseList(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
const emptyPredicate: Predicate = {};

function NumericField({ field, label, value, onChange }: { field: keyof Predicate; label: string; value?: Numeric; onChange: (value: Numeric | undefined) => void }) {
  return <fieldset className="rounded-md border p-3"><legend className="px-1 text-sm font-medium">{label}</legend><div className="grid gap-2 sm:grid-cols-3"><Input aria-label={`${label} minimum`} type="number" placeholder="Minimum" value={value?.min ?? ""} onChange={(event) => onChange({ nulls: value?.nulls ?? "exclude", ...(event.target.value ? { min: Number(event.target.value) } : {}), ...(value?.max != null ? { max: value.max } : {}) })} /><Input aria-label={`${label} maximum`} type="number" placeholder="Maximum" value={value?.max ?? ""} onChange={(event) => onChange({ nulls: value?.nulls ?? "exclude", ...(value?.min != null ? { min: value.min } : {}), ...(event.target.value ? { max: Number(event.target.value) } : {}) })} /><NativeSelect aria-label={`${label} null handling`} value={value?.nulls ?? "exclude"} onChange={(event) => onChange({ nulls: event.target.value as Numeric["nulls"], ...(value?.min != null ? { min: value.min } : {}), ...(value?.max != null ? { max: value.max } : {}) })}><option value="exclude">Exclude missing</option><option value="include">Include missing</option><option value="only">Only missing</option></NativeSelect></div></fieldset>;
}

function PredicateEditor({ value, onChange, suggestions }: { value: Predicate; onChange: (value: Predicate) => void; suggestions: Record<string, string[]> }) {
  const setList = (key: keyof Predicate, text: string) => onChange({ ...value, [key]: parseList(text) });
  return <div className="grid gap-3"><p className="text-xs text-muted-foreground">Supported filters are limited to configured areas/tags, property types, and numeric ranges for price, beds, baths, square feet, lot size, and year built.</p><label className="text-sm font-medium">Area slugs<Input value={value.areaSlugs?.join(", ") ?? ""} onChange={(e) => setList("areaSlugs", e.target.value)} placeholder={suggestions.areas?.join(", ") || "area-slug"} /></label><label className="text-sm font-medium">Tags match any<Input value={value.tagsAny?.join(", ") ?? ""} onChange={(e) => setList("tagsAny", e.target.value)} placeholder={suggestions.tags?.join(", ") || "tag-slug"} /></label><label className="text-sm font-medium">Tags match all<Input value={value.tagsAll?.join(", ") ?? ""} onChange={(e) => setList("tagsAll", e.target.value)} /></label><label className="text-sm font-medium">Exclude tags<Input value={value.tagsExclude?.join(", ") ?? ""} onChange={(e) => setList("tagsExclude", e.target.value)} /></label><fieldset className="rounded-md border p-3"><legend className="px-1 text-sm font-medium">Property types</legend><div className="grid gap-2 sm:grid-cols-3">{PROPERTY_TYPES.map((type) => <label key={type} className="text-xs"><input type="checkbox" checked={value.propertyTypes?.includes(type) ?? false} onChange={(e) => onChange({ ...value, propertyTypes: e.target.checked ? [...(value.propertyTypes ?? []), type] : (value.propertyTypes ?? []).filter((item) => item !== type) })} /> <span className="ml-1">{type}</span></label>)}</div></fieldset>{NUMERIC_FIELDS.map(([field, label]) => <NumericField key={field} field={field} label={label} value={value[field]} onChange={(next) => onChange({ ...value, ...(next ? { [field]: next } : {}) })} />)}</div>;
}

function SegmentForm({ initial, onSubmit, submitLabel, suggestions }: { initial: Segment | null; onSubmit: (name: string, slug: string, predicate: Predicate) => Promise<void>; submitLabel: string; suggestions: Record<string, string[]> }) {
  const [name, setName] = useState(initial?.name ?? ""); const [slug, setSlug] = useState(initial?.slug ?? ""); const [predicate, setPredicate] = useState<Predicate>(initial?.predicate ?? emptyPredicate); const [error, setError] = useState("");
  return <form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); if (!name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { setError("Name and a stable lowercase slug are required."); return; } try { setError(""); await onSubmit(name.trim(), slug, predicate); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save segment."); } }}><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Name<Input aria-label="Segment name" required value={name} onChange={(e) => setName(e.target.value)} /></label><label className="text-sm font-medium">Slug<Input aria-label="Segment slug" required value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} /><span className="mt-1 block text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens.</span></label></div><PredicateEditor value={predicate} onChange={setPredicate} suggestions={suggestions} />{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<Button type="submit">{submitLabel}</Button></form>;
}

export function AgentSegmentsPage() {
  const [segments, setSegments] = useState<Segment[] | null>(null); const [suggestions, setSuggestions] = useState<Record<string, string[]>>({}); const [creating, setCreating] = useState(false); const [editing, setEditing] = useState<Segment | null>(null); const [error, setError] = useState("");
  const load = useCallback(async () => { try { setError(""); const [rows, available] = await Promise.all([request("/api/agent/segments"), request("/api/agent/segments/suggestions")]); setSegments(rows); setSuggestions(available.values ?? available); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load segments."); } }, []);
  useEffect(() => { void load(); }, [load]);
  if (error) return <ErrorState message={error} retry={() => void load()} />; if (!segments) return <Skeleton aria-label="Loading segments" className="h-96 w-full" />;
  const create = async (name: string, slug: string, predicate: Predicate) => { await request("/api/agent/segments", { method: "POST", body: JSON.stringify({ name, slug, predicate }) }); setCreating(false); await load(); };
  const update = async (name: string, slug: string, predicate: Predicate) => { if (!editing) return; await request(`/api/agent/segments/${editing.id}`, { method: "PUT", body: JSON.stringify({ name, predicate }) }); setEditing(null); await load(); };
  return <div className="flex flex-col gap-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold">Listing collections</h1><p className="mt-1 text-sm text-muted-foreground">Collections are listing segments used by your portal. The old neighborhoods URL is a compatibility alias for this same data.</p></div><Button onClick={() => setCreating((value) => !value)}>{creating ? "Close" : "Create segment"}</Button></div>{creating ? <Card><CardHeader><CardTitle>Create segment</CardTitle></CardHeader><CardContent><SegmentForm initial={null} onSubmit={create} submitLabel="Create segment" suggestions={suggestions} /></CardContent></Card> : null}{editing ? <Card><CardHeader><CardTitle>Edit segment</CardTitle></CardHeader><CardContent><SegmentForm initial={editing} onSubmit={update} submitLabel="Save segment" suggestions={suggestions} /></CardContent></Card> : null}{segments.length ? <div className="grid gap-3 md:grid-cols-2">{segments.map((segment) => <SegmentCard key={segment.id} segment={segment} onEdit={() => setEditing(segment)} onChange={load} />)}</div> : <Empty title="No listing collections" description="Create a segment to group listings for a portal." />}</div>;
}

function SegmentCard({ segment, onEdit, onChange }: { segment: Segment; onEdit: () => void; onChange: () => Promise<void> }) {
  const [count, setCount] = useState<{ count: number; gated?: boolean } | null>(null); const [busy, setBusy] = useState(false);
  const preview = async () => { try { setBusy(true); const response = await request(`/api/agent/segments/${segment.id}/listing-count`); setCount(response); } finally { setBusy(false); } };
  const remove = async () => { if (!window.confirm(`Delete ${segment.name}?`)) return; await request(`/api/agent/segments/${segment.id}`, { method: "DELETE" }); await onChange(); };
  return <Card><CardHeader><CardTitle>{segment.name}</CardTitle><p className="text-xs text-muted-foreground">/{segment.slug} · {segment.isPublished ? "Published" : "Unpublished"}</p></CardHeader><CardContent className="space-y-3"><pre className="max-h-32 overflow-auto rounded bg-muted/40 p-2 text-xs">{JSON.stringify(segment.predicate, null, 2)}</pre>{count ? <p className="text-sm">{count.gated ? "Listing count is gated by portal/MLS configuration." : `${count.count} matching listings`}</p> : null}<div className="flex flex-wrap gap-2"><Button size="xs" variant="outline" onClick={preview} disabled={busy}>{busy ? "Checking..." : "Preview listing count"}</Button><Button size="xs" variant="ghost" onClick={onEdit}>Edit</Button><Button size="xs" variant="ghost" onClick={() => void remove()}>Delete</Button></div></CardContent></Card>;
}
