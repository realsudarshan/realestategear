"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@realestategear/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@realestategear/ui/card";
import { Empty } from "@realestategear/ui/empty";
import { Input } from "@realestategear/ui/input";
import { Skeleton } from "@realestategear/ui/skeleton";
import { Textarea } from "@realestategear/ui/textarea";

type Portal = {
  id: string; name: string; slug: string; isActive: boolean; logoUrl?: string | null;
  agentDisplayName?: string | null; agentPhone?: string | null; agentEmail?: string | null;
  agentHeadlineText?: string | null; brokerageName?: string | null; brokeragePhone?: string | null;
  _count?: { inquiries: number }; featuredListings?: Array<{ id: string; listing: { id: string; property: { address: string; city: string; state: string } } }>;
};
type Readiness = {
  canShowListings: boolean; canShowSearch: boolean; blockers: Array<{ id: string; label: string; reason?: string }>;
  warnings: Array<{ id: string; label: string; reason?: string }>;
  gates: Array<{ id: string; label: string; state: string; reason?: string }>;
};
type Values = Pick<Portal, "name" | "slug" | "agentDisplayName" | "agentPhone" | "agentEmail" | "agentHeadlineText" | "brokerageName" | "brokeragePhone">;

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("UNAUTHORIZED");
  if (!response.ok) throw new Error(body.error || "Portal request failed.");
  return body;
}

const emptyValues: Values = { name: "", slug: "", agentDisplayName: "", agentPhone: "", agentEmail: "", agentHeadlineText: "", brokerageName: "", brokeragePhone: "" };
function errorText(error: unknown) { return error instanceof Error ? error.message : "Portal request failed."; }
function PortalFields({ value, setValue, portals, editing }: { value: Values; setValue: (value: Values) => void; portals: Portal[]; editing?: string }) {
  const slugMessage = !value.slug ? "Slug is required." : !/^[a-z0-9-]{1,64}$/.test(value.slug) ? "Use 1-64 lowercase letters, numbers, and hyphens." : portals.some((portal) => portal.slug === value.slug && portal.id !== editing) ? "This slug is already used by another portal." : "Slug format is valid.";
  const set = (key: keyof Values, next: string) => setValue({ ...value, [key]: next });
  return <div className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-medium">Portal name<Input required value={value.name ?? ""} onChange={(e) => set("name", e.target.value)} /></label>
    <label className="text-sm font-medium">Portal slug<Input required value={value.slug ?? ""} onChange={(e) => set("slug", e.target.value.toLowerCase())} aria-describedby="slug-help" /><span id="slug-help" className={`mt-1 block text-xs ${slugMessage.includes("valid") ? "text-muted-foreground" : "text-destructive"}`}>{slugMessage}</span></label>
    <label className="text-sm font-medium">Agent display name<Input value={value.agentDisplayName ?? ""} onChange={(e) => set("agentDisplayName", e.target.value)} /></label>
    <label className="text-sm font-medium">Agent email<Input type="email" value={value.agentEmail ?? ""} onChange={(e) => set("agentEmail", e.target.value)} /></label>
    <label className="text-sm font-medium">Agent phone<Input value={value.agentPhone ?? ""} onChange={(e) => set("agentPhone", e.target.value)} /></label>
    <label className="text-sm font-medium">Brokerage name<Input value={value.brokerageName ?? ""} onChange={(e) => set("brokerageName", e.target.value)} /></label>
    <label className="text-sm font-medium">Brokerage phone<Input value={value.brokeragePhone ?? ""} onChange={(e) => set("brokeragePhone", e.target.value)} /></label>
    <label className="text-sm font-medium sm:col-span-2">Agent headline<Textarea value={value.agentHeadlineText ?? ""} onChange={(e) => set("agentHeadlineText", e.target.value)} /></label>
  </div>;
}

