import { redirect } from "next/navigation";
import { resolveServerApiBaseUrl } from "@realestategear/api-client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { OwnerLeadsInbox, type LeadsResponse } from "@/components/owner-leads-inbox";
import { getToken } from "@/lib/auth";
import { PORTAL_SLUG } from "@/lib/portal";

const API_BASE = resolveServerApiBaseUrl(process.env);

async function authorizeAndLoad(token: string): Promise<LeadsResponse | null> {
  try {
    const response = await fetch(`${API_BASE}/api/owner/leads?portalSlug=${encodeURIComponent(PORTAL_SLUG)}&limit=25`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new Error(`Owner leads request failed: ${response.status}`);
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Owner leads request failed")) throw error;
    throw new Error("The owner inbox is temporarily unavailable");
  }
}

export default async function OwnerLeadsPage() {
  const token = await getToken();
  if (!token) redirect("/login?from=/admin/leads");
  const initial = await authorizeAndLoad(token);
  if (!initial) redirect("/login?from=/admin/leads");

  return <><SiteHeader /><main className="min-h-screen bg-background"><OwnerLeadsInbox initial={initial} /></main><SiteFooter /></>;
}
