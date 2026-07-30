import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

// Mock the shared search package so these DB-focused tests don't hit Typesense.
// We assert the search ops were called, and assert real DB state.
vi.mock('search', () => ({
  deleteDocument: vi.fn(async () => undefined),
  isTypesenseConfigured: vi.fn(() => true),
  reconcilePropertyDocument: vi.fn(async () => 'upserted'),
}));

import { prisma } from 'db';
import { deleteDocument, reconcilePropertyDocument } from 'search';
import {
  processPropertyRecord,
  SearchIndexReconciliationError,
  type MlsPersistenceConfig,
} from '../../../src/sync/persistence.js';
import type { ResoPropertyRecord } from '../../../src/connectors/reso/types.js';

const config: MlsPersistenceConfig = {
  mlsBoardId: 'CanopyMLS',
  prefix: 'CANOPY',
  publicDisplayEnabled: true,
  viewableFlagField: 'MlgCanView',
};

let keySeq = 0;
function makeRecord(overrides: Partial<ResoPropertyRecord> = {}): ResoPropertyRecord {
  keySeq += 1;
  return {
    ListingKey: `CANOPYKEY${keySeq}`,
    ListingId: `CANOPY100${keySeq}`,
    ModificationTimestamp: '2026-06-05T00:00:00.000Z',
    MlgCanView: true,
    StandardStatus: 'Active',
    ParcelNumber: `PARCEL${keySeq}`,
    StreetNumber: '123',
    StreetName: 'Main',
    StreetSuffix: 'St',
    City: 'Charlotte',
    StateOrProvince: 'NC',
    PostalCode: '28202',
    ListPrice: 500000,
    BedroomsTotal: 3,
    ...overrides,
  } as ResoPropertyRecord;
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Property", "Listing" RESTART IDENTITY CASCADE');
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('processPropertyRecord — upsert (D11/D12/D17)', () => {
  it('creates a Property + Listing and indexes it', async () => {
    const rec = makeRecord({ ListingKey: 'CANOPYKEY_A', ListingId: 'CANOPY12345' });
    const result = await processPropertyRecord(rec, config);

    expect(result.outcome).toBe('created');

    const listing = await prisma.listing.findUnique({ where: { listingKey: 'CANOPYKEY_A' } });
    expect(listing).not.toBeNull();
    expect(listing!.source).toBe('MLS');
    expect(listing!.mlsBoardId).toBe('CanopyMLS');
    expect(listing!.status).toBe('ACTIVE');
    expect(listing!.slug).toBeTruthy();
    // D17: listingKey stored prefixed; mlsId stored de-prefixed for display.
    expect(listing!.listingKey).toBe('CANOPYKEY_A');
    expect(listing!.mlsId).toBe('12345');

    expect(vi.mocked(reconcilePropertyDocument)).toHaveBeenCalledOnce();
  });

  it('is idempotent — re-processing the same record updates, not duplicates', async () => {
    const rec = makeRecord({ ListingKey: 'CANOPYKEY_B', ListPrice: 400000 });
    await processPropertyRecord(rec, config);
    const second = await processPropertyRecord({ ...rec, ListPrice: 450000 }, config);

    expect(second.outcome).toBe('updated');
    const listings = await prisma.listing.findMany({ where: { listingKey: 'CANOPYKEY_B' } });
    expect(listings).toHaveLength(1);
    expect(Number(listings[0].listPrice)).toBe(450000);
  });

  it('aborts an existing-record upsert before changing the database when pre-delete fails', async () => {
    const rec = makeRecord({ ListingKey: 'KEY_PREDELETE', ListPrice: 400000 });
    await processPropertyRecord(rec, config);
    vi.mocked(deleteDocument).mockRejectedValueOnce(new Error('typesense unavailable'));

    await expect(processPropertyRecord({ ...rec, ListPrice: 450000 }, config))
      .rejects.toBeInstanceOf(SearchIndexReconciliationError);

    const listing = await prisma.listing.findUnique({ where: { listingKey: 'KEY_PREDELETE' } });
    expect(Number(listing?.listPrice)).toBe(400000);
  });

  it('a relisting (same parcel, new ListingKey) reuses one Property (D11)', async () => {
    const parcel = 'PARCEL_SHARED';
    await processPropertyRecord(makeRecord({ ListingKey: 'KEY_OLD', ParcelNumber: parcel }), config);
    await processPropertyRecord(makeRecord({ ListingKey: 'KEY_NEW', ParcelNumber: parcel }), config);

    const properties = await prisma.property.findMany({ where: { parcelId: parcel } });
    const listings = await prisma.listing.findMany({
      where: { listingKey: { in: ['KEY_OLD', 'KEY_NEW'] } },
    });
    expect(properties).toHaveLength(1); // one physical property
    expect(listings).toHaveLength(2); // two listing periods
    expect(new Set(listings.map((l) => l.propertyId)).size).toBe(1);
  });

  it('multi-unit records sharing a parcel do NOT collapse into one Property (Codex #11)', async () => {
    const parcel = 'PARCEL_CONDO';
    await processPropertyRecord(
      makeRecord({ ListingKey: 'UNIT_1', ParcelNumber: parcel, UnitNumber: '101' }),
      config,
    );
    await processPropertyRecord(
      makeRecord({ ListingKey: 'UNIT_2', ParcelNumber: parcel, UnitNumber: '102' }),
      config,
    );

    const listings = await prisma.listing.findMany({
      where: { listingKey: { in: ['UNIT_1', 'UNIT_2'] } },
    });
    expect(new Set(listings.map((l) => l.propertyId)).size).toBe(2); // distinct units, distinct properties
  });

  it('serializes concurrent reconciliation for listings sharing one property', async () => {
    const parcel = 'PARCEL_RECONCILE';
    const first = makeRecord({ ListingKey: 'RECONCILE_A', ParcelNumber: parcel });
    const second = makeRecord({ ListingKey: 'RECONCILE_B', ParcelNumber: parcel });
    await processPropertyRecord(first, config);
    await processPropertyRecord(second, config);
    vi.mocked(reconcilePropertyDocument).mockClear();

    let active = 0;
    let maxActive = 0;
    vi.mocked(reconcilePropertyDocument).mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return 'upserted';
    });

    await Promise.all([
      processPropertyRecord({ ...first, StandardStatus: 'Withdrawn' }, config),
      processPropertyRecord({ ...second, StandardStatus: 'Withdrawn' }, config),
    ]);

    expect(vi.mocked(reconcilePropertyDocument)).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
  });
});

