"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@realestategear/ui/button";
import { Input } from "@realestategear/ui/input";
import { Label } from "@realestategear/ui/label";
import { FormMessage } from "@realestategear/ui/form-message";
import { formatAgentApiError, isAgentApiDisabled, type AgentApiErrorBody } from "@/lib/agent";
import { AgentApiDisabled } from "./agent-api-disabled";

export function AgentForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const [disabled, setDisabled] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setDisabled(false);
    setPending(true);
    try {
      const res = await fetch("/api/agent/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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
      setSuccess(body.message || "Password reset instructions sent to email");
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
      {success ? <FormMessage variant="success">{success}</FormMessage> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-forgot-email">Email</Label>
        <Input
          id="agent-forgot-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Button type="submit" loading={pending} loadingLabel="Sending…">
        Send reset instructions
      </Button>
      <p className="text-xs text-muted-foreground">
        <Link href="/agent/login" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
