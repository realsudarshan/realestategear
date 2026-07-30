import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
const property = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() })); const compile = vi.hoisted(() => vi.fn(() => ({ compiled: true })));
vi.mock('db', () => ({ prisma: { property }, ListingStatus: { ACTIVE: 'ACTIVE' }, ListingSource: { MLS: 'MLS', MANUAL: 'MANUAL', ZILLOW: 'ZILLOW', REALTOR_COM: 'REALTOR_COM' }, PropertyType: { SINGLE_FAMILY: 'SINGLE_FAMILY', CONDO: 'CONDO', TOWNHOUSE: 'TOWNHOUSE', MULTI_FAMILY: 'MULTI_FAMILY', LAND: 'LAND', COMMERCIAL: 'COMMERCIAL' } }));
vi.mock('search/collectionPredicate', () => ({ compileCollectionPredicate: compile }));
vi.mock('@realestategear/portal-config', () => ({ getPortalConfig: () => ({ slug: 'example-realty', listings: { mode: 'db', boardIds: ['board'], collectionSlugs: [] }, features: { search: true }, compliance: { idxApproved: true, publicListingDisplay: 'real' } }), toPublicPortalConfig: (v: unknown) => v }));
const service = await import('../../../services/portalReadinessService.js');
const portal = { id: 'p1', accountId: 'a1', slug: 'example-realty', isActive: true, agentEmail: 'a@example.com', brokerageName: 'Broker', brokeragePhone: '1', collections: [{ id: 'c1', predicate: {}, isPublished: true }] };
const originalMlsDisplay = process.env.MLS_PUBLIC_DISPLAY_ENABLED;
describe('collection-backed portal readiness', () => {
  beforeEach(() => { vi.clearAllMocks(); delete process.env.MLS_PUBLIC_DISPLAY_ENABLED; property.count.mockResolvedValue(1); property.findMany.mockResolvedValue([]); });
  afterAll(() => { if (originalMlsDisplay === undefined) delete process.env.MLS_PUBLIC_DISPLAY_ENABLED; else process.env.MLS_PUBLIC_DISPLAY_ENABLED = originalMlsDisplay; });
  it('blocks when no collection is published', async () => expect((await service.getPortalReadiness({ ...portal, collections: [] })).blockers.map((v) => v.id)).toContain('collections-published'));
  it('uses the shared Postgres compiler and keeps owner filters additive', () => { const where = service.buildPortalPropertyWhere(portal, ['board'], { bedrooms: 3 }); expect(compile).toHaveBeenCalledWith({}, { accountId: 'a1', portalId: 'p1', boardIds: ['board'], collectionId: 'c1', publicVisibility: true }); expect(where?.bedrooms).toEqual({ gte: 3 }); });
  it('allows listing display only after readiness and matching inventory pass', async () => expect((await service.getPortalReadiness(portal)).canShowListings).toBe(true));
  it('gates readiness parent matching and selected listings while MLS display is disabled', async () => {
    await service.getPortalListings(portal);
    const readinessWhere = property.count.mock.calls[0][0].where;
    expect(JSON.stringify(readinessWhere)).toContain('"source":{"not":"MLS"}');
    const query = property.findMany.mock.calls[0][0];
    expect(JSON.stringify(query.where)).toContain('"source":{"not":"MLS"}');
    expect(query.include.listings.where).toEqual({ AND: [{ status: 'ACTIVE', idxDisplayable: true, source: { not: 'MLS' } }, { mlsBoardId: { in: ['board'] } }] });
  });
  it('suppresses shared media for mixed/manual portal properties while disabled', async () => {
    property.findMany.mockResolvedValue([{ id: 'mixed', address: '1 Main', city: 'Charlotte', state: 'NC', media: [{ url: 'https://example.com/shared.jpg' }], listings: [{ id: 'manual', source: 'MANUAL', status: 'ACTIVE', imageUrl: null }] }]);
    const result = await service.getPortalListings(portal);
    expect(result.properties[0].imageUrl).toBeNull();
  });
  it('allows MLS and shared media only when explicitly enabled', async () => {
    process.env.MLS_PUBLIC_DISPLAY_ENABLED = 'true';
    property.findMany.mockResolvedValue([{ id: 'mls', address: '1 Main', city: 'Charlotte', state: 'NC', media: [{ url: 'https://example.com/shared.jpg' }], listings: [{ id: 'mls-1', source: 'MLS', status: 'ACTIVE', imageUrl: null }] }]);
    const result = await service.getPortalListings(portal);
    expect(result.properties[0].imageUrl).toBe('https://example.com/shared.jpg');
    expect(JSON.stringify(property.findMany.mock.calls[0][0].include.listings.where)).not.toContain('source');
  });
  it('gates portal detail at the parent and selected-listing levels and suppresses shared detail media', async () => {
    property.findFirst.mockResolvedValue({ id: 'mixed', address: '1 Main', city: 'Charlotte', state: 'NC', media: [{ id: 'media', url: 'https://example.com/shared.jpg' }], listings: [{ id: 'manual', source: 'MANUAL', status: 'ACTIVE', slug: 'manual-home' }] });

    const result = await service.getPortalProperty(portal, 'mixed');

    const query = property.findFirst.mock.calls[0][0];
    expect(JSON.stringify(query.where)).toContain('"source":{"not":"MLS"}');
    expect(JSON.stringify(query.include.listings.where)).toContain('"source":{"not":"MLS"}');
    expect(result?.media).toEqual([]);
  });
});
