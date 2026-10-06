"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@realestategear/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@realestategear/ui/card";
import { Empty } from "@realestategear/ui/empty";
import { Input } from "@realestategear/ui/input";
import { NativeSelect } from "@realestategear/ui/native-select";
import { Skeleton } from "@realestategear/ui/skeleton";
import { Textarea } from "@realestategear/ui/textarea";
import { AgentAction, ActionResponse, ChatEvent, ChatMessage, LinkedEntity, consumeSseChunk, safeAiError } from "@/lib/agent-ai";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || (response.status === 401 ? "You are not authorized to use the AI workspace." : "AI request failed."));
  return body;
}

export function AgentAiWorkspace() {
  const [messages, setMessages] = useState<ChatMessage[]>([]); const [input, setInput] = useState(""); const [streaming, setStreaming] = useState(false); const [chatError, setChatError] = useState(""); const [entities, setEntities] = useState<LinkedEntity[]>([]); const [conversations, setConversations] = useState<Array<{ id: string; title?: string; createdAt?: string }>>([]); const [saved, setSaved] = useState("");
  const loadConversations = useCallback(async () => { try { const value = await request("/api/agent/ai/conversations"); setConversations(Array.isArray(value) ? value : value.conversations ?? []); } catch { /* history is supplementary; chat remains usable */ } }, []);
  useEffect(() => { void loadConversations(); }, [loadConversations]);
  const send = async () => {
    const content = input.trim(); if (!content || streaming) return;
    const next = [...messages, { role: "user" as const, content }]; setMessages([...next, { role: "assistant", content: "" }]); setInput(""); setStreaming(true); setChatError(""); setEntities([]);
    let attempt = 0;
    while (attempt < 3) {
      try {
        const response = await fetch("/api/agent/ai/chat", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
        if (!response.ok || !response.body) throw new Error(response.status === 503 ? "AI unavailable" : "AI chat failed");
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let complete = false; let answer = "";
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break; buffer += decoder.decode(chunk.value, { stream: true });
          const parsed = consumeSseChunk(buffer); buffer = parsed.remainder;
          for (const event of parsed.events) { if (event.error) throw new Error(event.error); if (event.content) { answer += event.content; setMessages([...next, { role: "assistant", content: answer }]); } if (event.entities) setEntities(event.entities); if (event.done) complete = true; }
        }
        const final = consumeSseChunk(buffer, true);
        for (const event of final.events) { if (event.error) throw new Error(event.error); if (event.content) answer += event.content; if (event.entities) setEntities(event.entities); if (event.done) complete = true; }
        if (!complete) throw new Error("The AI stream ended before completion.");
        setMessages([...next, { role: "assistant", content: answer }]); setStreaming(false); return;
      } catch (cause) {
        attempt += 1; if (attempt >= 3) { setChatError(safeAiError(cause)); setStreaming(false); return; }
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
  };
  const saveConversation = async () => { if (!messages.length) return; try { await request("/api/agent/ai/conversations", { method: "POST", body: JSON.stringify({ title: messages[0].content.slice(0, 80), messages }) }); setSaved("Conversation saved."); await loadConversations(); } catch (cause) { setSaved(safeAiError(cause)); } };
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]"><div className="space-y-4"><div><h1 className="text-xl font-semibold">Agent AI workspace</h1><p className="mt-1 text-sm text-muted-foreground">Ask about your workspace. Chat is read-only; suggested side effects appear in the action queue for review.</p></div><Card><CardContent className="space-y-4 pt-5"><div className="min-h-64 space-y-3 rounded-md border bg-muted/20 p-4">{messages.length ? messages.map((message, index) => <div key={`${index}-${message.role}`} className={message.role === "user" ? "ml-auto max-w-[85%] rounded-md bg-primary p-3 text-sm text-primary-foreground" : "max-w-[85%] whitespace-pre-wrap rounded-md bg-card p-3 text-sm"}>{message.content || (streaming && index === messages.length - 1 ? "Thinking..." : "")}</div>) : <p className="text-sm text-muted-foreground">Ask a question about contacts, transactions, properties, tasks, or pending AI actions.</p>}</div>{chatError ? <p role="alert" className="text-sm text-destructive">{chatError}</p> : null}<div className="flex gap-2"><Textarea aria-label="AI message" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Ask your Agent AI..." /><Button onClick={() => void send()} disabled={streaming || !input.trim()}>{streaming ? "Streaming..." : "Send"}</Button></div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => void saveConversation()} disabled={!messages.length || streaming}>Save conversation</Button>{saved ? <span className="text-xs text-muted-foreground">{saved}</span> : null}</div></CardContent></Card><EntityCards entities={entities} /></div><aside className="space-y-4"><ConversationHistory conversations={conversations} /><ActionQueue /></aside></div>;
}

