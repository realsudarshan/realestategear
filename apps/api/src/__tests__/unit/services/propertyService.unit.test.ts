import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  property: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
  listing: { findFirst: vi.fn() },
}));

const mockSearchProperties = vi.hoisted(() => vi.fn());
const mockSearchIndex = vi.hoisted(() => ({
  deleteDocument: vi.fn(),
  isTypesenseConfigured: vi.fn(() => false),
  reconcilePropertyDocument: vi.fn(),
}));

const propertyServicePath = new URL('../../../services/propertyService.js', import.meta.url).href;

vi.mock('db', () => ({
  prisma: mockPrisma,
  ListingStatus: {
    ACTIVE: 'ACTIVE',
    PENDING: 'PENDING',
    SOLD: 'SOLD',
    CLOSED: 'CLOSED',
  },
  ListingSource: { MLS: 'MLS', MANUAL: 'MANUAL', ZILLOW: 'ZILLOW', REALTOR_COM: 'REALTOR_COM' },
  PropertyType: {
    SINGLE_FAMILY: 'SINGLE_FAMILY',
    CONDO: 'CONDO',
    TOWNHOUSE: 'TOWNHOUSE',
    MULTI_FAMILY: 'MULTI_FAMILY',
    LAND: 'LAND',
    COMMERCIAL: 'COMMERCIAL',
  },
}));

vi.mock('../../../services/searchService.js', () => ({
  searchProperties: mockSearchProperties,
}));

vi.mock('../../../search/index.js', () => ({
  ...mockSearchIndex,
  upsertDocument: vi.fn(),
  toPropertyDoc: vi.fn((p) => p),
}));

const { deleteProperty, getProperties, getPropertyById, getPropertyBySlug, getPropertyMedia } = await import(propertyServicePath);
const originalMlsDisplay = process.env.MLS_PUBLIC_DISPLAY_ENABLED;

