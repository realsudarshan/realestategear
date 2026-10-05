"use client";

import { useState } from "react";
import { Button } from "@realestategear/ui/button";
import { Input } from "@realestategear/ui/input";
import { NativeSelect } from "@realestategear/ui/native-select";
import { Textarea } from "@realestategear/ui/textarea";
import type { AgentContact } from "@/lib/agent";

type ContactValues = Pick<AgentContact, "firstName" | "lastName" | "email" | "phone" | "company" | "type" | "source" | "stage"> & {
  tags: string;
  buyerStage: string;
  sellerStage: string;
};

const EMPTY: ContactValues = {
  firstName: "", lastName: "", email: "", phone: "", company: "", type: "LEAD",
  source: "", stage: "NEW", tags: "", buyerStage: "", sellerStage: "",
};

export function AgentContactForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<ContactValues>;
  submitLabel: string;
  onSubmit: (values: ContactValues) => Promise<void>;
}) {
  const [values, setValues] = useState<ContactValues>({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof ContactValues, value: string) => setValues((current) => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try { await onSubmit(values); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save contact."); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" aria-label="Contact form">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">First name<Input required value={values.firstName} onChange={(e) => set("firstName", e.target.value)} /></label>
        <label className="text-sm font-medium">Last name<Input required value={values.lastName} onChange={(e) => set("lastName", e.target.value)} /></label>
        <label className="text-sm font-medium">Email<Input type="email" value={values.email ?? ""} onChange={(e) => set("email", e.target.value)} /></label>
        <label className="text-sm font-medium">Phone<Input value={values.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></label>
        <label className="text-sm font-medium">Company<Input value={values.company ?? ""} onChange={(e) => set("company", e.target.value)} /></label>
        <label className="text-sm font-medium">Source<Input value={values.source ?? ""} onChange={(e) => set("source", e.target.value)} /></label>
        <label className="text-sm font-medium">Type<NativeSelect value={values.type} onChange={(e) => set("type", e.target.value)}><option value="LEAD">Lead</option><option value="BUYER">Buyer</option><option value="SELLER">Seller</option><option value="VENDOR">Vendor</option></NativeSelect></label>
        <label className="text-sm font-medium">Stage<NativeSelect value={values.stage} onChange={(e) => set("stage", e.target.value)}><option value="NEW">New</option><option value="CONTACTED">Contacted</option><option value="QUALIFIED">Qualified</option><option value="ACTIVE">Active</option><option value="CLOSED">Closed</option></NativeSelect></label>
        <label className="text-sm font-medium sm:col-span-2">Tags <span className="font-normal text-muted-foreground">(comma separated)</span><Input value={values.tags} onChange={(e) => set("tags", e.target.value)} /></label>
        <label className="text-sm font-medium">Buyer track stage<Input value={values.buyerStage} onChange={(e) => set("buyerStage", e.target.value)} /></label>
        <label className="text-sm font-medium">Seller track stage<Input value={values.sellerStage} onChange={(e) => set("sellerStage", e.target.value)} /></label>
      </div>
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : submitLabel}</Button>
    </form>
  );
}

export function contactFormPayload(values: ContactValues) {
  return {
    firstName: values.firstName, lastName: values.lastName, email: values.email || undefined,
    phone: values.phone || undefined, company: values.company || undefined, type: values.type,
    source: values.source || undefined, stage: values.stage,
    tags: values.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    tracks: [
      values.buyerStage ? { side: "BUYER", stage: values.buyerStage } : null,
      values.sellerStage ? { side: "SELLER", stage: values.sellerStage } : null,
    ].filter(Boolean),
  };
}
