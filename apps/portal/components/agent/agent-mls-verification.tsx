"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@realestategear/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@realestategear/ui/card";
import { Input } from "@realestategear/ui/input";
import { Skeleton } from "@realestategear/ui/skeleton";

type MlsStatus =
  | { verified: false }
  | {
      verified: true;
      mlsBoardId: string;
      mlsBoardName: string;
      membershipId: string;
      verifiedAt: string;
    };
type VerificationResult = {
  status: "verified" | "not_found" | "inactive" | "ambiguous" | "invalid";
  agent?: { name: string | null; email: string | null };
};

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("UNAUTHORIZED");
  if (!response.ok) {
    if (String(body.error ?? "").includes("MLS_BOARD_ID")) throw new Error("MLS_DISABLED");
    throw new Error(body.error || "MLS request failed.");
  }
  return body;
}

function messageForResult(result: VerificationResult) {
  switch (result.status) {
    case "not_found":
      return "That membership ID was not found in the synchronized MLS roster. Try again after the next roster update.";
    case "inactive":
      return "This membership is present but is not currently active in the MLS roster.";
    case "ambiguous":
      return "This membership ID matched more than one roster record. Contact your MLS administrator for assistance.";
    case "invalid":
      return "Enter a valid MLS membership ID.";
    default:
      return "MLS verification could not be completed.";
  }
}

export function AgentMlsVerificationPage() {
  const [status, setStatus] = useState<MlsStatus | null>(null);
  const [membershipId, setMembershipId] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      setStatus(await request("/api/agent/mls/status"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "MLS request failed.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!status && !error) return <Skeleton aria-label="Loading MLS verification" className="h-96 w-full" />;
  if (error === "MLS_DISABLED") {
    return (
      <Card>
        <CardHeader><CardTitle>MLS verification unavailable</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">MLS verification is disabled because this deployment has no MLS board configured.</p>
          <p className="text-sm text-muted-foreground">An administrator must configure MLS_BOARD_ID before agents can verify membership.</p>
        </CardContent>
      </Card>
    );
  }
  if (error) {
    return <div role="alert" className="flex flex-col gap-3"><p className="text-sm text-destructive">{error === "UNAUTHORIZED" ? "You are not authorized to view MLS verification." : error}</p><Button variant="outline" onClick={() => void load()}>Retry</Button></div>;
  }

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!membershipId.trim() || membershipId.length > 64) {
      setResult({ status: "invalid" });
      return;
    }
    try {
      setChecking(true);
      setError("");
      const next = await request("/api/agent/mls/verify", {
        method: "POST",
        body: JSON.stringify({ mlsId: membershipId.trim() }),
      }) as VerificationResult;
      setResult(next);
      if (next.status === "verified") {
        setMembershipId("");
        await load();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "MLS verification failed.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">MLS verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">Verify your membership against the synchronized MLS roster.</p>
      </div>
      {status?.verified ? (
        <Card>
          <CardHeader><CardTitle>Verified</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="font-medium">MLS board:</span> {status.mlsBoardName}</p>
            <p><span className="font-medium">Board ID:</span> {status.mlsBoardId}</p>
            <p><span className="font-medium">Membership ID:</span> {status.membershipId}</p>
            <p><span className="font-medium">Verified:</span> {new Date(status.verifiedAt).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Not verified</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">No verified MLS membership is linked to this account.</p></CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Submit membership ID</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={verify}>
            <Input aria-label="MLS membership ID" value={membershipId} maxLength={64} onChange={(event) => setMembershipId(event.target.value)} placeholder="MLS membership ID" />
            <Button type="submit" disabled={checking}>{checking ? "Verifying..." : "Verify membership"}</Button>
          </form>
          {result && result.status !== "verified" ? <p role="alert" className="text-sm text-destructive">{messageForResult(result)}</p> : null}
          {result?.status === "verified" ? <p className="text-sm text-green-700">Membership verified successfully.</p> : null}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Verification confirms your MLS membership only. It does not automatically enable public MLS display; portal activation, IDX approval, and other compliance requirements still apply.</p>
    </div>
  );
}
