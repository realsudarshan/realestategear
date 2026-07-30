import { prisma, Prisma } from 'db';
import logger from '../utils/logger.js';
import type {
  ResoResource,
  ResoPropertyRecord,
  ResoMemberRecord,
  ResoOfficeRecord,
} from '../connectors/reso/types.js';
import { getCursor, updateCursor } from './cursor.js';
import {
  processPropertyRecord,
  SearchIndexReconciliationError,
  type ProcessResult,
} from './persistence.js';
import { upsertAgent, upsertOffice } from './roster.js';
import { str, dateOf } from './coerce.js';

const CONCURRENCY = 8;
const MAX_RETRIES = 5;
const MAX_DEAD_LETTER_BATCH = 500;

export interface SyncConfig {
  providerId: string; // e.g. 'mls' — keys cursor / roster / dead-letter
  mlsBoardId: string; // compliance/DB board identity, stored on Listing.mlsBoardId
  prefix?: string; // vendor board prefix (D17), e.g. MLS Grid's "ACT" for ACTRIS
  accessToken?: string; // static bearer token — enables photo download in the persistence layer (D7); unset for OAuth2 vendors
  publicDisplayEnabled?: boolean; // compliance kill-switch — gate public indexing (T15/D19)
  viewableFlagField?: string; // vendor's "viewable"/delete flag, e.g. MLS Grid's "MlgCanView"
}

export interface SyncConnector {
  fetchResource<T>(
    resource: ResoResource,
    opts: { since?: Date; requireViewable?: boolean; expandMedia?: boolean },
  ): AsyncGenerator<T[]>;
}

/** Per-run, per-resource metrics (T14). `skipped` flags a run skipped by the
 *  kill-switch/overlap lock; record-level skips are counted in `skippedRecords`. */
export interface SyncMetrics {
  resource: ResoResource;
  skipped: boolean;
  fetched: number;
  processed: number;
  created: number;
  updated: number;
  removed: number;
  skippedRecords: number;
  failed: number;
  mediaFailed: number;
  indexFailed: number;
  retried: number;
  recovered: number;
}

function emptyMetrics(resource: ResoResource): SyncMetrics {
  return {
    resource,
    skipped: false,
    fetched: 0,
    processed: 0,
    created: 0,
    updated: 0,
    removed: 0,
    skippedRecords: 0,
    failed: 0,
    mediaFailed: 0,
    indexFailed: 0,
    retried: 0,
    recovered: 0,
  };
}

// Warn loudly when more than this fraction of fetched records fail.
const FAILURE_ALERT_RATIO = 0.1;

type AnyRecord = Record<string, unknown> & { ModificationTimestamp?: unknown };

// In-process guard: node-cron fires on schedule regardless of whether the prior
// run finished, so a slow run could overlap the next tick and race the cursor
// (decision D18). This prevents that. NOTE: single-process only — a multi-instance
// deployment would additionally need a DB-level lock (flagged follow-up).
const running = new Set<string>();

function externalIdOf(resource: ResoResource, record: AnyRecord): string | undefined {
  if (resource === 'Property') return str(record.ListingKey);
  if (resource === 'Member') return str(record.MemberKey);
  return str(record.OfficeKey);
}

