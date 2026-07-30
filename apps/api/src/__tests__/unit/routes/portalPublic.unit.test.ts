import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  portal: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  geographicArea: { findFirst: vi.fn() },
  listingCollection: { findFirst: vi.fn() },
  property: { findMany: vi.fn() },
}));

const mockCreateInquiry = vi.hoisted(() => vi.fn());
const mockSearchDocuments = vi.hoisted(() => vi.fn().mockResolvedValue({ found: 0, facet_counts: [] }));
const mockGetPortalListings = vi.hoisted(() => vi.fn().mockResolvedValue({ properties: [], pagination: {}, readiness: {} }));
const mockGetPortalProperty = vi.hoisted(() => vi.fn());
const mockGetPortalReadiness = vi.hoisted(() => vi.fn());

vi.mock('db', () => ({ prisma: mockPrisma, ListingStatus: { ACTIVE: 'ACTIVE' }, ListingSource: { MLS: 'MLS', MANUAL: 'MANUAL', ZILLOW: 'ZILLOW', REALTOR_COM: 'REALTOR_COM' } }));
vi.mock('../../../search/index.js', () => ({ searchDocuments: mockSearchDocuments }));
vi.mock('../../../services/portalReadinessService.js', () => ({
  getPortalListings: mockGetPortalListings,
  getPortalProperty: mockGetPortalProperty,
  getPortalReadiness: mockGetPortalReadiness,
}));
vi.mock('express-rate-limit', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../../services/agentPortalsService.js', () => ({
  validateSlug: (slug: string) => {
    if (!slug) return 'Slug is required';
    if (['www', 'api', 'app', 'admin', 'mail', 'portal'].includes(slug)) return 'Slug is reserved';
    if (!/^[a-z0-9-]+$/.test(slug)) return 'Slug must be lowercase';
    return null;
  },
}));
vi.mock('../../../services/inquiryService.js', () => ({
  createInquiry: mockCreateInquiry,
  InquiryInputError: class InquiryInputError extends Error {
    constructor(message: string, public statusCode = 400) { super(message); }
  },
}));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { default: express } = await import('express');
const { default: router } = await import('../../../routes/portalPublic.js');
const { default: request } = await import('supertest');
const originalMlsDisplay = process.env.MLS_PUBLIC_DISPLAY_ENABLED;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/', router);
  return app;
}

const ACTIVE_PORTAL = {
  id: 'p1',
  slug: 'myrtle-beach',
  name: 'Myrtle Beach Homes',
  themePresetId: 'coastal',
  logoUrl: null,
  neighborhoodName: null,
  neighborhoodCity: 'Myrtle Beach',
  neighborhoodState: 'SC',
  agentDisplayName: 'Jane Smith',
  agentPhone: '555-1234',
  agentEmail: 'jane@example.com',
  agentHeadlineText: 'Your local expert',
  isActive: true,
};

