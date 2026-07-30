import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  contact: { findMany: vi.fn(), count: vi.fn() },
  transaction: { findMany: vi.fn(), count: vi.fn() },
  task: { findMany: vi.fn(), count: vi.fn() },
  property: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock('db', () => ({
  prisma: mockPrisma,
  ListingStatus: { ACTIVE: 'ACTIVE', COMING_SOON: 'COMING_SOON', SOLD: 'SOLD' },
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

const {
  isTypesenseConfigured,
  searchContactsPg,
  searchTransactionsPg,
  searchTasksPg,
  searchPropertiesPg,
} = await import('search/postgresFallback');
const originalMlsDisplay = process.env.MLS_PUBLIC_DISPLAY_ENABLED;

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.contact.findMany.mockResolvedValue([]);
  mockPrisma.contact.count.mockResolvedValue(0);
  mockPrisma.transaction.findMany.mockResolvedValue([]);
  mockPrisma.transaction.count.mockResolvedValue(0);
  mockPrisma.task.findMany.mockResolvedValue([]);
  mockPrisma.task.count.mockResolvedValue(0);
  mockPrisma.property.findMany.mockResolvedValue([]);
  mockPrisma.property.count.mockResolvedValue(0);
  delete process.env.TYPESENSE_HOST;
  delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
});

afterAll(() => {
  if (originalMlsDisplay === undefined) delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
  else process.env.MLS_PUBLIC_DISPLAY_ENABLED = originalMlsDisplay;
});

describe('isTypesenseConfigured', () => {
  it('is false when TYPESENSE_HOST is unset', () => {
    expect(isTypesenseConfigured()).toBe(false);
  });

  it('is true when TYPESENSE_HOST is set', () => {
    process.env.TYPESENSE_HOST = 'localhost';
    expect(isTypesenseConfigured()).toBe(true);
  });
});

describe('searchContactsPg', () => {
  it('scopes by accountId with no text filter when q is empty', async () => {
    await searchContactsPg({ accountId: 'acct1', limit: 8 });
    expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: 'acct1' } })
    );
  });

  it('ORs across firstName/lastName/email/phone/company when q is given', async () => {
    await searchContactsPg({ accountId: 'acct1', q: 'jane', limit: 8 });
    const { where } = mockPrisma.contact.findMany.mock.calls[0][0];
    expect(where.accountId).toBe('acct1');
    expect(where.OR).toEqual([
      { firstName: { contains: 'jane', mode: 'insensitive' } },
      { lastName: { contains: 'jane', mode: 'insensitive' } },
      { email: { contains: 'jane', mode: 'insensitive' } },
      { phone: { contains: 'jane', mode: 'insensitive' } },
      { company: { contains: 'jane', mode: 'insensitive' } },
    ]);
  });

  it('maps rows through toContactDoc and returns total', async () => {
    mockPrisma.contact.findMany.mockResolvedValue([
      { id: 'c1', firstName: 'Jane', lastName: 'Doe', email: null, phone: null, company: null, type: 'LEAD', stage: 'NEW', tags: null, accountId: 'acct1', createdAt: new Date('2026-01-01') },
    ]);
    mockPrisma.contact.count.mockResolvedValue(1);

    const result = await searchContactsPg({ accountId: 'acct1', q: 'jane' });
    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({ id: 'c1', fullName: 'Jane Doe' }),
    ]);
  });
});

describe('searchTransactionsPg', () => {
  it('scopes by accountId and ORs address/mlsId/party names', async () => {
    await searchTransactionsPg({ accountId: 'acct1', q: 'maple', limit: 8 });
    const { where } = mockPrisma.transaction.findMany.mock.calls[0][0];
    expect(where.accountId).toBe('acct1');
    expect(where.OR).toEqual([
      { address: { contains: 'maple', mode: 'insensitive' } },
      { mlsId: { contains: 'maple', mode: 'insensitive' } },
      {
        parties: {
          some: {
            contact: {
              OR: [
                { firstName: { contains: 'maple', mode: 'insensitive' } },
                { lastName: { contains: 'maple', mode: 'insensitive' } },
              ],
            },
          },
        },
      },
    ]);
  });
});

describe('searchTasksPg', () => {
  it('scopes by assignedToId and ORs title/description', async () => {
    await searchTasksPg({ assignedToId: 'user1', q: 'inspection', limit: 8 });
    const { where } = mockPrisma.task.findMany.mock.calls[0][0];
    expect(where.assignedToId).toBe('user1');
    expect(where.OR).toEqual([
      { title: { contains: 'inspection', mode: 'insensitive' } },
      { description: { contains: 'inspection', mode: 'insensitive' } },
    ]);
  });
});

