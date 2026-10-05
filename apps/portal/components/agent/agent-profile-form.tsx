"use client";

import { useState } from "react";
import { Button } from "@realestategear/ui/button";
import { Input } from "@realestategear/ui/input";
import { Label } from "@realestategear/ui/label";
import { FormMessage } from "@realestategear/ui/form-message";
import {
  fieldErrorsFromBody,
  formatAgentApiError,
  isAgentApiDisabled,
  type AgentApiErrorBody,
  type AgentPublicUser,
} from "@/lib/agent";
import { AgentApiDisabled } from "./agent-api-disabled";

export function AgentProfileForm({ user }: { user: AgentPublicUser }) {
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [disabled, setDisabled] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setFields({});
    setDisabled(false);
    setPending(true);
    try {
      const res = await fetch("/api/agent/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phoneNumber }),
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
      setSuccess("Profile saved.");
    } catch {
      setError("Unable to connect to server");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4" noValidate>
      {disabled ? <AgentApiDisabled /> : null}
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      {success ? <FormMessage variant="success">{success}</FormMessage> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" type="email" value={user.email} disabled readOnly />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-first-name">First name</Label>
          <Input
            id="profile-first-name"
            autoComplete="given-name"
            value={firstName}
            aria-invalid={Boolean(fields.firstName) || undefined}
            onChange={(e) => setFirstName(e.target.value)}
          />
          {fields.firstName ? <FormMessage variant="error">{fields.firstName}</FormMessage> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-last-name">Last name</Label>
          <Input
            id="profile-last-name"
            autoComplete="family-name"
            value={lastName}
            aria-invalid={Boolean(fields.lastName) || undefined}
            onChange={(e) => setLastName(e.target.value)}
          />
          {fields.lastName ? <FormMessage variant="error">{fields.lastName}</FormMessage> : null}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-phone">Phone number</Label>
        <Input
          id="profile-phone"
          type="tel"
          autoComplete="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />
      </div>
      <Button type="submit" loading={pending} loadingLabel="Saving…">
        Save profile
      </Button>
    </form>
  );
}
