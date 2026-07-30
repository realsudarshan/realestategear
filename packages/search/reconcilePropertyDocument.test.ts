import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  remove: vi.fn(),
  toDoc: vi.fn((property, listing) => ({ id: property.id, listingId: listing.id })),
}));

vi.mock('db', () => ({
  prisma: { property: { findUnique: mocks.findUnique } },
  ListingStatus: { ACTIVE: 'ACTIVE' },
  ListingSource: { MLS: 'MLS' },
}));
vi.mock('./syncService.js', () => ({
  upsertDocument: mocks.upsert,
  deleteDocument: mocks.remove,
}));
vi.mock('./transformers.js', () => ({ toPropertyDoc: mocks.toDoc }));

import { reconcilePropertyDocument } from './reconcilePropertyDocument.js';

describe('reconcilePropertyDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('selects the newest eligible representative and upserts it', async () => {
    const manual = { id: 'manual', source: 'MANUAL' };
    mocks.findUnique.mockResolvedValue({ id: 'property-1', listings: [manual] });

    await expect(reconcilePropertyDocument('property-1', {})).resolves.toBe('upserted');

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: 'property-1' },
      include: {
        listings: {
          where: { status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } },
          orderBy: [{ listDate: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
    });
    expect(mocks.toDoc).toHaveBeenCalledWith(expect.objectContaining({ id: 'property-1' }), manual);
    expect(mocks.upsert).toHaveBeenCalledWith('properties', { id: 'property-1', listingId: 'manual' });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it.each([
    ['missing property', null],
    ['no eligible listing', { id: 'property-1', listings: [] }],
  ])('deletes for %s', async (_case, property) => {
    mocks.findUnique.mockResolvedValue(property);
    await expect(reconcilePropertyDocument('property-1')).resolves.toBe('deleted');
    expect(mocks.remove).toHaveBeenCalledWith('properties', 'property-1');
  });

  it('propagates upsert and delete failures', async () => {
    const failure = new Error('typesense unavailable');
    mocks.findUnique
      .mockResolvedValueOnce({ id: 'property-1', listings: [{ id: 'listing-1' }] })
      .mockResolvedValueOnce(null);
    mocks.upsert.mockRejectedValueOnce(failure);
    mocks.remove.mockRejectedValueOnce(failure);

    await expect(reconcilePropertyDocument('property-1')).rejects.toThrow('typesense unavailable');
    await expect(reconcilePropertyDocument('property-1')).rejects.toThrow('typesense unavailable');
  });
});
