"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@realestategear/ui/button";
import { Input } from "@realestategear/ui/input";
import { Label } from "@realestategear/ui/label";
import { FormMessage } from "@realestategear/ui/form-message";
import { formatAgentApiError, isAgentApiDisabled, type AgentApiErrorBody } from "@/lib/agent";
import { AgentApiDisabled } from "./agent-api-disabled";

export function AgentResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState(token ? "" : "This reset link is missing a token.");
  const [pending, setPending] = useState(false);
  const [disabled, setDisabled] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDisabled(false);
    if (!token) {
      setError("This reset link is missing a token.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/agent/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = (await res.json().catch(() => ({}))) as AgentApiErrorBody;
      if (isAgentApiDisabled(res.status, body)) {
        setDisabled(true);
        return;
      }
      if (!res.ok) {
        setError(formatAgentApiError(res.status, body));
        return;
      }
      router.push("/agent/login");
      router.refresh();
    } catch {
      setError("Unable to connect to server");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {disabled ? <AgentApiDisabled /> : null}
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-reset-password">New password</Label>
        <Input
          id="agent-reset-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" loading={pending} loadingLabel="Updating…">
        Reset password
      </Button>
      <p className="text-xs text-muted-foreground">
        <Link href="/agent/login" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
