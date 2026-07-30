import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  property: { groupBy: vi.fn(), findMany: vi.fn() },
  contact: { findMany: vi.fn() },
  transaction: { findMany: vi.fn() },
  note: { findMany: vi.fn() },
  task: { findMany: vi.fn() },
}));
const search = vi.hoisted(() => ({
  searchDocuments: vi.fn(),
  searchPropertiesPg: vi.fn(),
  reindexAll: vi.fn(),
  reconcilePropertyDocument: vi.fn(),
  isTypesenseConfigured: vi.fn(() => false),
}));
const property = db.property;

vi.mock('db', () => ({
  prisma: db,
  ListingStatus: { ACTIVE: 'ACTIVE', PENDING: 'PENDING', SOLD: 'SOLD' },
  PropertyType: { SINGLE_FAMILY: 'SINGLE_FAMILY', CONDO: 'CONDO' },
  ListingSource: { MLS: 'MLS', MANUAL: 'MANUAL', ZILLOW: 'ZILLOW', REALTOR_COM: 'REALTOR_COM' },
}));
vi.mock('../../../middleware/cache.js', () => ({ cacheSearch: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('../../../middleware/auth.js', () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../../services/searchService.js', () => ({ searchByBounds: vi.fn() }));
vi.mock('../../../search/index.js', () => ({
  generateWebSearchKey: vi.fn(), generateAgentSearchKey: vi.fn(), reindexAll: search.reindexAll,
  reconcilePropertyDocument: search.reconcilePropertyDocument,
  toPropertyDoc: vi.fn(), toContactDoc: vi.fn(), toTransactionDoc: vi.fn(), toNoteDoc: vi.fn(), toTaskDoc: vi.fn(),
  searchDocuments: search.searchDocuments, isTypesenseConfigured: search.isTypesenseConfigured,
  searchPropertiesPg: search.searchPropertiesPg,
}));
vi.mock('../../../utils/logger.js', () => ({ default: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

const { default: express } = await import('express');
const { default: request } = await import('supertest');
const { default: router } = await import('../../../routes/search.js');
const originalMlsDisplay = process.env.MLS_PUBLIC_DISPLAY_ENABLED;

function buildApp() {
  const app = express();
  app.use('/', router);
  return app;
}

describe('search suggestions PostgreSQL visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
    property.groupBy.mockResolvedValue([]);
    property.findMany.mockResolvedValue([]);
  });

  afterAll(() => {
    if (originalMlsDisplay === undefined) delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
    else process.env.MLS_PUBLIC_DISPLAY_ENABLED = originalMlsDisplay;
  });

  it('gates city, address parent, nested representative, and property-type queries', async () => {
    const response = await request(buildApp()).get('/suggestions').query({ q: 'ma', types: 'all' });

    expect(response.status).toBe(200);
    const baseline = { status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } };
    expect(property.groupBy.mock.calls[0][0].where.listings.some).toEqual(baseline);
    expect(property.findMany.mock.calls[0][0].where.listings.some).toEqual(baseline);
    expect(property.findMany.mock.calls[0][0].select.listings.where).toEqual(baseline);
    expect(property.groupBy.mock.calls[1][0].where.listings.some).toEqual(baseline);
  });

  it('removes only the MLS source exclusion when explicitly enabled', async () => {
    process.env.MLS_PUBLIC_DISPLAY_ENABLED = 'true';
    await request(buildApp()).get('/suggestions').query({ q: 'ma', types: 'all' });

    const baseline = { status: 'ACTIVE', idxDisplayable: true };
    expect(property.groupBy.mock.calls[0][0].where.listings.some).toEqual(baseline);
    expect(property.findMany.mock.calls[0][0].select.listings.where).toEqual(baseline);
  });
});

describe('public Typesense search visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
    search.isTypesenseConfigured.mockReturnValue(true);
    search.searchDocuments.mockResolvedValue({ hits: [], found: 0 });
  });

  it('ANDs the public baseline with caller filters so status cannot replace ACTIVE', async () => {
    const response = await request(buildApp()).get('/').query({ city: 'Charlotte', status: 'Pending' });

    expect(response.status).toBe(200);
    expect(search.searchDocuments).toHaveBeenCalledWith('properties', expect.objectContaining({
      filterBy: '(status:=Active && idxDisplayable:=true && source:!=MLS) && (city:=Charlotte && status:=Pending)',
    }));
  });

  it.each([
    ['city', 'Charlotte) || source:=MLS'],
    ['state', 'NC || status:=Sold'],
    ['status', 'Active || source:=MLS'],
    ['propertyType', 'CONDO) && (source:=MLS'],
  ])('rejects Typesense operator injection in %s before search', async (field, value) => {
    const response = await request(buildApp()).get('/').query({ [field]: value });
    expect(response.status).toBe(400);
    expect(search.searchDocuments).not.toHaveBeenCalled();
    expect(search.searchPropertiesPg).not.toHaveBeenCalled();
  });

  it('accepts common Unicode place punctuation without weakening filter syntax', async () => {
    const response = await request(buildApp()).get('/').query({ city: "St. John's, Côte-d'Or" });
    expect(response.status).toBe(200);
    expect(search.searchDocuments).toHaveBeenCalled();
  });
});

describe('search reindex route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.property.findMany.mockResolvedValue([]);
    search.reindexAll.mockResolvedValue({ desiredCount: 2, upsertedCount: 2, deletedCount: 1 });
  });

  it('returns exact counts and uses the eligible parent and representative filters', async () => {
    const response = await request(buildApp()).post('/reindex/properties');

    expect(response.status).toBe(200);
    expect(response.body.counts.properties).toEqual({ desiredCount: 2, upsertedCount: 2, deletedCount: 1 });
    const fetchDocs = search.reindexAll.mock.calls[0][1];
    const options = search.reindexAll.mock.calls[0][2];
    await fetchDocs();
    const baseline = { status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } };
    expect(db.property.findMany).toHaveBeenCalledWith({
      where: { listings: { some: baseline } },
      include: { listings: { where: baseline, orderBy: [{ listDate: 'desc' }, { createdAt: 'desc' }], take: 1 } },
    });
    expect(options).toEqual({ exact: true, reconcile: expect.any(Function) });
    await options.reconcile('property-1');
    expect(search.reconcilePropertyDocument).toHaveBeenCalledWith('property-1');
  });

  it('rejects an unknown collection without reindexing', async () => {
    const response = await request(buildApp()).post('/reindex/unknown');
    expect(response.status).toBe(400);
    expect(search.reindexAll).not.toHaveBeenCalled();
  });
});
