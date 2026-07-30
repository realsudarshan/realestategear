import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  reconcile: vi.fn(),
  deleteDocument: vi.fn(),
  isTypesenseConfigured: vi.fn(() => true),
  logError: vi.fn(),
}));

vi.mock('db', () => ({
  prisma: {
    listing: {
      create: mocks.create,
      findUnique: mocks.findUnique,
      update: mocks.update,
      delete: mocks.remove,
    },
  },
}));
vi.mock('../../../search/index.js', () => ({
  deleteDocument: mocks.deleteDocument,
  isTypesenseConfigured: mocks.isTypesenseConfigured,
  reconcilePropertyDocument: mocks.reconcile,
}));
vi.mock('../../../utils/logger.js', () => ({
  default: { error: mocks.logError, warn: vi.fn() },
}));

import { createListing, deleteListing, updateListing } from '../../../services/listingService.js';

describe('listingService Typesense reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTypesenseConfigured.mockReturnValue(true);
    mocks.deleteDocument.mockResolvedValue(undefined);
  });

  it('awaits and logs an index failure without rejecting a committed create', async () => {
    const listing = { id: 'listing-1', propertyId: 'property-1' };
    mocks.create.mockResolvedValue(listing);
    mocks.reconcile.mockRejectedValue(new Error('typesense unavailable'));

    await expect(createListing({ propertyId: 'property-1' } as never)).resolves.toBe(listing);
    expect(mocks.reconcile).toHaveBeenCalledWith('property-1');
    expect(mocks.logError).toHaveBeenCalledWith(
      'refreshPropertyDoc failed for property-1:',
      expect.any(Error),
    );
  });

  it('reconciles both parents when an update moves a listing', async () => {
    mocks.findUnique.mockResolvedValue({ propertyId: 'old-property' });
    mocks.update.mockResolvedValue({ id: 'listing-1', propertyId: 'new-property' });
    await updateListing({ id: 'listing-1' }, { propertyId: 'new-property' });
    expect(mocks.deleteDocument).toHaveBeenCalledWith('properties', 'old-property');
    expect(mocks.deleteDocument.mock.invocationCallOrder[0]).toBeLessThan(mocks.update.mock.invocationCallOrder[0]);
    expect(mocks.reconcile).toHaveBeenCalledWith('old-property');
    expect(mocks.reconcile).toHaveBeenCalledWith('new-property');
  });

  it('reconciles the surviving representative after delete', async () => {
    mocks.findUnique.mockResolvedValue({ propertyId: 'property-1' });
    mocks.remove.mockResolvedValue({ id: 'listing-1', propertyId: 'property-1' });
    await deleteListing({ id: 'listing-1' });
    expect(mocks.deleteDocument).toHaveBeenCalledWith('properties', 'property-1');
    expect(mocks.deleteDocument.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]);
    expect(mocks.reconcile).toHaveBeenCalledWith('property-1');
  });

  it('aborts an update before the database mutation when stale-document deletion fails', async () => {
    mocks.findUnique.mockResolvedValue({ propertyId: 'property-1' });
    mocks.deleteDocument.mockRejectedValue(new Error('typesense unavailable'));

    await expect(updateListing({ id: 'listing-1' }, { status: 'WITHDRAWN' })).rejects.toThrow('typesense unavailable');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it('keeps PostgreSQL-only listing mutations writable when Typesense is absent', async () => {
    mocks.isTypesenseConfigured.mockReturnValue(false);
    mocks.findUnique.mockResolvedValue({ propertyId: 'property-1' });
    mocks.update.mockResolvedValue({ id: 'listing-1', propertyId: 'property-1' });

    await expect(updateListing({ id: 'listing-1' }, { status: 'WITHDRAWN' })).resolves.toEqual({
      id: 'listing-1',
      propertyId: 'property-1',
    });
    expect(mocks.deleteDocument).not.toHaveBeenCalled();
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
});
