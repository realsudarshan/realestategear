import type { ListingStatus, PropertyType } from 'db';
import { str } from './coerce.js';

/**
 * Pure mapping helpers: MLS Grid (RESO) record fields → our schema values.
 * No DB or network — exhaustively unit-tested. The persistence layer composes
 * these into Prisma upserts.
 */

// ── Status (decision D10) ────────────────────────────────────────────────────
// RESO StandardStatus → our ListingStatus. Anything unmapped is treated as
// NON-VISIBLE (never ACTIVE) and flagged so the caller logs it — a new RESO
// status must never surface a sold/withheld home as for-sale on a portal.
const RESO_STATUS: Record<string, ListingStatus> = {
  Active: 'ACTIVE',
  'Active Under Contract': 'PENDING',
  Pending: 'PENDING',
  Closed: 'SOLD',
  'Coming Soon': 'COMING_SOON',
  Canceled: 'WITHDRAWN',
  Cancelled: 'WITHDRAWN',
  Withdrawn: 'WITHDRAWN',
  Expired: 'EXPIRED',
  Hold: 'WITHDRAWN',
  Delete: 'WITHDRAWN',
  Incomplete: 'WITHDRAWN',
};

/** Fail-safe fallback for an unrecognized status: hidden from the feed, never ACTIVE. */
const STATUS_FALLBACK: ListingStatus = 'WITHDRAWN';

export interface NormalizedStatus {
  status: ListingStatus;
  /** false ⇒ the raw value wasn't in our map; caller should log + (optionally) skip indexing. */
  recognized: boolean;
}

export function normalizeStatus(raw: unknown): NormalizedStatus {
  const key = str(raw);
  if (key && key in RESO_STATUS) {
    return { status: RESO_STATUS[key], recognized: true };
  }
  return { status: STATUS_FALLBACK, recognized: false };
}

// ── Property type (decision D10) ─────────────────────────────────────────────
// RESO PropertySubType (more specific than PropertyType) → our PropertyType.
// Unknown ⇒ undefined (the column is optional); never guess.
const RESO_PROPERTY_TYPE: Record<string, PropertyType> = {
  'Single Family Residence': 'SINGLE_FAMILY',
  'Single Family Detached': 'SINGLE_FAMILY',
  Condominium: 'CONDO',
  Condo: 'CONDO',
  Townhouse: 'TOWNHOUSE',
  Townhome: 'TOWNHOUSE',
  Duplex: 'MULTI_FAMILY',
  Triplex: 'MULTI_FAMILY',
  Quadruplex: 'MULTI_FAMILY',
  'Multi Family': 'MULTI_FAMILY',
  'Residential Income': 'MULTI_FAMILY',
  Land: 'LAND',
  'Unimproved Land': 'LAND',
  Commercial: 'COMMERCIAL',
  'Commercial Sale': 'COMMERCIAL',
};

export function normalizePropertyType(raw: unknown): PropertyType | undefined {
  const key = str(raw);
  return key ? RESO_PROPERTY_TYPE[key] : undefined;
}

// ── Subdivision (TODO-2, in scope) ───────────────────────────────────────────
// Raw MLS subdivision names are dirty (case/whitespace/abbreviation variants).
// Normalize so later subdivision filtering collapses variants to one value.
// Heuristic: trim, collapse whitespace, strip a trailing "Sub(division)", title-case.
export function normalizeSubdivision(raw: unknown): string | undefined {
  let s = str(raw);
  if (!s) return undefined;
  s = s.replace(/\s+/g, ' ').replace(/\s+(subdivisions?|subd?)\.?$/i, '').trim();
  if (!s) return undefined;
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// ── Address (Codex #10) ──────────────────────────────────────────────────────
// Property.address is a single string. RESO provides UnparsedAddress (the full
// street address) — prefer it (whitespace-collapsed), since it's authoritative.
// Fall back to assembling from components when it's absent.
export function assembleAddress(record: Record<string, unknown>): string {
  const unparsed = str(record.UnparsedAddress);
  if (unparsed) return unparsed.replace(/\s+/g, ' ').trim();

  const parts = [
    str(record.StreetNumber),
    str(record.StreetDirPrefix),
    str(record.StreetName),
    str(record.StreetSuffix),
    str(record.StreetDirSuffix),
  ].filter((p): p is string => p !== undefined);
  let address = parts.join(' ');
  const unit = str(record.UnitNumber);
  if (unit) address += ` #${unit}`;
  return address;
}

// ── Raw record for rawData ───────────────────────────────────────────────────
// Store the full source record for fidelity/debug/replay, minus heavy expansions
// (Media) that the Media table owns. NOTE: MLS-local fields are board-prefixed
// (e.g. `ACT_*` / `<board>_*`) and MLS Grid system fields are `Mlg*` — there is no
// `mlg_` prefix in real data, so we keep everything rather than filter by prefix.
const HEAVY_EXPANSIONS = new Set(['Media']);
export function toRawData(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!HEAVY_EXPANSIONS.has(key)) out[key] = value;
  }
  return out;
}

// ── IDX display compliance (Lane F / D19) ────────────────────────────────────
// A listing must not be shown publicly if the listing office opted out of internet
// display. RESO signals this via InternetEntireListingDisplayYN. Block on an
// explicit `false`; absent is treated as displayable. The exact rule (and any
// board-specific opt-in such as IDXOptInYN) is confirmed at the IDX/VOW gate.
export function isIdxDisplayable(record: Record<string, unknown>): boolean {
  const val = record.InternetEntireListingDisplayYN;
  // Guard against RESO providers that serialize booleans as strings or numbers (D19).
  return val !== false && val !== 'false' && val !== 0;
}
