/**
 * Types for the RESO Web API (OData v4) connector. RESO Web API is the
 * NAR-mandated standard implemented by MLS Grid, Trestle (CoreLogic/Cotality),
 * Bridge Interactive, Spark API, and others — this connector is not specific
 * to any one of them. Vendor-specific quirks (board-scope filter field, a
 * "viewable" delete-flag field, auth mechanism) are all injected as config,
 * not hardcoded.
 *
 * RESO records carry hundreds of fields; we type only what the connector and
 * persistence layer read, plus an index signature so unmapped fields pass
 * through untouched.
 */

import type { AuthStrategy } from './auth/types.js';

export type ResoResource = 'Property' | 'Member' | 'Office';

/** OData collection response envelope. `@odata.nextLink` drives pagination (D3). */
export interface ODataResponse<T> {
  value: T[];
  '@odata.nextLink'?: string;
}

export interface Logger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

/** Minimal HTTP surface the connector needs — lets tests inject a fake. */
export interface HttpClient {
  get<T = unknown>(url: string, headers?: Record<string, string>): Promise<{ data: T; status: number }>;
}

export interface ResoConnectorConfig {
  /** e.g. https://api.mlsgrid.com/v2, or a vendor-specific base URL. */
  baseUrl: string;
  authStrategy: AuthStrategy;
  /**
   * Field name to scope every query to one board, e.g. "OriginatingSystemName"
   * (MLS Grid's convention). Omit both this and `boardScopeValue` when the
   * credential itself implies the board scope (common for a single-board
   * Trestle/Bridge/Spark license) — no filter clause is added in that case.
   */
  boardScopeField?: string;
  boardScopeValue?: string;
  /**
   * Field name for a vendor's "viewable"/delete flag, e.g. "MlgCanView" (MLS
   * Grid). Omit if the vendor has no such flag — removal then relies purely
   * on StandardStatus.
   */
  viewableFlagField?: string;
  /** Board prefix on Key/MlsId values, e.g. "ACT" for ACTRIS via MLS Grid (D17). */
  prefix?: string;
  pageSize?: number;
  timeoutMs?: number;
  /** Minimum gap between requests, to respect the vendor's rate limit. */
  minRequestIntervalMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

export interface FetchOptions {
  /** Incremental watermark: only records with ModificationTimestamp gt `since`. */
  since?: Date;
  /** Inject the viewable-flag filter — full import only. Incremental must NOT set this (D5). */
  requireViewable?: boolean;
  /** `$expand=Media` to pull photo records (Property; D7). */
  expandMedia?: boolean;
}

/** Records the connector and persistence layer read by name; rest pass through. */
export interface ResoRecord {
  ModificationTimestamp: string;
  [key: string]: unknown;
}

export interface ResoPropertyRecord extends ResoRecord {
  /** Immutable RESO primary key (prefixed) — the upsert anchor (D17). */
  ListingKey: string;
  /** Human MLS number (prefixed) — display/search only. */
  ListingId?: string;
  StandardStatus?: string;
  ParcelNumber?: string;
}

export interface ResoMemberRecord extends ResoRecord {
  MemberKey: string;
  MemberMlsId?: string;
  MemberStatus?: string;
}

export interface ResoOfficeRecord extends ResoRecord {
  OfficeKey: string;
  OfficeMlsId?: string;
}
