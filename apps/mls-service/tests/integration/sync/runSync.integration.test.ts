import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

vi.mock('search', () => ({
  deleteDocument: vi.fn(async () => undefined),
  isTypesenseConfigured: vi.fn(() => true),
  reconcilePropertyDocument: vi.fn(async () => 'upserted'),
}));

import { prisma } from 'db';
import { runSync, retryFailures, type SyncConfig, type SyncConnector } from '../../../src/sync/runSync.js';

const config: SyncConfig = {
  providerId: 'mlsgrid',
  mlsBoardId: 'CanopyMLS',
  prefix: 'CANOPY',
  viewableFlagField: 'MlgCanView',
};

/** Fake connector yielding pre-baked pages per resource. */
function connectorFor(pagesByResource: Record<string, unknown[][]>): SyncConnector {
  return {
    async *fetchResource<T>(resource: string): AsyncGenerator<T[]> {
      for (const page of pagesByResource[resource] ?? []) yield page as T[];
    },
  };
}

let seq = 0;
function propRecord(over: Record<string, unknown> = {}): Record<string, unknown> {
  seq += 1;
  return {
    ListingKey: `K${seq}`,
    ListingId: `CANOPY${seq}`,
    ModificationTimestamp: '2026-06-02T00:00:00.000Z',
    MlgCanView: true,
    StandardStatus: 'Active',
    ParcelNumber: `P${seq}`,
    StreetNumber: '1',
    StreetName: 'Main',
    City: 'Charlotte',
    StateOrProvince: 'NC',
    PostalCode: '28202',
    ...over,
  };
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Property", "Listing", "SyncCursor", "MlsSyncFailure" RESTART IDENTITY CASCADE',
  );
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('runSync — streaming + watermark (D4/D15)', () => {
  it('processes every page and advances the cursor to the max ModificationTimestamp', async () => {
    const a = propRecord({ ListingKey: 'KA', ModificationTimestamp: '2026-06-01T00:00:00.000Z' });
    const b = propRecord({ ListingKey: 'KB', ModificationTimestamp: '2026-06-03T00:00:00.000Z' }); // latest
    const c = propRecord({ ListingKey: 'KC', ModificationTimestamp: '2026-06-02T00:00:00.000Z' });
    const connector = connectorFor({ Property: [[a, b], [c]] });

    const stats = await runSync('Property', {}, config, { connector });

    expect(stats).toMatchObject({ processed: 3, created: 3, fetched: 3, failed: 0, skipped: false });
    expect(await prisma.listing.count()).toBe(3);
    const cursor = await prisma.syncCursor.findUnique({
      where: { providerId_resource: { providerId: 'mlsgrid', resource: 'Property' } },
    });
    expect(cursor?.lastSyncAt.toISOString()).toBe('2026-06-03T00:00:00.000Z');
  });
});

describe('runSync — slug-conflict retry under full-chunk contention', () => {
  it('resolves all 8 same-address records in one concurrent chunk with distinct slugs', async () => {
    // CONCURRENCY in runSync.ts is 8, so a page this size is dispatched as a
    // single Promise.all batch — the worst case for the slug-conflict retry
    // in persistence.ts (each retry wave resolves exactly one winner, so the
    // last straggler needs up to CONCURRENCY - 1 attempts).
    const sameAddress = Array.from({ length: 8 }, (_, i) =>
      propRecord({
        ListingKey: `BURST${i}`,
        StreetNumber: '500',
        StreetName: 'Contention',
        City: 'Charlotte',
        StateOrProvince: 'NC',
      }),
    );
    const connector = connectorFor({ Property: [sameAddress] });

    const stats = await runSync('Property', {}, config, { connector });

    expect(stats).toMatchObject({ processed: 8, created: 8, fetched: 8, failed: 0 });
    const listings = await prisma.listing.findMany({
      where: { listingKey: { in: sameAddress.map((r) => r.ListingKey as string) } },
    });
    expect(listings).toHaveLength(8);
    expect(new Set(listings.map((l) => l.slug)).size).toBe(8);
  });
});

