import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  reconcile: vi.fn(),
  deleteDocument: vi.fn(),
  isTypesenseConfigured: vi.fn(() => true),
  logError: vi.fn(),
}));

vi.mock('db', () => ({
  prisma: { listing: { findUnique: mocks.findUnique, update: mocks.update } },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  generatePropertySlug: vi.fn(),
  generateUniquePropertySlug: vi.fn(),
}));
vi.mock('db/classification', () => ({ classifyIngestedProperty: vi.fn() }));
vi.mock('search', () => ({
  deleteDocument: mocks.deleteDocument,
  isTypesenseConfigured: mocks.isTypesenseConfigured,
  reconcilePropertyDocument: mocks.reconcile,
}));
vi.mock('../../../src/sync/media.js', () => ({ syncPropertyMedia: vi.fn() }));
vi.mock('../../../src/storage/s3.js', () => ({ isStorageConfigured: vi.fn(() => false) }));
vi.mock('../../../src/utils/logger.js', () => ({
  default: { error: mocks.logError, warn: vi.fn(), info: vi.fn() },
}));

import {
  processPropertyRecord,
  SearchIndexReconciliationError,
} from '../../../src/sync/persistence.js';

const config = {
  mlsBoardId: 'board-1',
  publicDisplayEnabled: true,
  viewableFlagField: 'MlgCanView',
};

describe('MLS removal reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTypesenseConfigured.mockReturnValue(true);
    mocks.deleteDocument.mockResolvedValue(undefined);
  });

  it('reconciles after withdrawal so an eligible manual alternative can remain indexed', async () => {
    mocks.findUnique.mockResolvedValue({ propertyId: 'property-1' });
    mocks.update.mockResolvedValue({});
    mocks.reconcile.mockResolvedValue('upserted');

    const result = await processPropertyRecord(
      { ListingKey: 'mls-1', MlgCanView: false } as never,
      config,
    );

    expect(result).toEqual({ outcome: 'removed', listingKey: 'mls-1' });
    expect(mocks.deleteDocument).toHaveBeenCalledWith('properties', 'property-1');
    expect(mocks.deleteDocument.mock.invocationCallOrder[0]).toBeLessThan(mocks.update.mock.invocationCallOrder[0]);
    expect(mocks.reconcile).toHaveBeenCalledWith('property-1', {
      MLS_PUBLIC_DISPLAY_ENABLED: 'true',
    });
  });

  it('throws a dedicated post-commit error so the record remains dead-lettered', async () => {
    mocks.findUnique.mockResolvedValue({ propertyId: 'property-1' });
    mocks.update.mockResolvedValue({});
    mocks.reconcile.mockRejectedValue(new Error('typesense unavailable'));

    await expect(processPropertyRecord(
      { ListingKey: 'mls-1', MlgCanView: false } as never,
      config,
    )).rejects.toBeInstanceOf(SearchIndexReconciliationError);
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.logError).toHaveBeenCalledWith(
      '[mls] Typesense reconciliation after removal failed',
      expect.objectContaining({ listingKey: 'mls-1', err: expect.any(Error) }),
    );
  });

  it('aborts withdrawal before the database mutation when pre-delete fails', async () => {
    mocks.findUnique.mockResolvedValue({ propertyId: 'property-1' });
    mocks.deleteDocument.mockRejectedValue(new Error('typesense unavailable'));

    await expect(processPropertyRecord(
      { ListingKey: 'mls-1', MlgCanView: false } as never,
      config,
    )).rejects.toBeInstanceOf(SearchIndexReconciliationError);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it('withdraws normally in PostgreSQL-only deployments', async () => {
    mocks.isTypesenseConfigured.mockReturnValue(false);
    mocks.findUnique.mockResolvedValue({ propertyId: 'property-1' });
    mocks.update.mockResolvedValue({});

    await expect(processPropertyRecord(
      { ListingKey: 'mls-1', MlgCanView: false } as never,
      config,
    )).resolves.toEqual({ outcome: 'removed', listingKey: 'mls-1' });
    expect(mocks.deleteDocument).not.toHaveBeenCalled();
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
});
