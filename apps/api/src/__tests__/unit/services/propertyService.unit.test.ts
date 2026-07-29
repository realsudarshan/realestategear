import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  property: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
}));

const mockSearchProperties = vi.hoisted(() => vi.fn());

const propertyServicePath = new URL('../../../services/propertyService.js', import.meta.url).href;

vi.mock('db', () => ({
  prisma: mockPrisma,
  ListingStatus: {
    ACTIVE: 'ACTIVE',
    PENDING: 'PENDING',
    CLOSED: 'CLOSED',
  },
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
  upsertDocument: vi.fn(),
  deleteDocument: vi.fn(),
  toPropertyDoc: vi.fn((p) => p),
}));

const { getProperties, getPropertyById } = await import(propertyServicePath);

describe('propertyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      mockPrisma.property.findUnique.mockResolvedValue({
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
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 'c'.padEnd(25, '0'),
        media: [],
        listings: [{ id: 'l1', mlsId: '999', mlsBoardId: 'SomeUnregisteredMLS', status: 'ACTIVE' }],
      });

      const property = await getPropertyById('c'.padEnd(25, '0'));
      expect(property.mlsBoardName).toBeNull();
    });

    it('returns null mlsBoardName/lastMlsUpdate for a MANUAL listing with no MLS board', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 'c'.padEnd(25, '0'),
        media: [],
        listings: [{ id: 'l1', mlsId: null, mlsBoardId: null, status: 'ACTIVE' }],
      });

      const property = await getPropertyById('c'.padEnd(25, '0'));
      expect(property.mlsBoardName).toBeNull();
      expect(property.lastMlsUpdate).toBeNull();
    });
  });
});
