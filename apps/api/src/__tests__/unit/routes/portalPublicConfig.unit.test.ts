import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import portalPublicRoutes from '../../../routes/portalPublic.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/portals', portalPublicRoutes);
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
}

// There is exactly one portal per deployment — these routes always return
// this deployment's one config, regardless of the :slug/:hostname in the URL.
describe('portal public config routes', () => {
  it('returns public-safe portal config by slug', async () => {
    const res = await request(buildApp()).get('/api/portals/slug/example-realty/config');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      slug: 'example-realty',
      name: 'Example Realty',
      listings: { mode: 'hidden', boardIds: [] },
      compliance: { idxApproved: false, publicListingDisplay: 'hidden' },
    });
    expect(res.body.listings).not.toHaveProperty('allowMockInProduction');
  });

  it('returns listing policy by slug', async () => {
    const res = await request(buildApp()).get('/api/portals/slug/example-realty/listing-policy');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mode: 'hidden', boardIds: [] });
  });

  it('returns config by domain', async () => {
    const res = await request(buildApp()).get('/api/portals/domain/example-realty.localhost/config');

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('example-realty');
  });
});
