"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { resolveServerApiBaseUrl } from "@realestategear/api-client";
import { buildProxyHeaders } from "@/lib/proxy-headers";
import { PORTAL_SLUG } from "@/lib/portal";

const InquirySchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Enter a valid email"),
  phone: z.string().max(40).optional(),
  community: z.string().max(120).optional(),
  message: z.string().max(2000).optional(),
  areaSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  collectionSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
});

export type InquiryResult = { ok: boolean; error?: string };

export async function submitInquiry(
  _prev: InquiryResult | null,
  formData: FormData,
): Promise<InquiryResult> {
  const parsed = InquirySchema.safeParse({
    name: formData.get("name") ?? undefined,
    email: formData.get("email") ?? undefined,
    phone: formData.get("phone") || undefined,
    community: formData.get("community") || undefined,
    message: formData.get("message") || undefined,
    areaSlug: formData.get("areaSlug") || undefined,
    collectionSlug: formData.get("collectionSlug") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { name, email, phone, community, message, areaSlug, collectionSlug } = parsed.data;

  // Build message body: include community interest if provided.
  const messageBody = [
    community ? `Community of interest: ${community}` : null,
    message || null,
  ]
    .filter(Boolean)
    .join("\n\n") || "Interested in golf communities.";

  const apiBase = resolveServerApiBaseUrl(process.env);
  const url = `${apiBase}/api/portals/${PORTAL_SLUG}/inquiries`;

  try {
    // Forward the visitor's real IP — without it, the API's per-IP inquiry
    // rate limit sees every visitor as this server's own container IP and
    // collapses into one shared bucket for the whole portal.
    const requestHeaders = await headers();
    const res = await fetch(url, {
      method: "POST",
      headers: buildProxyHeaders(requestHeaders),
      body: JSON.stringify({
        visitorName: name,
        visitorEmail: email,
        visitorPhone: phone ?? null,
        message: messageBody,
        areaSlug,
        collectionSlug,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as { error?: string }).error ?? "Unable to submit. Please try again.";
      return { ok: false, error: msg };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to reach the server. Please try again." };
  }
}