async function dispatch(
  resource: ResoResource,
  record: AnyRecord,
  config: SyncConfig,
): Promise<ProcessResult> {
  if (resource === 'Property') {
    return processPropertyRecord(record as unknown as ResoPropertyRecord, {
      providerId: config.providerId,
      mlsBoardId: config.mlsBoardId,
      prefix: config.prefix,
      accessToken: config.accessToken,
      publicDisplayEnabled: config.publicDisplayEnabled,
      viewableFlagField: config.viewableFlagField,
    });
  }
  if (resource === 'Member') {
    const ok = await upsertAgent(record as unknown as ResoMemberRecord, {
      providerId: config.providerId,
      prefix: config.prefix,
    });
    return { outcome: ok ? 'updated' : 'skipped', listingKey: null };
  }
  const ok = await upsertOffice(record as unknown as ResoOfficeRecord, {
    providerId: config.providerId,
    prefix: config.prefix,
  });
  return { outcome: ok ? 'updated' : 'skipped', listingKey: null };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── dead-letter (decision D13) ───────────────────────────────────────────────
async function recordFailure(
  config: SyncConfig,
  resource: ResoResource,
  externalId: string,
  record: AnyRecord,
  error: string,
): Promise<void> {
  await prisma.mlsSyncFailure.upsert({
    where: { providerId_resource_externalId: { providerId: config.providerId, resource, externalId } },
    create: {
      providerId: config.providerId,
      resource,
      externalId,
      payload: record as Prisma.InputJsonValue,
      error,
      retryCount: 0,
    },
    update: { error, retryCount: { increment: 1 }, lastTriedAt: new Date() },
  });
}

async function clearFailure(config: SyncConfig, resource: ResoResource, externalId: string): Promise<void> {
  await prisma.mlsSyncFailure.deleteMany({
    where: { providerId: config.providerId, resource, externalId },
  });
}

/** Re-process previously dead-lettered records, up to MAX_RETRIES each (D13). */
export async function retryFailures(
  resource: ResoResource,
  config: SyncConfig,
): Promise<{ retried: number; recovered: number }> {
  const exhausted = await prisma.mlsSyncFailure.count({
    where: { providerId: config.providerId, resource, retryCount: { gte: MAX_RETRIES } },
  });
  if (exhausted > 0) {
    logger.error('[mls] Dead-letter records permanently abandoned (retryCount >= MAX_RETRIES)', {
      resource,
      exhausted,
    });
  }
  const pending = await prisma.mlsSyncFailure.findMany({
    where: { providerId: config.providerId, resource, retryCount: { lt: MAX_RETRIES } },
    take: MAX_DEAD_LETTER_BATCH,
  });
  let recovered = 0;
  for (const failure of pending) {
    const record = failure.payload as AnyRecord;
    try {
      await dispatch(resource, record, config);
      await clearFailure(config, resource, failure.externalId);
      recovered++;
    } catch (err) {
      await recordFailure(config, resource, failure.externalId, record, errMsg(err));
    }
  }
  return { retried: pending.length, recovered };
}

// ── page processing (bounded concurrency, D15) ───────────────────────────────
async function processPage(
  page: AnyRecord[],
  resource: ResoResource,
  config: SyncConfig,
  m: SyncMetrics,
): Promise<void> {
  for (let i = 0; i < page.length; i += CONCURRENCY) {
    const chunk = page.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (record) => {
        try {
          const result = await dispatch(resource, record, config);
          switch (result.outcome) {
            case 'created':
              m.created++;
              m.processed++;
              break;
            case 'updated':
              m.updated++;
              m.processed++;
              break;
            case 'removed':
              m.removed++;
              m.processed++;
              break;
            case 'skipped':
              m.skippedRecords++;
              break;
          }
          if (result.mediaFailed) m.mediaFailed++;
        } catch (err) {
          if (err instanceof SearchIndexReconciliationError) m.indexFailed++;
          else m.failed++;
          const externalId = externalIdOf(resource, record);
          if (externalId) {
            await recordFailure(config, resource, externalId, record, errMsg(err));
          } else {
            logger.error('[mls] record failed with no external id — dropped', {
              resource,
              error: errMsg(err),
            });
          }
        }
      }),
    );
  }
}

/**
 * Sync one resource end to end: retry the dead-letter, then stream pages from the
 * connector (incremental from the watermark, or a full pull), process each page
 * with bounded concurrency, capture failures, and advance the watermark to the
 * greatest ModificationTimestamp seen (D4). Guarded against overlapping runs (D18).
 */
export async function runSync(
  resource: ResoResource,
  opts: { fullSync?: boolean },
  config: SyncConfig,
  deps: { connector: SyncConnector },
): Promise<SyncMetrics> {
  // Kill-switch (T15): stop the sync without a redeploy.
  if (process.env.MLS_SYNC_ENABLED === 'false') {
    logger.warn(`[mls] ${resource} sync disabled (MLS_SYNC_ENABLED=false) — skipping`);
    return { ...emptyMetrics(resource), skipped: true };
  }

  const lockKey = `${config.providerId}:${resource}`;
  if (running.has(lockKey)) {
    logger.warn(`[mls] ${resource} sync already running — skipping this tick`);
    return { ...emptyMetrics(resource), skipped: true };
  }
  running.add(lockKey);
  const m = emptyMetrics(resource);
  try {
    const retry = await retryFailures(resource, config);
    m.retried = retry.retried;
    m.recovered = retry.recovered;
    if (retry.retried) {
      logger.info(`[mls] ${resource}: retried ${retry.retried} dead-lettered, recovered ${retry.recovered}`);
    }

    const since = opts.fullSync ? undefined : await getCursor(config.providerId, resource);
    let maxTs: Date | undefined;

    for await (const page of deps.connector.fetchResource<AnyRecord>(resource, {
      since,
      requireViewable: opts.fullSync,
      expandMedia: resource === 'Property',
    })) {
      m.fetched += page.length;
      await processPage(page, resource, config, m);
      for (const record of page) {
        const ts = dateOf(record.ModificationTimestamp);
        if (ts && (!maxTs || ts > maxTs)) maxTs = ts;
      }
    }

    if (maxTs) await updateCursor(config.providerId, resource, maxTs);

    // Metrics (T14): one structured line per run + loud alerts on errors.
    logger.info('[mls] sync metrics', { ...m, fullSync: !!opts.fullSync });
    if (m.failed + m.mediaFailed + m.indexFailed > 0) {
      logger.warn('[mls] sync completed with errors', {
        resource,
        failed: m.failed,
        mediaFailed: m.mediaFailed,
        indexFailed: m.indexFailed,
        fetched: m.fetched,
      });
    }
    if (m.fetched > 0 && m.failed / m.fetched > FAILURE_ALERT_RATIO) {
      logger.error('[mls] ALERT: high failure rate', {
        resource,
        failed: m.failed,
        fetched: m.fetched,
        ratio: Number((m.failed / m.fetched).toFixed(2)),
      });
    }
    return m;
  } finally {
    running.delete(lockKey);
  }
}