export function AgentPortalsPage() {
  const [portals, setPortals] = useState<Portal[] | null>(null); const [readyById, setReadyById] = useState<Record<string, Readiness>>({}); const [creating, setCreating] = useState(false); const [value, setValue] = useState(emptyValues); const [error, setError] = useState("");
  const load = useCallback(async () => { try { setError(""); const next = await request("/api/agent/portals") as Portal[]; setPortals(next); const readiness = await Promise.all(next.map(async (portal) => [portal.id, await request(`/api/agent/portals/${portal.id}/readiness`)] as const)); setReadyById(Object.fromEntries(readiness)); } catch (cause) { setError(errorText(cause)); } }, []);
  useEffect(() => { void load(); }, [load]);
  if (error) return <PortalError message={error} retry={() => void load()} />; if (!portals) return <Skeleton aria-label="Loading portals" className="h-96 w-full" />;
  const create = async (event: React.FormEvent) => { event.preventDefault(); try { setError(""); const portal = await request("/api/agent/portals", { method: "POST", body: JSON.stringify(value) }); window.location.assign(`/agent/portals/${portal.id}`); } catch (cause) { setError(errorText(cause)); } };
  return <div className="flex flex-col gap-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold">Portals</h1><p className="mt-1 text-sm text-muted-foreground">Manage public portal configuration and launch readiness.</p></div><Button onClick={() => setCreating((current) => !current)}>{creating ? "Close" : "Create portal"}</Button></div>{creating ? <Card><CardHeader><CardTitle>Create portal</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={create}><PortalFields value={value} setValue={setValue} portals={portals} />{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<Button type="submit">Create portal</Button></form></CardContent></Card> : null}{portals.length ? <div className="grid gap-3 sm:grid-cols-2">{portals.map((portal) => { const readiness = readyById[portal.id]; const live = portal.isActive && readiness?.blockers.length === 0; return <Link key={portal.id} href={`/agent/portals/${portal.id}`} className="rounded-md border bg-card p-4 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex justify-between gap-3"><h2 className="font-semibold">{portal.name}</h2><span className={`text-xs font-medium ${live ? "text-green-700" : "text-muted-foreground"}`}>{live ? "Live" : portal.isActive ? "Active — not ready" : "Inactive"}</span></div><p className="mt-1 text-sm text-muted-foreground">/{portal.slug}</p><p className="mt-3 text-xs text-muted-foreground">{portal._count?.inquiries ?? 0} inquiries</p></Link>; })}</div> : <Empty title="No portals yet" description="Create a portal to configure your public real-estate experience." />}</div>;
}

function PortalError({ message, retry }: { message: string; retry: () => void }) { return <div role="alert" className="flex flex-col gap-3"><p className="text-sm text-destructive">{message}</p><Button variant="outline" onClick={retry}>Retry</Button></div>; }

export function AgentPortalSettingsPage({ id }: { id: string }) {
  const [portal, setPortal] = useState<Portal | null>(null); const [portals, setPortals] = useState<Portal[]>([]); const [readiness, setReadiness] = useState<Readiness | null>(null); const [value, setValue] = useState<Values>(emptyValues); const [featured, setFeatured] = useState(""); const [ping, setPing] = useState<{ ok: boolean; status: number } | null>(null); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { try { setError(""); const [next, nextReadiness, all] = await Promise.all([request(`/api/agent/portals/${id}`), request(`/api/agent/portals/${id}/readiness`), request("/api/agent/portals")]); setPortal(next); setValue({ name: next.name ?? "", slug: next.slug ?? "", agentDisplayName: next.agentDisplayName ?? "", agentPhone: next.agentPhone ?? "", agentEmail: next.agentEmail ?? "", agentHeadlineText: next.agentHeadlineText ?? "", brokerageName: next.brokerageName ?? "", brokeragePhone: next.brokeragePhone ?? "" }); setFeatured((next.featuredListings ?? []).map((item: Portal["featuredListings"][number]) => item.listing.id).join(", ")); setReadiness(nextReadiness); setPortals(all); } catch (cause) { setError(errorText(cause)); } }, [id]);
  useEffect(() => { void load(); }, [load]);
  if (error) return <PortalError message={error} retry={() => void load()} />; if (!portal || !readiness) return <Skeleton aria-label="Loading portal settings" className="h-96 w-full" />;
  const save = async (event: React.FormEvent) => { event.preventDefault(); try { setSaving(true); setError(""); const next = await request(`/api/agent/portals/${id}`, { method: "PATCH", body: JSON.stringify(value) }); setPortal(next); await load(); } catch (cause) { setError(errorText(cause)); } finally { setSaving(false); } };
  const activate = async () => { if (!portal.isActive && readiness.blockers.length) { setError("Resolve all launch blockers before activating this portal."); return; } if (!window.confirm(`${portal.isActive ? "Deactivate" : "Activate"} this portal?`)) return; try { await request(`/api/agent/portals/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: !portal.isActive }) }); await load(); } catch (cause) { setError(errorText(cause)); } };
  const testInquiry = async () => { try { await request(`/api/agent/portals/${id}/test-inquiry`, { method: "POST", body: JSON.stringify({}) }); await load(); } catch (cause) { setError(errorText(cause)); } };
  const preview = async () => { try { setPing(await request(`/api/agent/portals/${id}/preview-ping`)); } catch (cause) { setError(errorText(cause)); } };
  const uploadLogo = async (file: File) => { try { const signed = await request(`/api/agent/portals/${id}/logo-upload-url?contentType=${encodeURIComponent(file.type)}`); const upload = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file }); if (!upload.ok) throw new Error("Logo upload failed."); await request(`/api/agent/portals/${id}`, { method: "PATCH", body: JSON.stringify({ logoUrl: signed.publicUrl }) }); await load(); } catch (cause) { setError(errorText(cause)); } };
  const saveFeatured = async () => { try { const listingIds = featured.split(",").map((item) => item.trim()).filter(Boolean); if (listingIds.length > 6) throw new Error("A maximum of 6 featured listings is allowed."); await request(`/api/agent/portals/${id}/featured-listings`, { method: "PUT", body: JSON.stringify({ listingIds }) }); await load(); } catch (cause) { setError(errorText(cause)); } };
  return <div className="flex flex-col gap-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><Link href="/agent/portals" className="text-sm text-primary hover:underline">Back to portals</Link><h1 className="mt-2 text-xl font-semibold">{portal.name}</h1><p className="text-sm text-muted-foreground">/{portal.slug} · {portal.isActive ? "Active" : "Inactive"}</p></div><Button onClick={activate}>{portal.isActive ? "Deactivate" : "Activate"}</Button></div>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<Card><CardHeader><CardTitle>Portal settings</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={save}><PortalFields value={value} setValue={setValue} portals={portals} editing={id} /><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button></form></CardContent></Card><div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Launch readiness</CardTitle></CardHeader><CardContent className="space-y-2">{readiness.gates.map((gate) => <div key={gate.id} className="flex justify-between gap-3 border-b py-2 text-sm"><span>{gate.label}<span className="block text-xs text-muted-foreground">{gate.reason}</span></span><strong className={gate.state === "passed" ? "text-green-700" : gate.state === "blocked" ? "text-destructive" : "text-amber-700"}>{gate.state}</strong></div>)}<p className="pt-2 text-xs text-muted-foreground">{readiness.blockers.length ? `${readiness.blockers.length} blocker(s) remain.` : "No launch blockers."}</p></CardContent></Card><Card><CardHeader><CardTitle>Launch checks</CardTitle></CardHeader><CardContent className="flex flex-col gap-3"><Button variant="outline" onClick={testInquiry}>Send test inquiry</Button><Button variant="outline" onClick={preview}>Check public preview</Button>{ping ? <p className={ping.ok ? "text-sm text-green-700" : "text-sm text-destructive"}>{ping.ok ? `Preview returned ${ping.status}.` : `Preview check failed (${ping.status}).`}</p> : null}</CardContent></Card></div><Card><CardHeader><CardTitle>Branding and featured listings</CardTitle></CardHeader><CardContent className="space-y-4"><div><label className="text-sm font-medium">Logo<input className="mt-1 block text-sm" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadLogo(file); }} /></label>{portal.logoUrl ? <img src={portal.logoUrl} alt="Portal logo" className="mt-3 max-h-20 max-w-48 object-contain" /> : null}</div><label className="text-sm font-medium">Featured listing IDs (up to 6)<Input value={featured} onChange={(event) => setFeatured(event.target.value)} placeholder="Comma-separated listing IDs" /></label><Button variant="outline" onClick={saveFeatured}>Save featured listings</Button></CardContent></Card><Button variant="destructive" onClick={async () => { if (window.confirm("Delete this portal permanently?")) { await request(`/api/agent/portals/${id}`, { method: "DELETE" }); window.location.assign("/agent/portals"); } }}>Delete portal</Button></div>;
}