describe('propertyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchIndex.isTypesenseConfigured.mockReturnValue(false);
    delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
  });

  afterAll(() => {
    if (originalMlsDisplay === undefined) delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
    else process.env.MLS_PUBLIC_DISPLAY_ENABLED = originalMlsDisplay;
  });

  it('gates both parent matching and representative listings while MLS display is disabled', async () => {
    mockPrisma.property.findMany.mockResolvedValue([]);
    mockPrisma.property.count.mockResolvedValue(0);

    await getProperties();

    const query = mockPrisma.property.findMany.mock.calls[0][0];
    const baseline = { status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } };
    expect(query.where.listings.some).toEqual(baseline);
    expect(query.include.listings.where).toEqual(baseline);
  });

  it('allows MLS listings only when the display flag is exactly true', async () => {
    process.env.MLS_PUBLIC_DISPLAY_ENABLED = 'true';
    mockPrisma.property.findMany.mockResolvedValue([]);
    mockPrisma.property.count.mockResolvedValue(0);

    await getProperties();

    const query = mockPrisma.property.findMany.mock.calls[0][0];
    expect(query.where.listings.some).toEqual({ status: 'ACTIVE', idxDisplayable: true });
    expect(query.include.listings.where).toEqual({ status: 'ACTIVE', idxDisplayable: true });
  });

  it('keeps ACTIVE and idxDisplayable but does not exclude MLS in explicit non-public mode', async () => {
    mockPrisma.property.findMany.mockResolvedValue([]);
    mockPrisma.property.count.mockResolvedValue(0);

    await getProperties({}, { publicOnly: false });

    const query = mockPrisma.property.findMany.mock.calls[0][0];
    expect(query.where.listings.some).toEqual({ status: 'ACTIVE', idxDisplayable: true });
    expect(query.include.listings.where).toEqual({ status: 'ACTIVE', idxDisplayable: true });
  });

  it('fails closed when a caller requests a non-public status', async () => {
    mockPrisma.property.findMany.mockResolvedValue([]);
    mockPrisma.property.count.mockResolvedValue(0);

    await getProperties({ status: 'SOLD' });

    expect(mockPrisma.property.findMany.mock.calls[0][0].where.listings.some).toEqual({
      AND: [
        { status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } },
        { status: 'SOLD' },
      ],
    });
  });

  it('applies square footage and year built filters to direct property queries', async () => {
    mockPrisma.property.findMany.mockResolvedValue([]);
    mockPrisma.property.count.mockResolvedValue(0);

    await getProperties({
      minSqFt: '1500',
      maxSqFt: '2500',
      minYearBuilt: '2005',
    });

    expect(mockPrisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          squareFeet: { gte: 1500, lte: 2500 },
          yearBuilt: { gte: 2005 },
        }),
      })
    );
    expect(mockPrisma.property.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          squareFeet: { gte: 1500, lte: 2500 },
          yearBuilt: { gte: 2005 },
        }),
      })
    );
  });

  describe('toPublicProperty MLS attribution fields', () => {
    const lastMlsUpdate = new Date('2026-06-01T00:00:00.000Z');

    it('resolves the board display name and last-updated timestamp for a registered board', async () => {
      mockPrisma.property.findFirst.mockResolvedValue({
        id: 'c'.padEnd(25, '0'),
        media: [],
        listings: [
          {
            id: 'l1',
            mlsId: '123',
            mlsBoardId: 'CanopyMLS',
            status: 'ACTIVE',
            updatedAt: lastMlsUpdate,
          },
        ],
      });

      const property = await getPropertyById('c'.padEnd(25, '0'));
      expect(property.mlsBoardName).toBe('Canopy MLS');
      expect(property.lastMlsUpdate).toEqual(lastMlsUpdate);
    });

    it('returns null for a board with no registered policy instead of throwing', async () => {
      mockPrisma.property.findFirst.mockResolvedValue({
        id: 'c'.padEnd(25, '0'),
        media: [],
        listings: [{ id: 'l1', mlsId: '999', mlsBoardId: 'SomeUnregisteredMLS', status: 'ACTIVE' }],
      });

      const property = await getPropertyById('c'.padEnd(25, '0'));
      expect(property.mlsBoardName).toBeNull();
    });

    it('returns null mlsBoardName/lastMlsUpdate for a MANUAL listing with no MLS board', async () => {
      mockPrisma.property.findFirst.mockResolvedValue({
        id: 'c'.padEnd(25, '0'),
        media: [],
        listings: [{ id: 'l1', mlsId: null, mlsBoardId: null, status: 'ACTIVE' }],
      });

      const property = await getPropertyById('c'.padEnd(25, '0'));
      expect(property.mlsBoardName).toBeNull();
      expect(property.lastMlsUpdate).toBeNull();
    });
  });

  it('returns no ID or slug detail when the eligible listing query finds nothing', async () => {
    mockPrisma.property.findFirst.mockResolvedValue(null);
    mockPrisma.listing.findFirst.mockResolvedValue(null);

    await expect(getPropertyById('c'.padEnd(25, '0'))).resolves.toBeNull();
    await expect(getPropertyBySlug('hidden-mls')).resolves.toBeNull();
    expect(mockPrisma.property.findFirst.mock.calls[0][0].where.listings.some).toEqual({
      status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' },
    });
    expect(mockPrisma.listing.findFirst.mock.calls[0][0].where).toEqual({
      AND: [
        { status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } },
        { slug: 'hidden-mls' },
      ],
    });
  });

  it('suppresses shared Property.media for mixed/manual properties while MLS display is disabled', async () => {
    mockPrisma.property.findFirst.mockResolvedValue({
      id: 'mixed-property',
      media: [{ id: 'media-1', url: 'https://example.com/shared.jpg' }],
      listings: [{ id: 'manual-1', source: 'MANUAL', status: 'ACTIVE', imageUrl: 'https://example.com/listing.jpg' }],
    });

    const result = await getPropertyById('mixed-property');

    expect(result.media).toEqual([]);
    expect(result.imageUrl).toBe('https://example.com/listing.jpg');
    await expect(getPropertyMedia('mixed-property')).resolves.toEqual([]);
  });

  it('returns shared media for eligible properties when MLS display is enabled', async () => {
    process.env.MLS_PUBLIC_DISPLAY_ENABLED = 'true';
    mockPrisma.property.findFirst
      .mockResolvedValueOnce({
        id: 'property-1',
        media: [{ id: 'media-1', url: 'https://example.com/shared.jpg' }],
        listings: [{ id: 'mls-1', source: 'MLS', status: 'ACTIVE', imageUrl: null }],
      })
      .mockResolvedValueOnce({ media: [{ id: 'media-1', url: 'https://example.com/shared.jpg' }] });

    const result = await getPropertyById('property-1');

    expect(result.media).toHaveLength(1);
    expect(result.imageUrl).toBe('https://example.com/shared.jpg');
    await expect(getPropertyMedia('property-1')).resolves.toHaveLength(1);
  });

  it('aborts property deletion before the database mutation when index deletion fails', async () => {
    mockSearchIndex.isTypesenseConfigured.mockReturnValue(true);
    mockSearchIndex.deleteDocument.mockRejectedValue(new Error('typesense unavailable'));

    await expect(deleteProperty('property-1')).rejects.toThrow('typesense unavailable');
    expect(mockPrisma.property.delete).not.toHaveBeenCalled();
  });
});
