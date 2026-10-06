"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@realestategear/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@realestategear/ui/card";
import { Empty } from "@realestategear/ui/empty";
import { Input } from "@realestategear/ui/input";
import { NativeSelect } from "@realestategear/ui/native-select";
import { Skeleton } from "@realestategear/ui/skeleton";
import { Textarea } from "@realestategear/ui/textarea";

type Campaign = { id: string; name: string; type: string; status: string; content?: Record<string, unknown> | null; targetAudience?: Record<string, unknown> | null; scheduledAt?: string | null; createdAt?: string };
type CampaignResponse = { campaigns: Campaign[]; pagination: { total: number; totalPages: number } };

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("UNAUTHORIZED");
  if (!response.ok) throw new Error(body.error || "Campaign request failed.");
  return body;
}
function errorText(error: unknown) { return error instanceof Error ? error.message : "Campaign request failed."; }
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div role="alert" className="flex flex-col gap-3"><p className="text-sm text-destructive">{message === "UNAUTHORIZED" ? "You are not authorized to view campaigns." : message}</p><Button variant="outline" onClick={retry}>Retry</Button></div>; }

function CampaignForm({ initial, onSave, onCancel }: { initial?: Campaign; onSave: (value: Record<string, unknown>) => Promise<void>; onCancel?: () => void }) {
  const [name, setName] = useState(initial?.name ?? ""); const [type, setType] = useState(initial?.type ?? "EMAIL"); const [status, setStatus] = useState(initial?.status ?? "DRAFT"); const [scheduledAt, setScheduledAt] = useState(initial?.scheduledAt?.slice(0, 16) ?? ""); const [audience, setAudience] = useState(JSON.stringify(initial?.targetAudience ?? {}, null, 2)); const [content, setContent] = useState(JSON.stringify(initial?.content ?? {}, null, 2)); const [error, setError] = useState("");
  const save = async (event: React.FormEvent) => { event.preventDefault(); try { const targetAudience = JSON.parse(audience || "{}"); const parsedContent = JSON.parse(content || "{}"); if (!name.trim() || !type) throw new Error("Name and type are required."); await onSave({ name: name.trim(), type, status, scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null, targetAudience, content: parsedContent }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Audience and content must be valid JSON."); } };
  return <form className="space-y-4" onSubmit={save}><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium">Campaign name<Input aria-label="Campaign name" required value={name} onChange={(e) => setName(e.target.value)} /></label><label className="text-sm font-medium">Type<NativeSelect aria-label="Campaign type" value={type} onChange={(e) => setType(e.target.value)}><option>EMAIL</option><option>SOCIAL</option><option>PRINT</option></NativeSelect></label><label className="text-sm font-medium">Status<NativeSelect aria-label="Campaign status" value={status} onChange={(e) => setStatus(e.target.value)}><option>DRAFT</option><option>SCHEDULED</option><option>PAUSED</option></NativeSelect></label></div><label className="text-sm font-medium">Scheduled at (optional)<Input aria-label="Scheduled at" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label><label className="text-sm font-medium">Target audience JSON<Textarea aria-label="Target audience" rows={4} value={audience} onChange={(e) => setAudience(e.target.value)} /></label><label className="text-sm font-medium">Campaign content JSON<Textarea aria-label="Campaign content" rows={6} value={content} onChange={(e) => setContent(e.target.value)} /></label>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<div className="flex gap-2"><Button type="submit">{initial ? "Save campaign" : "Create campaign"}</Button>{onCancel ? <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button> : null}</div></form>;
}

function AiContentPanel({ onUse }: { onUse: (content: string) => void }) {
  const [type, setType] = useState("EMAIL"); const [context, setContext] = useState(""); const [content, setContent] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const generate = async () => { try { setLoading(true); setError(""); const result = await request("/api/agent/ai/marketing-copy", { method: "POST", body: JSON.stringify({ type, context }) }); setContent(result.content ?? ""); } catch (cause) { setError(errorText(cause)); } finally { setLoading(false); } };
  return <Card><CardHeader><CardTitle>AI content assistant</CardTitle><p className="text-xs text-muted-foreground">Generated content is a draft. Review and edit it before saving. This tool never sends or publishes campaigns.</p></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 sm:grid-cols-2"><NativeSelect aria-label="AI content type" value={type} onChange={(e) => setType(e.target.value)}><option>EMAIL</option><option>SOCIAL</option><option>PROPERTY_DESCRIPTION</option></NativeSelect><Input aria-label="AI context" placeholder="Audience, property, tone..." value={context} onChange={(e) => setContext(e.target.value)} /></div><Button variant="outline" onClick={() => void generate()} disabled={loading || !context.trim()}>{loading ? "Generating..." : "Generate draft"}</Button>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}{content ? <div className="space-y-2"><Textarea aria-label="Generated content" rows={8} value={content} onChange={(e) => setContent(e.target.value)} /><Button onClick={() => onUse(content)}>Use edited content</Button></div> : null}</CardContent></Card>;
}

export function AgentCampaignsPage() {
  const [data, setData] = useState<CampaignResponse | null>(null); const [creating, setCreating] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => { try { setError(""); setData(await request("/api/agent/campaigns?limit=20")); } catch (cause) { setError(errorText(cause)); } }, []);
  useEffect(() => { void load(); }, [load]);
  if (error) return <ErrorState message={error} retry={() => void load()} />; if (!data) return <Skeleton aria-label="Loading campaigns" className="h-96 w-full" />;
  const create = async (value: Record<string, unknown>) => { await request("/api/agent/campaigns", { method: "POST", body: JSON.stringify(value) }); setCreating(false); await load(); };
  return <div className="flex flex-col gap-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold">Campaigns</h1><p className="mt-1 text-sm text-muted-foreground">Draft and schedule campaign content for agent review. Sending and publishing are not available here.</p></div><Button onClick={() => setCreating((value) => !value)}>{creating ? "Close" : "Create campaign"}</Button></div>{creating ? <Card><CardHeader><CardTitle>Create campaign</CardTitle></CardHeader><CardContent><CampaignForm onSave={create} onCancel={() => setCreating(false)} /></CardContent></Card> : null}{data.campaigns.length ? <div className="grid gap-3 md:grid-cols-2">{data.campaigns.map((campaign) => <Card key={campaign.id}><CardHeader><CardTitle><Link className="hover:underline" href={`/agent/campaigns/${campaign.id}`}>{campaign.name}</Link></CardTitle><p className="text-xs text-muted-foreground">{campaign.type} · {campaign.status}{campaign.scheduledAt ? ` · ${new Date(campaign.scheduledAt).toLocaleString()}` : ""}</p></CardHeader></Card>)}</div> : <Empty title="No campaigns" description="Create a campaign draft to begin." />}</div>;
}

export function AgentCampaignDetail({ id }: { id: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null); const [editing, setEditing] = useState(false); const [error, setError] = useState(""); const [dirty, setDirty] = useState(false);
  const load = useCallback(async () => { try { setError(""); setCampaign(await request(`/api/agent/campaigns/${id}`)); } catch (cause) { setError(errorText(cause)); } }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", handler); return () => window.removeEventListener("beforeunload", handler); }, [dirty]);
  if (error) return <ErrorState message={error} retry={() => void load()} />; if (!campaign) return <Skeleton aria-label="Loading campaign" className="h-96 w-full" />;
  const save = async (value: Record<string, unknown>) => { await request(`/api/agent/campaigns/${id}`, { method: "PUT", body: JSON.stringify(value) }); setDirty(false); setEditing(false); await load(); };
  const remove = async () => { if (!window.confirm("Delete this campaign?")) return; await request(`/api/agent/campaigns/${id}`, { method: "DELETE" }); window.location.assign("/agent/campaigns"); };
  return <div className="flex flex-col gap-6"><div><Link href="/agent/campaigns" className="text-sm text-primary hover:underline">Back to campaigns</Link><h1 className="mt-2 text-xl font-semibold">{campaign.name}</h1><p className="text-sm text-muted-foreground">{campaign.type} · {campaign.status}{campaign.scheduledAt ? ` · Scheduled ${new Date(campaign.scheduledAt).toLocaleString()}` : ""}</p></div>{editing ? <Card><CardHeader><CardTitle>Edit campaign</CardTitle></CardHeader><CardContent><CampaignForm initial={campaign} onSave={save} onCancel={() => setEditing(false)} /></CardContent></Card> : <Card><CardHeader><CardTitle>Campaign draft</CardTitle></CardHeader><CardContent><pre className="whitespace-pre-wrap text-sm">{JSON.stringify(campaign.content ?? {}, null, 2)}</pre><p className="mt-3 text-xs text-muted-foreground">Review required before any external use. No send or publish action is provided.</p></CardContent></Card>}<AiContentPanel onUse={(content) => { setCampaign({ ...campaign, content: { ...(campaign.content ?? {}), body: content } }); setEditing(true); setDirty(true); }} />{!editing ? <div className="flex gap-2"><Button onClick={() => { setEditing(true); setDirty(true); }}>Edit campaign</Button><Button variant="destructive" onClick={() => void remove()}>Delete campaign</Button></div> : null}</div>;
}
