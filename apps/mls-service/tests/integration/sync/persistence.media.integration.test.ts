import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

// Capture the indexed doc; force storage "configured"; stub the media download.
vi.mock('search', () => ({
  upsertDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  toPropertyDoc: (p: { id: string }, l: { imageUrl?: string | null } | null) => ({
    id: p.id,
    imageUrl: l?.imageUrl ?? undefined,
  }),
}));
vi.mock('../../../src/storage/s3.js', () => ({ isStorageConfigured: () => true }));
vi.mock('../../../src/sync/media.js', () => ({
  syncPropertyMedia: vi.fn(async () => ({ imageUrl: 'https://cdn.test/primary.jpg', changed: true })),
}));

import { prisma } from 'db';
import { upsertDocument } from 'search';
import { syncPropertyMedia } from '../../../src/sync/media.js';
import { processPropertyRecord } from '../../../src/sync/persistence.js';
import type { ResoPropertyRecord } from '../../../src/connectors/reso/types.js';

const config = {
  mlsBoardId: 'carolina',
  prefix: 'CAR',
  accessToken: 'tok-xyz',
  publicDisplayEnabled: true,
  viewableFlagField: 'MlgCanView',
};

const record = {
  ListingKey: 'CARKEY1',
  ListingId: 'CAR1001',
  ModificationTimestamp: '2026-06-05T00:00:00.000Z',
  PhotosChangeTimestamp: '2026-06-05T00:00:00.000Z',
  MlgCanView: true,
  StandardStatus: 'Active',
  ParcelNumber: 'P1',
  UnparsedAddress: '1 Main St',
  City: 'Charlotte',
  StateOrProvince: 'NC',
  PostalCode: '28202',
  Media: [{ MediaURL: 'https://mls/p0', Order: 0 }],
} as unknown as ResoPropertyRecord;

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Property", "Listing" RESTART IDENTITY CASCADE');
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('processPropertyRecord media wiring (D7)', () => {
  it('runs media when token+storage are configured, persists imageUrl, and indexes it', async () => {
    await processPropertyRecord(record, config);

    expect(vi.mocked(syncPropertyMedia)).toHaveBeenCalledOnce();
    // imageUrl persisted on the listing
    const listing = await prisma.listing.findUnique({ where: { listingKey: 'CARKEY1' } });
    expect(listing?.imageUrl).toBe('https://cdn.test/primary.jpg');
    // and reflected in the search doc
    const doc = vi.mocked(upsertDocument).mock.calls[0][1] as { imageUrl?: string };
    expect(doc.imageUrl).toBe('https://cdn.test/primary.jpg');
  });

  it('skips media entirely when no access token is configured', async () => {
    await processPropertyRecord(record, {
      mlsBoardId: 'carolina',
      prefix: 'CAR',
      publicDisplayEnabled: true,
    });
    expect(vi.mocked(syncPropertyMedia)).not.toHaveBeenCalled();
  });
});
