"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@realestategear/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@realestategear/ui/card";
import { Empty } from "@realestategear/ui/empty";
import { Input } from "@realestategear/ui/input";
import { Skeleton } from "@realestategear/ui/skeleton";
import type {
  AgentDiscoveredMessage,
  AgentSyncRun,
  AgentTransactionAttachment,
  AgentTransactionDocument,
} from "@/lib/agent";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("UNAUTHORIZED");
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusLabel(status: string, synchronized = false) {
  if (synchronized) return "Synchronized";
  if (status === "MISSING") return "Pending";
  if (status === "MATCHED") return "Matched";
  if (status === "VERIFIED") return "Verified";
  if (status === "DISMISSED") return "Rejected";
  if (status === "RUNNING") return "Running";
  if (status === "COMPLETED") return "Synchronized";
  if (status === "FAILED") return "Failed";
  return status;
}

function StatusBadge({ status, synchronized = false }: { status: string; synchronized?: boolean }) {
  return <span className="rounded border px-2 py-0.5 text-xs font-medium">{statusLabel(status, synchronized)}</span>;
}

export function AgentTransactionDocuments({ transactionId }: { transactionId: string }) {
  const [documents, setDocuments] = useState<AgentTransactionDocument[] | null>(null);
  const [attachments, setAttachments] = useState<AgentTransactionAttachment[]>([]);
  const [runs, setRuns] = useState<AgentSyncRun[]>([]);
  const [messages, setMessages] = useState<AgentDiscoveredMessage[]>([]);
  const [error, setError] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const [documentResult, attachmentResult, syncResult, messageResult] = await Promise.all([
        request(`/api/agent/transactions/${transactionId}/documents`),
        request(`/api/agent/transactions/${transactionId}/attachments`),
        request(`/api/agent/transactions/${transactionId}/sync-runs`),
        request(`/api/agent/transactions/${transactionId}/discovered-messages`),
      ]);
      setDocuments(documentResult);
      setAttachments(attachmentResult.attachments ?? []);
      setRuns(syncResult);
      setMessages(messageResult);
    } catch (err) {
      setError(err instanceof Error && err.message === "UNAUTHORIZED" ? "Your session has expired." : err instanceof Error ? err.message : "Unable to load transaction documents.");
    }
  }, [transactionId]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(path: string, init?: RequestInit) {
    try { await request(path, init); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to update document synchronization."); }
  }

  async function addCustomDocument(event: React.FormEvent) {
    event.preventDefault();
    if (!customLabel.trim()) return;
    await mutate(`/api/agent/transactions/${transactionId}/documents`, {
      method: "POST",
      body: JSON.stringify({ label: customLabel.trim() }),
    });
    setCustomLabel("");
  }

  async function startSync() {
    setSyncing(true);
    try {
      await request(`/api/agent/transactions/${transactionId}/sync`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start email synchronization.");
    } finally {
      setSyncing(false);
    }
  }

  if (error && !documents) {
    return <Card><CardContent className="flex flex-col gap-3 pt-6" role="alert"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => void load()}>Retry</Button></CardContent></Card>;
  }
  if (!documents) return <Skeleton aria-label="Loading documents and email synchronization" className="h-96 w-full" />;

  const required = documents.filter((document) => document.documentDefinition);
  const custom = documents.filter((document) => !document.documentDefinition);
  const latestRun = runs[0];

  return (
    <div className="flex flex-col gap-6">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardHeader><CardTitle>Required documents</CardTitle></CardHeader>
        <CardContent>
          {required.length === 0 ? <Empty compact title="No required document slots" description="This transaction has no template document requirements." /> : <DocumentList documents={required} attachments={attachments} transactionId={transactionId} onMutate={mutate} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Custom documents</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={addCustomDocument} className="flex flex-col gap-2 sm:flex-row" aria-label="Add custom document">
            <label className="sr-only" htmlFor="custom-document-label">Custom document label</label>
            <Input id="custom-document-label" value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} placeholder="Document label" />
            <Button type="submit" disabled={!customLabel.trim()}>Add document slot</Button>
          </form>
          {custom.length ? <DocumentList documents={custom} attachments={attachments} transactionId={transactionId} onMutate={mutate} /> : <Empty compact title="No custom documents" description="Add a slot for a document outside the template." />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
        <CardContent>
          {attachments.length === 0 ? <Empty compact title="No confirmed attachments" description="Run email synchronization and confirm a discovered message to make attachments available." /> : <ul className="divide-y">{attachments.map((attachment) => <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{attachment.filename}</p><p className="text-xs text-muted-foreground">{attachment.suggestedDocType || "Unclassified"} · {attachment.message.subject || "No subject"} · {formatDate(attachment.message.sentAt)}</p></div><StatusBadge status={attachment.isMatched ? "MATCHED" : "PENDING"} /></li>)}</ul>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Email synchronization</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3"><Button onClick={() => void startSync()} disabled={syncing}>{syncing ? "Starting sync…" : "Sync Gmail"}</Button>{latestRun ? <span className="text-sm text-muted-foreground">Latest: <StatusBadge status={latestRun.status} /> {latestRun.messagesFound} messages</span> : <span className="text-sm text-muted-foreground">Not synchronized yet</span>}</div>
          {runs.length ? <div><h3 className="mb-2 text-sm font-semibold">Sync status</h3><ul className="divide-y">{runs.map((run) => <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span><StatusBadge status={run.status} /> <span className="ml-2">{formatDate(run.startedAt)}</span></span><span className="text-muted-foreground">{run.error || `${run.messagesFound} messages found`}</span></li>)}</ul></div> : null}
          <div><h3 className="mb-2 text-sm font-semibold">Discovered messages</h3>{messages.length === 0 ? <Empty compact title="No discovered messages" description="Messages found by Gmail synchronization will appear here." /> : <ul className="divide-y">{messages.map((message) => <li key={message.id} className="py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{message.subject || "No subject"}</p><p className="text-xs text-muted-foreground">{message.fromName || message.fromEmail || "Unknown sender"} · {formatDate(message.sentAt)} · {message.category || "Unclassified"}</p><p className="mt-1 text-sm text-muted-foreground">{message.snippet || "No preview available."}</p></div><div className="flex items-center gap-2"><StatusBadge status={message.status} />{message.status === "PENDING" ? <><Button size="xs" onClick={() => void mutate(`/api/agent/transactions/${transactionId}/discovered-messages/${message.id}/confirm`, { method: "POST" })}>Confirm</Button><Button size="xs" variant="outline" onClick={() => void mutate(`/api/agent/transactions/${transactionId}/discovered-messages/${message.id}/dismiss`, { method: "POST" })}>Reject</Button></> : null}</div></div><p className="mt-2 text-xs text-muted-foreground">{message.attachments.length} attachment(s)</p></li>)}</ul>}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentList({ documents, attachments, transactionId, onMutate }: { documents: AgentTransactionDocument[]; attachments: AgentTransactionAttachment[]; transactionId: string; onMutate: (path: string, init?: RequestInit) => Promise<void> }) {
  return <ul className="divide-y">{documents.map((document) => <li key={document.id} className="flex flex-col gap-3 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{document.label}</p><p className="text-xs text-muted-foreground">{document.matchedAttachment?.filename || "No attachment matched"}</p></div><StatusBadge status={document.status} synchronized={Boolean(document.driveWebLink)} /></div><div className="flex flex-wrap gap-2">{document.status === "MISSING" ? attachments.filter((attachment) => !attachment.isMatched).map((attachment) => <Button key={attachment.id} size="xs" variant="outline" onClick={() => void onMutate(`/api/agent/transactions/${transactionId}/documents/${document.id}/match`, { method: "PATCH", body: JSON.stringify({ attachmentId: attachment.id }) })}>Match {attachment.filename}</Button>) : null}{document.status === "MATCHED" ? <Button size="xs" onClick={() => void onMutate(`/api/agent/transactions/${transactionId}/documents/${document.id}/verify`, { method: "PATCH" })}>Verify</Button> : null}{document.status !== "MISSING" ? <Button size="xs" variant="outline" onClick={() => void onMutate(`/api/agent/transactions/${transactionId}/documents/${document.id}/unmatch`, { method: "PATCH" })}>Unmatch</Button> : null}{document.status === "MATCHED" || document.status === "VERIFIED" ? <Button size="xs" variant="outline" onClick={() => void onMutate(`/api/agent/transactions/${transactionId}/documents/${document.id}/copy-to-drive`, { method: "POST" })}>Copy to Drive</Button> : null}{document.driveWebLink ? <a className="rounded border px-2 py-1 text-xs font-medium hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={document.driveWebLink} target="_blank" rel="noreferrer">Open synchronized file</a> : null}{!document.documentDefinition ? <Button size="xs" variant="ghost" onClick={() => void onMutate(`/api/agent/transactions/${transactionId}/documents/${document.id}`, { method: "DELETE" })}>Delete slot</Button> : null}</div></li>)}</ul>;
}
