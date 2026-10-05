"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@realestategear/ui/button";
import { Input } from "@realestategear/ui/input";
import { Label } from "@realestategear/ui/label";
import { FormMessage } from "@realestategear/ui/form-message";
import { AgentApiDisabled } from "./agent-api-disabled";
import {
  AGENT_HOME,
  fieldErrorsFromBody,
  formatAgentApiError,
  isAgentApiDisabled,
  type AgentApiErrorBody,
} from "@/lib/agent";

type Fields = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  accountName: string;
};

const EMPTY: Fields = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  accountName: "",
};

function clientValidate(values: Fields): Record<string, string> {
  const next: Record<string, string> = {};
  if (!values.email.trim()) next.email = "Email is required";
  if (values.password.length < 8) next.password = "Password must be at least 8 characters";
  if (values.firstName.trim().length < 2) next.firstName = "First name must be at least 2 characters";
  if (values.lastName.trim().length < 2) next.lastName = "Last name must be at least 2 characters";
  if (values.accountName.trim().length < 2) next.accountName = "Account name must be at least 2 characters";
  return next;
}

export function AgentRegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState<Fields>(EMPTY);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [disabled, setDisabled] = useState(false);

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function checkEmail() {
    if (!values.email.trim()) return;
    try {
      const res = await fetch("/api/agent/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
      const body = (await res.json().catch(() => ({}))) as { exists?: boolean };
      if (res.ok && body.exists) {
        setFields((prev) => ({ ...prev, email: "An agent with that email already exists" }));
      }
    } catch {
      // Availability check is advisory; submit still talks to the API.
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const local = clientValidate(values);
    setFields(local);
    setError("");
    setDisabled(false);
    if (Object.keys(local).length > 0) return;

    setPending(true);
    try {
      const res = await fetch("/api/agent/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          firstName: values.firstName,
          lastName: values.lastName,
          accountName: values.accountName,
        }),
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
      router.push(AGENT_HOME);
      router.refresh();
    } catch {
      setError("Unable to connect to server");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {disabled ? <AgentApiDisabled title="Agent registration is disabled" /> : null}
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agent-first-name">First name</Label>
          <Input
            id="agent-first-name"
            autoComplete="given-name"
            required
            value={values.firstName}
            aria-invalid={Boolean(fields.firstName) || undefined}
            aria-describedby={fields.firstName ? "agent-first-name-error" : undefined}
            onChange={(e) => update("firstName", e.target.value)}
          />
          {fields.firstName ? (
            <FormMessage id="agent-first-name-error" variant="error">
              {fields.firstName}
            </FormMessage>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agent-last-name">Last name</Label>
          <Input
            id="agent-last-name"
            autoComplete="family-name"
            required
            value={values.lastName}
            aria-invalid={Boolean(fields.lastName) || undefined}
            aria-describedby={fields.lastName ? "agent-last-name-error" : undefined}
            onChange={(e) => update("lastName", e.target.value)}
          />
          {fields.lastName ? (
            <FormMessage id="agent-last-name-error" variant="error">
              {fields.lastName}
            </FormMessage>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-account-name">Account / company name</Label>
        <Input
          id="agent-account-name"
          autoComplete="organization"
          required
          value={values.accountName}
          aria-invalid={Boolean(fields.accountName) || undefined}
          aria-describedby={fields.accountName ? "agent-account-name-error" : undefined}
          onChange={(e) => update("accountName", e.target.value)}
        />
        {fields.accountName ? (
          <FormMessage id="agent-account-name-error" variant="error">
            {fields.accountName}
          </FormMessage>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-register-email">Email</Label>
        <Input
          id="agent-register-email"
          type="email"
          required
          autoComplete="email"
          value={values.email}
          aria-invalid={Boolean(fields.email) || undefined}
          aria-describedby={fields.email ? "agent-register-email-error" : undefined}
          onChange={(e) => update("email", e.target.value)}
          onBlur={() => void checkEmail()}
        />
        {fields.email ? (
          <FormMessage id="agent-register-email-error" variant="error">
            {fields.email}
          </FormMessage>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-register-password">Password</Label>
        <Input
          id="agent-register-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={values.password}
          aria-invalid={Boolean(fields.password) || undefined}
          aria-describedby={fields.password ? "agent-register-password-error" : undefined}
          onChange={(e) => update("password", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        {fields.password ? (
          <FormMessage id="agent-register-password-error" variant="error">
            {fields.password}
          </FormMessage>
        ) : null}
      </div>
      <Button type="submit" loading={pending} loadingLabel="Creating account…">
        Create agent account
      </Button>
      <p className="text-xs text-muted-foreground">
        Already registered?{" "}
        <Link href="/agent/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