describe('processPropertyRecord — status mapping (D10)', () => {
  it('an unknown StandardStatus is persisted but never ACTIVE', async () => {
    const rec = makeRecord({ ListingKey: 'KEY_WEIRD', StandardStatus: 'Some New Status' });
    await processPropertyRecord(rec, config);

    const listing = await prisma.listing.findUnique({ where: { listingKey: 'KEY_WEIRD' } });
    expect(listing).not.toBeNull();
    expect(listing!.status).not.toBe('ACTIVE');
  });
});

describe('processPropertyRecord — removal (D5)', () => {
  it('MlgCanView=false marks the listing WITHDRAWN and removes its search doc', async () => {
    const rec = makeRecord({ ListingKey: 'KEY_GONE' });
    await processPropertyRecord(rec, config); // create (active)
    vi.mocked(reconcilePropertyDocument).mockClear();

    const result = await processPropertyRecord({ ...rec, MlgCanView: false }, config);

    expect(result.outcome).toBe('removed');
    const listing = await prisma.listing.findUnique({ where: { listingKey: 'KEY_GONE' } });
    expect(listing!.status).toBe('WITHDRAWN');
    expect(vi.mocked(reconcilePropertyDocument)).toHaveBeenCalledOnce();
  });

  it('removing a never-seen listing is a no-op (skipped)', async () => {
    const result = await processPropertyRecord(
      makeRecord({ ListingKey: 'KEY_UNKNOWN', MlgCanView: false }),
      config,
    );
    expect(result.outcome).toBe('skipped');
    expect(vi.mocked(reconcilePropertyDocument)).not.toHaveBeenCalled();
  });

  it('a vendor with no viewableFlagField configured never removes on flag grounds — relies purely on StandardStatus', async () => {
    const noFlagConfig: MlsPersistenceConfig = { ...config, viewableFlagField: undefined };
    const rec = makeRecord({ ListingKey: 'KEY_NO_FLAG_VENDOR' });
    await processPropertyRecord(rec, noFlagConfig); // create (active)

    // Same record with the MLS-Grid-specific flag set false, but this vendor
    // config doesn't declare that field name — must be treated as a normal
    // upsert (StandardStatus unchanged), not a removal.
    const result = await processPropertyRecord({ ...rec, MlgCanView: false }, noFlagConfig);

    expect(result.outcome).toBe('updated');
    const listing = await prisma.listing.findUnique({ where: { listingKey: 'KEY_NO_FLAG_VENDOR' } });
    expect(listing!.status).not.toBe('WITHDRAWN');
  });
});

describe('processPropertyRecord — IDX display compliance (D19)', () => {
  it('a listing opted out of internet display is stored but kept out of the public index', async () => {
    await processPropertyRecord(
      makeRecord({ ListingKey: 'KEY_HIDDEN', InternetEntireListingDisplayYN: false }),
      config,
    );

    const listing = await prisma.listing.findUnique({ where: { listingKey: 'KEY_HIDDEN' } });
    expect(listing).not.toBeNull();
    expect(listing!.idxDisplayable).toBe(false);
    // not indexed; actively removed from the public search index
    expect(vi.mocked(reconcilePropertyDocument)).toHaveBeenCalledOnce();
  });

  it('a normally-displayable listing is indexed', async () => {
    await processPropertyRecord(makeRecord({ ListingKey: 'KEY_SHOWN' }), config);
    const listing = await prisma.listing.findUnique({ where: { listingKey: 'KEY_SHOWN' } });
    expect(listing!.idxDisplayable).toBe(true);
    expect(vi.mocked(reconcilePropertyDocument)).toHaveBeenCalledOnce();
  });

  it('public-display kill-switch off: a displayable listing is stored but NOT indexed (T15)', async () => {
    await processPropertyRecord(makeRecord({ ListingKey: 'KEY_GATED' }), {
      ...config,
      publicDisplayEnabled: false,
    });

    const listing = await prisma.listing.findUnique({ where: { listingKey: 'KEY_GATED' } });
    expect(listing).not.toBeNull(); // still in the DB
    expect(vi.mocked(reconcilePropertyDocument)).toHaveBeenCalledWith(
      listing!.propertyId,
      { MLS_PUBLIC_DISPLAY_ENABLED: 'false' },
    );
  });
});