function EntityCards({ entities }: { entities: LinkedEntity[] }) { if (!entities.length) return null; return <div className="grid gap-2 sm:grid-cols-2">{entities.map((entity) => <a key={`${entity.type}-${entity.id}`} href={entity.href} className="rounded-md border bg-card p-3 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><p className="font-medium">{entity.label}</p><p className="text-xs uppercase text-muted-foreground">{entity.type}</p>{entity.meta.map((item) => <p key={item} className="text-xs text-muted-foreground">{item}</p>)}</a>)}</div>; }
function ConversationHistory({ conversations }: { conversations: Array<{ id: string; title?: string; createdAt?: string }> }) { return <Card><CardHeader><CardTitle>Conversation history</CardTitle></CardHeader><CardContent>{conversations.length ? <ul className="divide-y">{conversations.map((conversation) => <li key={conversation.id} className="py-2 text-sm">{conversation.title || "Untitled conversation"}<span className="block text-xs text-muted-foreground">{conversation.createdAt ? new Date(conversation.createdAt).toLocaleString() : ""}</span></li>)}</ul> : <Empty compact title="No saved conversations" description="Save a conversation to find it here." />}</CardContent></Card>; }

function ActionQueue() {
  const [data, setData] = useState<ActionResponse | null>(null); const [error, setError] = useState(""); const [selected, setSelected] = useState<AgentAction | null>(null); const [scanMessage, setScanMessage] = useState("");
  const load = useCallback(async () => { try { setError(""); setData(await request("/api/agent/ai/actions")); } catch (cause) { setError(safeAiError(cause)); } }, []);
  useEffect(() => { void load(); }, [load]);
  const scan = async (kind: "transactions" | "relationships") => { try { setScanMessage(""); const result = await request(`/api/agent/ai/actions/scan-${kind}`, { method: "POST", body: JSON.stringify({}) }); setScanMessage(`${result.created ?? 0} new action(s) found.`); await load(); } catch (cause) { setScanMessage(safeAiError(cause)); } };
  if (error) return <Card><CardContent className="space-y-2 pt-5"><p role="alert" className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button></CardContent></Card>;
  if (!data) return <Skeleton aria-label="Loading action queue" className="h-72 w-full" />;
  const open = async (action: AgentAction) => { try { setSelected(await request(`/api/agent/ai/actions/${action.id}`)); } catch { setSelected(action); } };
  return <><Card><CardHeader><CardTitle>Action queue</CardTitle><p className="text-xs text-muted-foreground">Nothing executes from chat. Review and confirm actions here.</p></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2"><Button size="xs" variant="outline" onClick={() => void scan("transactions")}>Scan transactions</Button><Button size="xs" variant="outline" onClick={() => void scan("relationships")}>Scan relationships</Button></div>{scanMessage ? <p className="text-xs text-muted-foreground">{scanMessage}</p> : null}{data.actions.length ? <ul className="divide-y">{data.actions.map((action) => <li key={action.id} className="py-3"><button type="button" className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => void open(action)}><p className="font-medium">{action.label}</p><p className="text-xs text-muted-foreground">{action.toolType} · {action.status}</p></button></li>)}</ul> : <Empty compact title="Queue is empty" description="New AI suggestions requiring review will appear here." />}</CardContent></Card>{selected ? <ActionDrawer action={selected} close={() => setSelected(null)} onChange={async () => { setSelected(null); await load(); }} /> : null}</>;
}

function ActionDrawer({ action, close, onChange }: { action: AgentAction; close: () => void; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [confirm, setConfirm] = useState(false); const [partial, setPartial] = useState(""); const [snoozeUntil, setSnoozeUntil] = useState(""); const [reason, setReason] = useState("");
  const mutate = async (path: string, body?: Record<string, unknown>) => { try { setBusy(true); setError(""); await request(`/api/agent/ai/actions/${action.id}/${path}`, { method: "POST", body: JSON.stringify(body ?? {}) }); await onChange(); } catch (cause) { setError(safeAiError(cause)); } finally { setBusy(false); } };
  const execute = async () => { try { setBusy(true); setError(""); const response = await fetch(`/api/agent/ai/actions/${action.id}/execute`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sendEmail: false }) }); const body = await response.json().catch(() => ({})); if (response.status === 207 || body.partial) { setPartial("Execution was partial: the backend reported an incomplete result. No overall success is shown; review the action and its source records before retrying."); setConfirm(false); return; } if (!response.ok) throw new Error(body.error || "Action execution failed."); setConfirm(false); await onChange(); } catch (cause) { setError(safeAiError(cause)); } finally { setBusy(false); } };
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-label="Review AI action"><div className="h-full w-full max-w-lg overflow-y-auto bg-background p-6 shadow-xl"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{action.label}</h2><p className="text-xs text-muted-foreground">{action.toolType} · {action.status}</p></div><Button variant="ghost" onClick={close}>Close</Button></div><div className="mt-5 space-y-4"><p className="text-sm">{action.reason || "Review this suggested action before deciding."}</p>{action.contact ? <p className="text-sm">Contact: {action.contact.firstName} {action.contact.lastName}</p> : null}{action.transaction ? <p className="text-sm">Transaction: {action.transaction.address || action.transaction.id}</p> : null}<pre className="max-h-52 overflow-auto rounded-md bg-muted/40 p-3 text-xs">{JSON.stringify(action.previewData ?? action.payload, null, 2)}</pre>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}{partial ? <p role="alert" className="rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-900">{partial}</p> : null}<div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void mutate("review")}>Mark reviewed</Button><Button disabled={busy} variant="outline" onClick={() => void mutate("dismiss", { reason })}>Dismiss</Button><div className="flex gap-2"><Input aria-label="Snooze until" type="datetime-local" value={snoozeUntil} onChange={(e) => setSnoozeUntil(e.target.value)} /><Button disabled={busy || !snoozeUntil} variant="outline" onClick={() => void mutate("snooze", { until: new Date(snoozeUntil).toISOString() })}>Snooze</Button></div><Input aria-label="Dismiss reason" placeholder="Optional dismiss reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div><Button disabled={busy} variant="destructive" onClick={() => setConfirm(true)}>Execute action</Button>{confirm ? <div className="rounded-md border border-destructive/50 p-4"><p className="text-sm font-medium">Confirm side effect</p><p className="mt-1 text-sm text-muted-foreground">This calls the action execution endpoint. It may send email or change CRM data according to the action options.</p><div className="mt-3 flex gap-2"><Button variant="destructive" autoFocus={false} onClick={() => void execute()}>Confirm execute</Button><Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button></div></div> : null}</div></div></div>;
}
