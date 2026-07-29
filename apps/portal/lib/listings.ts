import { resolveServerApiBaseUrl } from "@realestategear/api-client";
import { PORTAL_SLUG } from "@/lib/portal";

const API_BASE = resolveServerApiBaseUrl(process.env);

export interface PortalPropertySummary {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  subdivision: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  imageUrl: string | null;
  slug: string | null;
  status: string | null;
  listingId: string | null;
}

export interface PortalPropertyDetail extends PortalPropertySummary {
  propertyType: string | null;
  lotSize: number | null;
  yearBuilt: number | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  mlsId: string | null;
  mlsBoardId: string | null;
  mlsBoardName: string | null;
  listingDate: string | null;
  lastMlsUpdate: string | null;
  listingAgentName: string | null;
  brokerageName: string | null;
  brokeragePhone: string | null;
  media: Array<{ id: string; url: string; caption: string | null }>;
}

export interface PortalReadinessGate {
  id: string;
  label: string;
  state: "passed" | "blocked" | "warning";
  reason?: string;
}

export interface PortalReadiness {
  listingMode: "hidden" | "mock" | "db";
  publicListingDisplay: "hidden" | "mock" | "real";
  canShowSearch: boolean;
  canShowListings: boolean;
  configSource: "code" | "default";
  gates: PortalReadinessGate[];
  blockers: PortalReadinessGate[];
  warnings: PortalReadinessGate[];
}

export interface PortalListingsResult {
  properties: PortalPropertySummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  readiness: PortalReadiness;
}

export interface PortalListingsParams {
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
}

const EMPTY_RESULT: PortalListingsResult = {
  properties: [],
  pagination: { page: 1, limit: 12, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
  readiness: {
    listingMode: "hidden",
    publicListingDisplay: "hidden",
    canShowSearch: false,
    canShowListings: false,
    configSource: "default",
    gates: [],
    blockers: [],
    warnings: [],
  },
};

// GET /api/portals/slug/:slug/listings is public and already readiness-gated
// server-side (see portalReadinessService.ts) — the response always includes
// `readiness` even when gates block real listings, so callers don't need a
// separate readiness fetch.
export async function getPortalListings(params: PortalListingsParams = {}): Promise<PortalListingsResult> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.minPrice != null) query.set("minPrice", String(params.minPrice));
  if (params.maxPrice != null) query.set("maxPrice", String(params.maxPrice));
  if (params.bedrooms != null) query.set("bedrooms", String(params.bedrooms));
  if (params.bathrooms != null) query.set("bathrooms", String(params.bathrooms));
  if (params.propertyType) query.set("propertyType", params.propertyType);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);
  if (params.page) query.set("page", String(params.page));

  try {
    const res = await fetch(`${API_BASE}/api/portals/slug/${PORTAL_SLUG}/listings?${query.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return EMPTY_RESULT;
    return (await res.json()) as PortalListingsResult;
  } catch {
    return EMPTY_RESULT;
  }
}

export async function getPortalProperty(identifier: string): Promise<PortalPropertyDetail | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/portals/slug/${PORTAL_SLUG}/properties/${encodeURIComponent(identifier)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as PortalPropertyDetail;
  } catch {
    return null;
  }
}
