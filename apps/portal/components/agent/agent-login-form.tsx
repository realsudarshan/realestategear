"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@realestategear/ui/button";
import { Input } from "@realestategear/ui/input";
import { Label } from "@realestategear/ui/label";
import { FormMessage } from "@realestategear/ui/form-message";
import { AgentApiDisabled } from "./agent-api-disabled";
import {
  fieldErrorsFromBody,
  formatAgentApiError,
  isAgentApiDisabled,
  safeAgentPath,
  type AgentApiErrorBody,
} from "@/lib/agent";

const GOOGLE_ERROR_COPY: Record<string, string> = {
  not_configured: "Google sign-in is not configured on this server.",
  missing_code: "Google sign-in did not complete. Try again.",
  invalid_state: "Google sign-in expired. Try again.",
  no_access_token: "Google did not return an access token.",
  incomplete_profile: "Google did not return a verified email.",
  email_not_verified: "Verify your Google email, then try again.",
  agent_not_found: "No agent account exists for that Google email. Register first.",
  oauth_failed: "Google sign-in failed. Try again.",
};

export function AgentLoginForm({ googleAvailable }: { googleAvailable: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = safeAgentPath(searchParams.get("from") ?? searchParams.get("redirect"));
  const googleError = searchParams.get("google_error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(googleError ? GOOGLE_ERROR_COPY[googleError] ?? "Google sign-in failed." : "");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [disabled, setDisabled] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFields({});
    setDisabled(false);
    setPending(true);
    try {
      const res = await fetch("/api/agent/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json().catch(() => ({}))) as AgentApiErrorBody;
      if (isAgentApiDisabled(res.status, body)) {
        setDisabled(true);
        return;
      }
      if (!res.ok) {
        setFields(fieldErrorsFromBody(body));
        setError(formatAgentApiError(res.status, body));
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError("Unable to connect to server");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {disabled ? <AgentApiDisabled title="Agent login is unavailable" /> : null}
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-email">Email</Label>
        <Input
          id="agent-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          aria-invalid={Boolean(fields.email) || undefined}
          aria-describedby={fields.email ? "agent-email-error" : undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
        {fields.email ? (
          <FormMessage id="agent-email-error" variant="error">
            {fields.email}
          </FormMessage>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-password">Password</Label>
        <Input
          id="agent-password"
          type="password"
          required
          minLength={6}
          autoComplete="current-password"
          value={password}
          aria-invalid={Boolean(fields.password) || undefined}
          aria-describedby={fields.password ? "agent-password-error" : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
        {fields.password ? (
          <FormMessage id="agent-password-error" variant="error">
            {fields.password}
          </FormMessage>
        ) : null}
      </div>
      <Button type="submit" loading={pending} loadingLabel="Signing in…">
        Sign in
      </Button>
      {googleAvailable ? (
        <Button type="button" variant="outline" asChild>
          <a href={`/api/agent/google/start?return_to=${encodeURIComponent(from)}`}>
            Continue with Google
          </a>
        </Button>
      ) : null}
      <p className="text-xs text-muted-foreground">
        <Link href="/agent/forgot-password" className="font-semibold text-primary hover:underline">
          Forgot password?
        </Link>
      </p>
      <p className="text-xs text-muted-foreground">
        New agent?{" "}
        <Link href="/agent/register" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
