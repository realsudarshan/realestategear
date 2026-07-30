import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const listing = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock('db', () => ({
  prisma: { listing },
  ListingStatus: { ACTIVE: 'ACTIVE', SOLD: 'SOLD' },
  ListingSource: { MLS: 'MLS', MANUAL: 'MANUAL', ZILLOW: 'ZILLOW', REALTOR_COM: 'REALTOR_COM' },
}));
vi.mock('../../../utils/logger.js', () => ({ default: { error: vi.fn() } }));

const { searchByBounds } = await import('../../../services/searchService.js');
const originalMlsDisplay = process.env.MLS_PUBLIC_DISPLAY_ENABLED;
const bounds = { north: 36, south: 35, east: -80, west: -81 };

describe('searchByBounds public visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
    listing.findMany.mockResolvedValue([]);
  });

  afterAll(() => {
    if (originalMlsDisplay === undefined) delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
    else process.env.MLS_PUBLIC_DISPLAY_ENABLED = originalMlsDisplay;
  });

  it('gates the matched listing and omits shared property media while disabled', async () => {
    await searchByBounds(bounds, { filters: { minPrice: 300000 } });

    const query = listing.findMany.mock.calls[0][0];
    expect(query.where).toEqual({
      AND: [
        { status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } },
        expect.objectContaining({ listPrice: { gte: 300000 } }),
      ],
    });
    expect(query.select).toBeDefined();
    expect(query.select.rawData).toBeUndefined();
    expect(query.select.listingKey).toBeUndefined();
    expect(query.select.listingAgentEmail).toBeUndefined();
    expect(query.select.listingAgentPhone).toBeUndefined();
    expect(query.select.property.select.media).toBeUndefined();
  });

  it('fails closed when a non-public status is requested', async () => {
    await searchByBounds(bounds, { filters: { status: 'SOLD' } });

    expect(listing.findMany.mock.calls[0][0].where.AND).toEqual([
      { status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } },
      expect.objectContaining({ status: 'SOLD' }),
    ]);
  });

  it('allows MLS and shared property media only when explicitly enabled', async () => {
    process.env.MLS_PUBLIC_DISPLAY_ENABLED = 'true';
    await searchByBounds(bounds);

    const query = listing.findMany.mock.calls[0][0];
    expect(query.where.AND[0]).toEqual({ status: 'ACTIVE', idxDisplayable: true });
    expect(query.select.property.select.media).toEqual({
      select: { id: true, url: true, caption: true, order: true },
      orderBy: { order: 'asc' },
    });
  });

  it('returns only the explicitly selected public response shape', async () => {
    listing.findMany.mockResolvedValue([{ id: 'listing-1', property: { id: 'property-1' } }]);
    const result = await searchByBounds(bounds);
    expect(result.properties).toEqual([{ id: 'listing-1', property: { id: 'property-1' } }]);
    expect(listing.findMany.mock.calls[0][0]).toHaveProperty('select');
    expect(listing.findMany.mock.calls[0][0]).not.toHaveProperty('include');
  });
});