describe('runSync — dead-letter capture + retry (D13)', () => {
  it('captures a failing record, keeps the batch going, and recovers it on retry', async () => {
    // Two records with the SAME listingKey in one page race to create it; the
    // unique constraint guarantees exactly one fails → dead-lettered.
    const dupA = propRecord({ ListingKey: 'DUP', ParcelNumber: 'PDUP' });
    const dupB = propRecord({ ListingKey: 'DUP', ParcelNumber: 'PDUP' });
    const connector = connectorFor({ Property: [[dupA, dupB]] });

    const stats = await runSync('Property', {}, config, { connector });
    expect(stats.processed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(await prisma.mlsSyncFailure.count({ where: { resource: 'Property', externalId: 'DUP' } })).toBe(1);

    // Retry: the listing now exists, so reprocessing updates it and clears the failure.
    const result = await retryFailures('Property', config);
    expect(result).toEqual({ retried: 1, recovered: 1 });
    expect(await prisma.mlsSyncFailure.count()).toBe(0);
  });
});

describe('runSync — removal via MlgCanView (D5)', () => {
  it('a later page with MlgCanView=false withdraws the listing', async () => {
    const rec = propRecord({ ListingKey: 'KGONE' });
    await runSync('Property', {}, config, { connector: connectorFor({ Property: [[rec]] }) });

    await runSync('Property', {}, config, {
      connector: connectorFor({ Property: [[{ ...rec, MlgCanView: false }]] }),
    });

    const listing = await prisma.listing.findUnique({ where: { listingKey: 'KGONE' } });
    expect(listing?.status).toBe('WITHDRAWN');
  });
});

describe('runSync — overlap guard (D18)', () => {
  it('skips a second run already in progress for the same resource', async () => {
    const connector = connectorFor({ Property: [[propRecord()]] });
    const [first, second] = await Promise.all([
      runSync('Property', {}, config, { connector }),
      runSync('Property', {}, config, { connector }),
    ]);
    // The first call takes the in-process lock synchronously before its first await.
    expect([first.skipped, second.skipped].sort()).toEqual([false, true]);
  });
});

describe('runSync — kill-switch (T15)', () => {
  it('skips entirely (processes nothing) when MLS_SYNC_ENABLED=false', async () => {
    process.env.MLS_SYNC_ENABLED = 'false';
    try {
      const stats = await runSync('Property', {}, config, {
        connector: connectorFor({ Property: [[propRecord()]] }),
      });
      expect(stats.skipped).toBe(true);
      expect(stats.processed).toBe(0);
      expect(await prisma.listing.count()).toBe(0); // nothing processed
    } finally {
      delete process.env.MLS_SYNC_ENABLED;
    }
  });
});

describe('runSync — metrics breakdown (T14)', () => {
  it('counts created / updated / skipped records per run', async () => {
    // seed one listing
    await runSync('Property', {}, config, {
      connector: connectorFor({ Property: [[propRecord({ ListingKey: 'MX1' })]] }),
    });

    // second run: update MX1, create MX2, skip a record with no ListingKey
    const stats = await runSync('Property', {}, config, {
      connector: connectorFor({
        Property: [
          [
            propRecord({ ListingKey: 'MX1' }),
            propRecord({ ListingKey: 'MX2' }),
            { ListingKey: '', ModificationTimestamp: '2026-06-02T00:00:00.000Z', MlgCanView: true },
          ],
        ],
      }),
    });

    expect(stats.fetched).toBe(3);
    expect(stats.created).toBe(1); // MX2
    expect(stats.updated).toBe(1); // MX1
    expect(stats.skippedRecords).toBe(1); // no ListingKey
    expect(stats.processed).toBe(2);
    expect(stats.failed).toBe(0);
  });
});
