import { resolveServerApiBaseUrl } from '@realestategear/api-client';
import { PORTAL_SLUG } from './portal';
import type { PortalPropertySummary, PortalReadiness } from './listings';
const API_BASE = resolveServerApiBaseUrl(process.env);
export interface LandingResult { metadata: { id: string; slug: string; name: string; description: string | null }; properties: PortalPropertySummary[]; readiness: PortalReadiness; gated: boolean }
export async function getLanding(kind: 'areas' | 'collections', slug: string): Promise<LandingResult | null> {
  try { const response = await fetch(`${API_BASE}/api/portals/slug/${PORTAL_SLUG}/${kind}/${encodeURIComponent(slug)}`, { cache: 'no-store' }); return response.ok ? response.json() : null; } catch { return null; }
}