describe('GET /slug/:slug', () => {
  beforeEach(() => { vi.clearAllMocks(); delete process.env.MLS_PUBLIC_DISPLAY_ENABLED; });
  afterAll(() => { if (originalMlsDisplay === undefined) delete process.env.MLS_PUBLIC_DISPLAY_ENABLED; else process.env.MLS_PUBLIC_DISPLAY_ENABLED = originalMlsDisplay; });

  it('returns portal data for active portal', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(ACTIVE_PORTAL);
    const res = await request(buildApp()).get('/slug/myrtle-beach');
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('myrtle-beach');
    expect(res.body.isActive).toBe(true);
  });

  it('returns 404 when portal not found', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(null);
    const res = await request(buildApp()).get('/slug/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('returns 404 when portal is inactive', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ ...ACTIVE_PORTAL, isActive: false });
    const res = await request(buildApp()).get('/slug/myrtle-beach');
    expect(res.status).toBe(404);
  });

  it('returns a minimal { suspended: true } payload for a suspended portal, not 404', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({
      ...ACTIVE_PORTAL,
      suspendedAt: new Date('2026-07-01'),
    });
    const res = await request(buildApp()).get('/slug/myrtle-beach');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suspended: true });
  });

  it('does not leak suspendedAt on a normal active portal response', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ ...ACTIVE_PORTAL, suspendedAt: null });
    const res = await request(buildApp()).get('/slug/myrtle-beach');
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('suspendedAt');
  });

  it('gates featured listings dynamically while MLS display is disabled', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ ...ACTIVE_PORTAL, suspendedAt: null });
    await request(buildApp()).get('/slug/myrtle-beach');
    expect(mockPrisma.portal.findUnique.mock.calls[0][0].select.featuredListings.where).toEqual({
      listing: { is: { status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } } },
    });
  });

  it('allows MLS featured listings only when explicitly enabled', async () => {
    process.env.MLS_PUBLIC_DISPLAY_ENABLED = 'true';
    mockPrisma.portal.findUnique.mockResolvedValue({ ...ACTIVE_PORTAL, suspendedAt: null });
    await request(buildApp()).get('/slug/myrtle-beach');
    expect(mockPrisma.portal.findUnique.mock.calls[0][0].select.featuredListings.where).toEqual({
      listing: { is: { status: 'ACTIVE', idxDisplayable: true } },
    });
  });
});

describe('GET /slug/:slug/available', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns available true when slug is free', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(null);
    const res = await request(buildApp()).get('/slug/open-slug/available');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
  });

  it('returns available false for reserved slugs', async () => {
    const res = await request(buildApp()).get('/slug/www/available');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toMatch(/reserved/);
  });

  it('returns available false when slug is taken', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1' });
    const res = await request(buildApp()).get('/slug/taken-slug/available');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });
});

describe('GET /domain/:hostname', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns portal for active custom domain', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(ACTIVE_PORTAL);
    const res = await request(buildApp()).get('/domain/myhomes.com');
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('myrtle-beach');
  });

  it('returns 404 when domain not found', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(null);
    const res = await request(buildApp()).get('/domain/unknown.com');
    expect(res.status).toBe(404);
  });
});

describe('GET /slug/:slug/listings', () => {
  beforeEach(() => vi.clearAllMocks());

  const READINESS_PORTAL = { id: 'p1', slug: 'myrtle-beach', isActive: true, agentEmail: 'jane@example.com', brokerageName: 'X', brokeragePhone: '5', segments: [] };

  it('returns 404 when portal not found', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(null);
    const res = await request(buildApp()).get('/slug/does-not-exist/listings');
    expect(res.status).toBe(404);
    expect(mockGetPortalListings).not.toHaveBeenCalled();
  });

  it('returns 404 when portal is inactive', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ ...READINESS_PORTAL, isActive: false });
    const res = await request(buildApp()).get('/slug/myrtle-beach/listings');
    expect(res.status).toBe(404);
  });

  it('parses valid numeric filter params to numbers and passes propertyType through as-is', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(READINESS_PORTAL);

    await request(buildApp())
      .get('/slug/myrtle-beach/listings')
      .query({ minPrice: '300000', maxPrice: '750000', bedrooms: '3', bathrooms: '2', propertyType: 'CONDO' });

    expect(mockGetPortalListings).toHaveBeenCalledOnce();
    const [, query] = mockGetPortalListings.mock.calls[0];
    expect(query).toMatchObject({
      minPrice: 300000,
      maxPrice: 750000,
      bedrooms: 3,
      bathrooms: 2,
      propertyType: 'CONDO',
    });
  });

  it('parses garbage numeric params to undefined instead of NaN', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(READINESS_PORTAL);

    await request(buildApp())
      .get('/slug/myrtle-beach/listings')
      .query({ minPrice: 'abc', bedrooms: 'not-a-number' });

    const [, query] = mockGetPortalListings.mock.calls[0];
    expect(query.minPrice).toBeUndefined();
    expect(query.bedrooms).toBeUndefined();
    expect(Number.isNaN(query.minPrice)).toBe(false);
  });

  it('takes the first value of a repeated ?q= param instead of crashing on an array', async () => {
    // Express's query parser turns a repeated key (?q=a&q=b) into an array;
    // `.trim()` on that array throws if q isn't coerced to a single string first.
    mockPrisma.portal.findUnique.mockResolvedValue(READINESS_PORTAL);

    const res = await request(buildApp()).get('/slug/myrtle-beach/listings?q=first&q=second');

    expect(res.status).toBe(200);
    const [, query] = mockGetPortalListings.mock.calls[0];
    expect(query.q).toBe('first');
  });

  it('omits optional numeric filters entirely when the query params are absent', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(READINESS_PORTAL);

    await request(buildApp()).get('/slug/myrtle-beach/listings');

    const [, query] = mockGetPortalListings.mock.calls[0];
    expect(query.minPrice).toBeUndefined();
    expect(query.maxPrice).toBeUndefined();
    expect(query.bedrooms).toBeUndefined();
    expect(query.bathrooms).toBeUndefined();
    expect(query.propertyType).toBeUndefined();
  });
});

