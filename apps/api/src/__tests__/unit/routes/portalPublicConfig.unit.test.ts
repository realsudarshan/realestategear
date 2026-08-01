import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import portalPublicRoutes from '../../../routes/portalPublic.js';
import { getPublicPortalConfig } from '../../../services/portalConfigService.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/portals', portalPublicRoutes);
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
}

// Expectations are derived from the configured portal rather than the values
// this repository happens to ship. portal.config.ts is the one file every
// deployment edits ("fork this repo and edit these values"), so asserting its
// defaults literally fails in any fork the moment it is customised — the exact
// thing that file exists to do.
const expected = getPublicPortalConfig();

// There is exactly one portal per deployment — these routes always return
// this deployment's one config, regardless of the :slug/:hostname in the URL.
describe('portal public config routes', () => {
  it('returns public-safe portal config by slug', async () => {
    const res = await request(buildApp()).get(`/api/portals/slug/${expected.slug}/config`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      slug: expected.slug,
      name: expected.name,
      listings: { mode: expected.listings.mode, boardIds: expected.listings.boardIds },
      compliance: {
        idxApproved: expected.compliance.idxApproved,
        publicListingDisplay: expected.compliance.publicListingDisplay,
      },
    });
    // Server-only knob must never reach a public response, whatever the config holds.
    expect(res.body.listings).not.toHaveProperty('allowMockInProduction');
  });

  it('returns listing policy by slug', async () => {
    const res = await request(buildApp()).get(`/api/portals/slug/${expected.slug}/listing-policy`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      mode: expected.listings.mode,
      boardIds: expected.listings.boardIds,
    });
  });

  it('returns config by domain', async () => {
    const [domain] = expected.domains;
    const res = await request(buildApp()).get(`/api/portals/domain/${domain}/config`);

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe(expected.slug);
  });

  // The routes ignore the slug in the URL by design — one portal per
  // deployment. Asserting that with a literal slug would silently pass for the
  // wrong reason in a fork whose portal is named something else.
  it('returns this deployment config regardless of the slug in the URL', async () => {
    const res = await request(buildApp()).get('/api/portals/slug/some-other-portal/config');

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe(expected.slug);
  });
});