describe('searchPropertiesPg', () => {
  it('always applies the public listing baseline when no price/status params are given', async () => {
    await searchPropertiesPg({ q: 'charlotte' });
    const { where } = mockPrisma.property.findMany.mock.calls[0][0];
    expect(where.listings.some).toEqual({ status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } });
  });

  it('scopes matching by price via listings.some, independent of the display listing', async () => {
    await searchPropertiesPg({ minPrice: 400000, maxPrice: 800000 });
    const { where, include } = mockPrisma.property.findMany.mock.calls[0][0];
    expect(where.listings.some).toEqual({
      AND: [
        { status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } },
        { listPrice: { gte: 400000, lte: 800000 } },
      ],
    });
    expect(include.listings.where).toEqual({ status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } });
  });

  it('cannot match a hidden listing by status and fails closed for non-public status', async () => {
    await searchPropertiesPg({ status: 'SOLD' });
    expect(mockPrisma.property.findMany.mock.calls[0][0].where.listings.some).toEqual({
      AND: [
        { status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } },
        { status: 'SOLD' },
      ],
    });
  });

  it('preserves MLS listings only when explicitly enabled', async () => {
    process.env.MLS_PUBLIC_DISPLAY_ENABLED = 'true';
    await searchPropertiesPg({});
    const { where, include } = mockPrisma.property.findMany.mock.calls[0][0];
    expect(where.listings.some).toEqual({ status: 'ACTIVE', idxDisplayable: true });
    expect(include.listings.where).toEqual({ status: 'ACTIVE', idxDisplayable: true });
  });

  it('supports authenticated non-public search without the MLS source exclusion', async () => {
    await searchPropertiesPg({ publicOnly: false });
    const { where, include } = mockPrisma.property.findMany.mock.calls[0][0];
    expect(where.listings.some).toEqual({ status: 'ACTIVE', idxDisplayable: true });
    expect(include.listings.where).toEqual({ status: 'ACTIVE', idxDisplayable: true });
  });

  it('truncates fractional bedrooms rather than throwing', async () => {
    await searchPropertiesPg({ bedrooms: 2.5 });
    const { where } = mockPrisma.property.findMany.mock.calls[0][0];
    expect(where.bedrooms).toEqual({ gte: 2 });
  });

  it('fans cities out to an OR of case-insensitive equals, not `in` + mode', async () => {
    // Regression: `{ in: [...], mode: 'insensitive' }` silently returns zero
    // rows under this repo's driver-adapter setup (see buildPortalPropertyWhere).
    await searchPropertiesPg({ cities: ['Charlotte', 'Waxhaw'] });
    const { where } = mockPrisma.property.findMany.mock.calls[0][0];
    expect(where.OR).toEqual([
      {
        OR: [
          { city: { equals: 'Charlotte', mode: 'insensitive' } },
          { city: { equals: 'Waxhaw', mode: 'insensitive' } },
        ],
      },
    ]);
  });

  it('ignores an unrecognized propertyType instead of throwing', async () => {
    await searchPropertiesPg({ propertyType: 'NOT_A_REAL_TYPE' });
    const { where } = mockPrisma.property.findMany.mock.calls[0][0];
    expect(where.propertyType).toBeUndefined();
  });

  it('falls back to createdAt sort for relation-backed sort fields', async () => {
    await searchPropertiesPg({ sortBy: 'price', sortOrder: 'asc' });
    const { orderBy } = mockPrisma.property.findMany.mock.calls[0][0];
    expect(orderBy).toEqual({ createdAt: 'asc' });
  });

  it('maps rows through toPropertyDoc using the included representative listing', async () => {
    mockPrisma.property.findMany.mockResolvedValue([
      {
        id: 'p1',
        address: '123 Main St',
        city: 'Charlotte',
        state: 'NC',
        zipCode: '28277',
        propertyType: 'SINGLE_FAMILY',
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1800,
        subdivision: null,
        latitude: null,
        longitude: null,
        createdAt: new Date('2026-01-01'),
        listings: [{ mlsId: 'M1', mlsBoardId: null, slug: 's1', imageUrl: null, listDate: new Date('2026-01-02'), status: 'ACTIVE', listPrice: { toString: () => '450000' } }],
      },
    ]);
    mockPrisma.property.count.mockResolvedValue(1);

    const result = await searchPropertiesPg({ q: 'main' });
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(expect.objectContaining({ id: 'p1', price: 450000 }));
  });
});