describe('GET /slug/:slug/properties/:identifier', () => {
  beforeEach(() => vi.clearAllMocks());

  const READINESS_PORTAL = {
    id: 'p1',
    slug: 'myrtle-beach',
    isActive: true,
    suspendedAt: null,
    agentEmail: 'jane@example.com',
    brokerageName: 'X',
    brokeragePhone: '5',
    segments: [],
  };

  it('returns an eligible portal property', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(READINESS_PORTAL);
    mockGetPortalProperty.mockResolvedValue({ id: 'property-1', slug: '123-main-st' });

    const res = await request(buildApp()).get('/slug/myrtle-beach/properties/123-main-st');

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('123-main-st');
    expect(mockGetPortalProperty).toHaveBeenCalledWith(READINESS_PORTAL, '123-main-st');
  });

  it.each([
    ['out-of-scope', 'outside the linked geographic scope'],
    ['inactive-or-non-idx', 'inactive or non-IDX'],
    ['missing', 'not found'],
  ])('returns 404 for %s properties (%s)', async (identifier) => {
    mockPrisma.portal.findUnique.mockResolvedValue(READINESS_PORTAL);
    mockGetPortalProperty.mockResolvedValue(null);

    const res = await request(buildApp()).get(`/slug/myrtle-beach/properties/${identifier}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Property not found' });
  });

  it('returns 404 without querying listings when the portal is suspended', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ ...READINESS_PORTAL, suspendedAt: new Date() });

    const res = await request(buildApp()).get('/slug/myrtle-beach/properties/123-main-st');

    expect(res.status).toBe(404);
    expect(mockGetPortalProperty).not.toHaveBeenCalled();
  });
});

describe.each([
  ['area', '/slug/myrtle-beach/areas/downtown'],
  ['collection', '/slug/myrtle-beach/collections/luxury'],
])('GET portal %s landing', (kind, path) => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', accountId: 'a1', slug: 'myrtle-beach', isActive: true, suspendedAt: null, collections: [] });
    mockGetPortalReadiness.mockResolvedValue({ canShowListings: true });
    mockPrisma.geographicArea.findFirst.mockResolvedValue({ id: 'area-1', slug: 'downtown', name: 'Downtown', description: null });
    mockPrisma.listingCollection.findFirst.mockResolvedValue({ id: 'collection-1', slug: 'luxury', name: 'Luxury', description: null, predicate: {} });
    mockPrisma.property.findMany.mockResolvedValue([]);
  });

  it('gates both parent eligibility and nested representative listings', async () => {
    const res = await request(buildApp()).get(path);

    expect(res.status).toBe(200);
    const query = mockPrisma.property.findMany.mock.calls[0][0];
    expect(JSON.stringify(query.where)).toContain('"source":{"not":"MLS"}');
    expect(JSON.stringify(query.include.listings.where)).toContain('"source":{"not":"MLS"}');
    expect(res.body.properties).toEqual([]);
    if (kind === 'area') expect(mockPrisma.geographicArea.findFirst).toHaveBeenCalledOnce();
    else expect(mockPrisma.listingCollection.findFirst).toHaveBeenCalledOnce();
  });
});

describe('POST /:slug/inquiries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateInquiry.mockResolvedValue({ id: 'inq1' });
  });

  const validBody = {
    visitorName: 'Bob Buyer',
    visitorEmail: 'bob@example.com',
    visitorPhone: '555-9999',
    message: 'I am interested in a home.',
  };

  it('returns 201 and creates inquiry on happy path', async () => {
    const res = await request(buildApp()).post('/myrtle-beach/inquiries').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(mockCreateInquiry).toHaveBeenCalledWith(expect.objectContaining({ portalSlug: 'myrtle-beach', ...validBody }));
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(buildApp()).post('/myrtle-beach/inquiries').send({ visitorName: 'Bob' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when portal not found', async () => {
    const { InquiryInputError } = await import('../../../services/inquiryService.js');
    mockCreateInquiry.mockRejectedValue(new InquiryInputError('Portal not found', 404));
    const res = await request(buildApp()).post('/myrtle-beach/inquiries').send(validBody);
    expect(res.status).toBe(404);
  });

  it('returns 404 when portal is inactive', async () => {
    const { InquiryInputError } = await import('../../../services/inquiryService.js');
    mockCreateInquiry.mockRejectedValue(new InquiryInputError('Portal not found', 404));
    const res = await request(buildApp()).post('/myrtle-beach/inquiries').send(validBody);
    expect(res.status).toBe(404);
  });

  it('returns 400 when DB write fails', async () => {
    mockCreateInquiry.mockRejectedValue(new Error('DB connection error'));

    const res = await request(buildApp()).post('/myrtle-beach/inquiries').send(validBody);
    expect(res.status).toBe(400);
  });
});

// --- T11: Neighborhood in portal public response ---
describe('GET /slug/:slug — neighborhood field', () => {
  beforeEach(() => vi.clearAllMocks());

  const PORTAL_WITH_NEIGHBORHOOD = {
    ...ACTIVE_PORTAL,
    neighborhood: {
      id: 'n1',
      name: 'Lake Norman',
      description: 'Lakeside living',
      highlights: ['Golf', 'Waterfront'],
      heroImageUrl: null,
      zipCodes: ['28117'],
      geoRules: [{ id: 'gr1', label: null, centerLat: 35.4, centerLng: -80.8, radiusMiles: 5 }],
    },
  };

  it('includes neighborhood in response when portal has one', async () => {
    mockSearchDocuments.mockResolvedValue({ found: 20, facet_counts: [{ field_name: 'price', stats: { min: 300000, max: 700000 } }] });
    mockPrisma.portal.findUnique.mockResolvedValue(PORTAL_WITH_NEIGHBORHOOD);

    const res = await request(buildApp()).get('/slug/myrtle-beach');
    expect(res.status).toBe(200);
    expect(res.body.neighborhood).toBeDefined();
    expect(res.body.neighborhood.name).toBe('Lake Norman');
  });

  it('does NOT include subdivisions in neighborhood response', async () => {
    // PUBLIC_FIELDS select excludes subdivisions — Prisma never returns the field.
    // Mock reflects actual Prisma output: no subdivisions key on the neighborhood.
    mockSearchDocuments.mockResolvedValue({ found: 5, facet_counts: [] });
    mockPrisma.portal.findUnique.mockResolvedValue(PORTAL_WITH_NEIGHBORHOOD);

    const res = await request(buildApp()).get('/slug/myrtle-beach');
    expect(res.status).toBe(200);
    expect(res.body.neighborhood.subdivisions).toBeUndefined();
  });

});
