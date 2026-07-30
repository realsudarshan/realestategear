import { vi, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp, closeTestApp, getPrismaClient } from '../utils/testApp.js';
import { clearDatabase, seedDatabase, createAuthHeaders, createAdminAuthToken } from '../utils/testHelpers.js';
import { mockProperty, mockPropertyFilters } from '../utils/fixtures.js';

describe('Properties Routes - integration tests', () => {
  let app;
  let prisma;
  const originalMlsDisplay = process.env.MLS_PUBLIC_DISPLAY_ENABLED;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
  });

  afterAll(async () => {
    await closeTestApp();
    if (originalMlsDisplay === undefined) delete process.env.MLS_PUBLIC_DISPLAY_ENABLED;
    else process.env.MLS_PUBLIC_DISPLAY_ENABLED = originalMlsDisplay;
  });

  beforeEach(async () => {
    process.env.MLS_PUBLIC_DISPLAY_ENABLED = 'true';
    await clearDatabase(prisma);
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe('GET /api/properties', () => {
    beforeEach(async () => {
      await seedDatabase(prisma);
    });

    it('should return all properties by default', async () => {
      const response = await request(app)
        .get('/api/properties');

      expect(response.status).toBe(200);
      expect(response.body.properties).toBeDefined();
      expect(response.body.properties.length).toBeGreaterThan(0);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20); // service default is 20
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/properties?page=1&limit=5');

      expect(response.status).toBe(200);
      expect(response.body.properties.length).toBeLessThanOrEqual(5);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });

    it('should include active listing fields used by public property cards', async () => {
      const { property } = await seedDatabase(prisma);
      await prisma.listing.create({
        data: {
          propertyId: property.id,
          source: 'MLS',
          status: 'ACTIVE',
          slug: '123-main-street-austin-tx-featured',
          mlsId: 'AUS123',
          imageUrl: 'https://media.example.com/mls/AUS123/1.jpg',
          listPrice: 525000,
          listDate: new Date('2026-02-01T00:00:00.000Z'),
          description: 'Test listing description',
          brokerageName: 'Test Brokerage',
        },
      });

      const response = await request(app).get('/api/properties?city=Austin');

      expect(response.status).toBe(200);
      expect(response.body.properties[0]).toMatchObject({
        id: property.id,
        slug: '123-main-street-austin-tx-featured',
        mlsId: 'AUS123',
        imageUrl: 'https://media.example.com/mls/AUS123/1.jpg',
        price: 525000,
        status: 'Active',
        description: 'Test listing description',
        brokerageName: 'Test Brokerage',
      });
    });

    it('preserves a MANUAL listing but suppresses shared media for a mixed-source property when MLS display is disabled', async () => {
      process.env.MLS_PUBLIC_DISPLAY_ENABLED = 'false';
      const property = await prisma.property.findFirstOrThrow({ where: { city: 'Austin' } });
      await prisma.listing.create({
        data: {
          propertyId: property.id,
          source: 'MANUAL',
          status: 'ACTIVE',
          slug: 'manual-public-listing',
          imageUrl: 'https://example.com/manual-listing.jpg',
          listPrice: 450000,
          listDate: new Date('2026-07-01T00:00:00.000Z'),
        },
      });
      await prisma.media.create({ data: { propertyId: property.id, url: 'https://example.com/shared-property.jpg', order: 0 } });

      const response = await request(app).get('/api/properties?city=Austin');

      expect(response.status).toBe(200);
      expect(response.body.properties).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: property.id, slug: 'manual-public-listing', imageUrl: 'https://example.com/manual-listing.jpg', media: [] }),
      ]));
      const mediaResponse = await request(app).get(`/api/properties/${property.id}/media`);
      expect(mediaResponse.body).toEqual([]);
    });

    it('should filter properties by bedrooms', async () => {
      const response = await request(app)
        .get('/api/properties?bedrooms=3');

      expect(response.status).toBe(200);
      response.body.properties.forEach(property => {
        expect(property.bedrooms).toBe(3);
      });
    });

    it('should filter properties by bathrooms', async () => {
      const response = await request(app)
        .get('/api/properties?bathrooms=2');

      expect(response.status).toBe(200);
      response.body.properties.forEach(property => {
        expect(property.bathrooms).toBe(2);
      });
    });

    it('should filter properties by property type', async () => {
      const response = await request(app)
        .get('/api/properties?propertyType=SINGLE_FAMILY');

      expect(response.status).toBe(200);
      response.body.properties.forEach(property => {
        expect(property.propertyType).toBe('SINGLE_FAMILY');
      });
    });

    // Regression: ISSUE-002 -- property type checkboxes can send the
    // display label ("Single Family"), not the Prisma enum, and this 500'd
    // with "Invalid value for argument `propertyType`. Expected PropertyType."
    // Found by /qa on 2026-07-20.
    // Report: .gstack/qa-reports/qa-report-worktree-health-cleanup-2026-07-20.md
    it('should filter properties by property type given a human-readable label', async () => {
      const response = await request(app)
        .get('/api/properties?propertyType=Single%20Family');

      expect(response.status).toBe(200);
      response.body.properties.forEach(property => {
        expect(property.propertyType).toBe('SINGLE_FAMILY');
      });
    });

    it('should drop invalid property type values instead of erroring', async () => {
      const response = await request(app)
        .get('/api/properties?propertyType=Not+A+Real+Type');

      expect(response.status).toBe(200);
    });

    it('should filter properties by city', async () => {
      const response = await request(app)
        .get('/api/properties?city=Austin');

      expect(response.status).toBe(200);
      response.body.properties.forEach(property => {
        expect(property.city).toBe('Austin');
      });
    });

    it('should sort properties by bedrooms descending', async () => {
      const response = await request(app)
        .get('/api/properties?sortBy=bedrooms_desc');

      expect(response.status).toBe(200);
      const bedroomCounts = response.body.properties.map(p => p.bedrooms);
      const sortedCounts = [...bedroomCounts].sort((a, b) => (b ?? 0) - (a ?? 0));
      expect(bedroomCounts).toEqual(sortedCounts);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/properties?page=0&limit=0');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate sqft range parameters', async () => {
      const response = await request(app)
        .get('/api/properties?minSqFt=-1000&maxSqFt=abc');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/properties/:id', () => {
    let testProperty;

    beforeEach(async () => {
      const { property } = await seedDatabase(prisma);
      testProperty = property;
    });

    it('should return property by ID', async () => {
      const response = await request(app)
        .get(`/api/properties/${testProperty.id}`);

      expect(response.status).toBe(200);
      // Route returns property directly (not wrapped in { property })
      expect(response.body.id).toBe(testProperty.id);
      expect(response.body.address).toBe(testProperty.address);
    });

    it('should return property details by listing slug with media fields', async () => {
      await prisma.listing.create({
        data: {
          propertyId: testProperty.id,
          source: 'MLS',
          status: 'ACTIVE',
          slug: 'slugged-test-property',
          mlsId: 'SLUG123',
          imageUrl: 'https://media.example.com/mls/SLUG123/1.jpg',
          listPrice: 625000,
        },
      });

      const response = await request(app).get('/api/properties/slugged-test-property');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: testProperty.id,
        slug: 'slugged-test-property',
        mlsId: 'SLUG123',
        imageUrl: 'https://media.example.com/mls/SLUG123/1.jpg',
        price: 625000,
        status: 'Active',
      });
    });

    it('should return 404 for non-existent property', async () => {
      const response = await request(app)
        .get('/api/properties/nonexistent-slug-xyz');

      expect(response.status).toBe(404);
      // Route uses { message } not { error } for 404 responses
      expect(response.body.message).toBe('Property not found');
    });

    it('returns 404 for an MLS-only property when public MLS display is disabled', async () => {
      process.env.MLS_PUBLIC_DISPLAY_ENABLED = 'false';

      const response = await request(app).get(`/api/properties/${testProperty.id}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Property not found');
    });

    it('should return 404 for unknown property identifier', async () => {
      // String IDs mean any identifier is a valid lookup attempt (by cuid or slug).
      // An unrecognised identifier returns 404, not 400.
      const response = await request(app)
        .get('/api/properties/unknown-identifier-xyz');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Property not found');
    });
  });

  describe('POST /api/properties', () => {
    let adminToken;

    beforeEach(async () => {
      const { adminUser } = await seedDatabase(prisma);
      adminToken = createAdminAuthToken({ id: adminUser.id, email: adminUser.email, role: 'ADMIN', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 });
    });

    it('should create property with valid data and admin auth', async () => {
      const propertyData = {
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1500,
        address: '456 Test Street',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
      };

      const response = await request(app)
        .post('/api/properties')
        .set(createAuthHeaders(adminToken))
        .send(propertyData);

      expect(response.status).toBe(201);
      expect(response.body.address).toBe(propertyData.address);
      expect(response.body.bedrooms).toBe(propertyData.bedrooms);
    });

    it('should reject property creation without authentication', async () => {
      const propertyData = {
        title: 'New Test Property',
        price: 400000
      };

      const response = await request(app)
        .post('/api/properties')
        .send(propertyData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No authorization header provided');
    });

    it('should reject property creation with invalid data', async () => {
      const invalidData = {
        bedrooms: 'invalid-not-a-number',
      };

      const response = await request(app)
        .post('/api/properties')
        .set(createAuthHeaders(adminToken))
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject property creation with missing required fields', async () => {
      const incompleteData = {
        bedrooms: 3,
        // Missing address, city, state, zipCode
      };

      const response = await request(app)
        .post('/api/properties')
        .set(createAuthHeaders(adminToken))
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('PUT /api/properties/:id', () => {
    let testProperty;
    let adminToken;

    beforeEach(async () => {
      const { property, adminUser } = await seedDatabase(prisma);
      testProperty = property;
      adminToken = createAdminAuthToken({ id: adminUser.id, email: adminUser.email, role: 'ADMIN', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 });
    });

    it('should update property with valid data and admin auth', async () => {
      const updateData = {
        squareFeet: 2000,
        bedrooms: 4,
      };

      const response = await request(app)
        .put(`/api/properties/${testProperty.id}`)
        .set(createAuthHeaders(adminToken))
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.squareFeet).toBe(updateData.squareFeet);
      expect(response.body.id).toBe(testProperty.id);
    });

    it('should reject property update without authentication', async () => {
      const updateData = {
        title: 'Updated Title'
      };

      const response = await request(app)
        .put(`/api/properties/${testProperty.id}`)
        .send(updateData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No authorization header provided');
    });

    it('should reject property update for non-existent property', async () => {
      const updateData = {
        bedrooms: 4,
      };

      const response = await request(app)
        .put('/api/properties/nonexistent-id-xyz')
        .set(createAuthHeaders(adminToken))
        .send(updateData);

      expect(response.status).toBe(404);
      // Route uses { message } not { error } for 404 responses
      expect(response.body.message).toBe('Property not found');
    });

    it('should reject property update with invalid data', async () => {
      const invalidData = {
        bedrooms: 'invalid-not-a-number',
      };

      const response = await request(app)
        .put(`/api/properties/${testProperty.id}`)
        .set(createAuthHeaders(adminToken))
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('DELETE /api/properties/:id', () => {
    let testProperty;
    let adminToken;

    beforeEach(async () => {
      const { property, adminUser } = await seedDatabase(prisma);
      testProperty = property;
      adminToken = createAdminAuthToken({ id: adminUser.id, email: adminUser.email, role: 'ADMIN', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 });
    });

    it('should delete property with admin auth', async () => {
      const response = await request(app)
        .delete(`/api/properties/${testProperty.id}`)
        .set(createAuthHeaders(adminToken));

      // Route sends 204 No Content on successful delete
      expect(response.status).toBe(204);

      // Verify property is deleted
      const getResponse = await request(app)
        .get(`/api/properties/${testProperty.id}`);
      expect(getResponse.status).toBe(404);
    });

    it('should reject property deletion without authentication', async () => {
      const response = await request(app)
        .delete(`/api/properties/${testProperty.id}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No authorization header provided');
    });

    it('should reject property deletion for non-existent property', async () => {
      const response = await request(app)
        .delete('/api/properties/nonexistent-id-xyz')
        .set(createAuthHeaders(adminToken));

      expect(response.status).toBe(404);
      // Route uses { message } not { error } for 404 responses
      expect(response.body.message).toBe('Property not found');
    });
  });
});
