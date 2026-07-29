import { beforeEach, describe, expect, it, vi } from 'vitest';
const property = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() })); const compile = vi.hoisted(() => vi.fn(() => ({ compiled: true })));
vi.mock('db', () => ({ prisma: { property }, ListingStatus: { ACTIVE: 'ACTIVE' }, PropertyType: { SINGLE_FAMILY: 'SINGLE_FAMILY', CONDO: 'CONDO', TOWNHOUSE: 'TOWNHOUSE', MULTI_FAMILY: 'MULTI_FAMILY', LAND: 'LAND', COMMERCIAL: 'COMMERCIAL' } }));
vi.mock('search/collectionPredicate', () => ({ compileCollectionPredicate: compile }));
vi.mock('@realestategear/portal-config', () => ({ getPortalConfig: () => ({ slug: 'example-realty', listings: { mode: 'db', boardIds: ['board'], collectionSlugs: [] }, features: { search: true }, compliance: { idxApproved: true, publicListingDisplay: 'real' } }), toPublicPortalConfig: (v: unknown) => v }));
const service = await import('../../../services/portalReadinessService.js');
const portal = { id: 'p1', accountId: 'a1', slug: 'example-realty', isActive: true, agentEmail: 'a@example.com', brokerageName: 'Broker', brokeragePhone: '1', collections: [{ id: 'c1', predicate: {}, isPublished: true }] };
describe('collection-backed portal readiness', () => {
  beforeEach(() => { vi.clearAllMocks(); property.count.mockResolvedValue(1); property.findMany.mockResolvedValue([]); });
  it('blocks when no collection is published', async () => expect((await service.getPortalReadiness({ ...portal, collections: [] })).blockers.map((v) => v.id)).toContain('collections-published'));
  it('uses the shared Postgres compiler and keeps owner filters additive', () => { const where = service.buildPortalPropertyWhere(portal, ['board'], { bedrooms: 3 }); expect(compile).toHaveBeenCalledWith({}, { accountId: 'a1', portalId: 'p1', boardIds: ['board'], collectionId: 'c1' }); expect(where?.bedrooms).toEqual({ gte: 3 }); });
  it('allows listing display only after readiness and matching inventory pass', async () => expect((await service.getPortalReadiness(portal)).canShowListings).toBe(true));
});
