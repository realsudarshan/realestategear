import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, closeTestApp } from '../utils/testApp.js';
import { clearDatabase, seedDatabase, createAuthHeaders, createAuthToken } from '../utils/testHelpers.js';

describe('Agent Listings Routes - integration tests', () => {
  let app;
  let prisma;
  let user;
  let property;
  let listing;
  let authHeaders;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
    const seeded = await seedDatabase(prisma);
    user = seeded.user;
    property = seeded.property;
    listing = await prisma.listing.findFirstOrThrow({ where: { propertyId: property.id } });
    authHeaders = createAuthHeaders(
      createAuthToken({
        id: user.id,
        email: user.email,
        role: 'AGENT',
        accountId: user.accountId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
  });

  it('returns setup state when the account has no MLS access', async () => {
    const response = await request(app).get('/api/agent/listings/discovery').set(authHeaders);

    expect(response.status).toBe(200);
    expect(response.body.setup.hasMlsAccess).toBe(false);
    expect(response.body.defaultFeed).toBeNull();
    expect(response.body.segmentFeeds).toEqual([]);
  });

  it('returns newest listings for verified MLS access', async () => {
    await prisma.accountMlsAccess.create({
      data: {
        accountId: user.accountId,
        mlsBoardId: 'CanopyMLS',
        membershipId: 'AGENT123',
        verifiedAt: new Date(),
      },
    });

    const response = await request(app).get('/api/agent/listings/discovery').set(authHeaders);

    expect(response.status).toBe(200);
    expect(response.body.setup.hasMlsAccess).toBe(true);
    expect(response.body.defaultFeed.listings[0]).toMatchObject({
      propertyId: property.id,
      mlsId: 'AUS001',
      mlsBoardId: 'CanopyMLS',
      mlsBoardName: 'Canopy MLS',
      address: '123 Main Street',
      imageUrl: 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800',
    });
  });

  it('returns deployed collection feeds through the compatibility response', async () => {
    await prisma.accountMlsAccess.create({
      data: {
        accountId: user.accountId,
        mlsBoardId: 'CanopyMLS',
        membershipId: 'AGENT123',
        verifiedAt: new Date(),
      },
    });
    const portal = await prisma.portal.create({
      data: { accountId: user.accountId, name: 'Austin Portal', slug: 'austin-portal', isActive: true },
    });
    const collection = await prisma.listingCollection.create({ data: { portalId: portal.id, name: 'Austin Core', slug: 'austin-core', predicate: {}, isPublished: true } });

    const response = await request(app).get('/api/agent/listings/discovery').set(authHeaders);

    expect(response.status).toBe(200);
    expect(response.body.setup.hasDeployedSegments).toBe(true);
    expect(response.body.segmentFeeds[0]).toMatchObject({
      segmentId: collection.id,
      segmentName: 'Austin Core',
      portalCount: 1,
      listingCount: 1,
    });
  });

  it('searches exact MLS number before fuzzy address matches', async () => {
    await prisma.accountMlsAccess.create({
      data: {
        accountId: user.accountId,
        mlsBoardId: 'CanopyMLS',
        membershipId: 'AGENT123',
        verifiedAt: new Date(),
      },
    });

    const response = await request(app).get('/api/agent/listings/search?q=AUS001').set(authHeaders);

    expect(response.status).toBe(200);
    expect(response.body.listings[0]).toMatchObject({
      mlsId: 'AUS001',
      address: property.address,
    });
  });

  it('returns listing-first detail with property history and workflow context', async () => {
    await prisma.accountMlsAccess.create({
      data: {
        accountId: user.accountId,
        mlsBoardId: 'CanopyMLS',
        membershipId: 'AGENT123',
        verifiedAt: new Date(),
      },
    });
    await prisma.media.create({
      data: {
        propertyId: property.id,
        url: 'https://images.example.com/123-main-1.jpg',
        caption: 'Front elevation',
        order: 1,
      },
    });
    const transaction = await prisma.transaction.create({
      data: {
        accountId: user.accountId,
        propertyId: property.id,
        type: 'BUYER',
        stage: 'ACTIVE',
        address: property.address,
        mlsId: 'AUS001',
        listPrice: 450000,
      },
    });

    const response = await request(app).get(`/api/agent/listings/${listing.id}`).set(authHeaders);

    expect(response.status).toBe(200);
    expect(response.body.listing).toMatchObject({ id: listing.id, mlsId: 'AUS001', address: property.address });
    expect(response.body.property).toMatchObject({ id: property.id, address: property.address, city: 'Austin' });
    expect(response.body.media).toEqual([
      expect.objectContaining({ url: 'https://images.example.com/123-main-1.jpg', caption: 'Front elevation' }),
    ]);
    expect(response.body.propertyHistory[0]).toMatchObject({ id: listing.id, mlsId: 'AUS001' });
    expect(response.body.workflow.canCreateTransaction).toBe(false);
    expect(response.body.workflow.transactions[0]).toMatchObject({ id: transaction.id, stage: 'ACTIVE', mlsId: 'AUS001' });
  });

  it('does not return listing detail without verified MLS access', async () => {
    const response = await request(app).get(`/api/agent/listings/${listing.id}`).set(authHeaders);

    expect(response.status).toBe(404);
  });
});
