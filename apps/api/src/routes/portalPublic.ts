import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Prisma, prisma } from 'db';
import { validateSlug } from '../services/agentPortalsService.js';
import { createInquiry, InquiryInputError } from '../services/inquiryService.js';
import { getPublicPortalConfig, getPublicPortalListingPolicy } from '../services/portalConfigService.js';
import { getPortalListings, getPortalProperty, getPortalReadiness } from '../services/portalReadinessService.js';
import { enqueue as enqueueLeadResponse } from '../services/leadResponseAgentService.js';
import logger from '../utils/logger.js';
import { compileCollectionPredicate } from 'search/collectionPredicate';
import { getPortalConfig } from '@realestategear/portal-config';
import { buildPublicListingWhere, isMlsPublicDisplayEnabled } from 'search/propertyVisibility';

const router = Router();

function handlePortalConfigError(err, res, next) {
  if (err?.status) return res.status(err.status).json({ error: err.message });
  return next(err);
}

function parseNumberParam(value) {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// Express's query parser turns a repeated key (?q=a&q=b) into an array —
// `.trim()` on an array throws, turning a duplicated query param into a 500
// on this public, unauthenticated route. Take the first string value only.
function parseStringParam(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function buildPublicFields(): Prisma.PortalSelect {
  return {
  id: true,
  accountId: true,
  slug: true,
  name: true,
  themePresetId: true,
  logoUrl: true,
  agentDisplayName: true,
  agentPhone: true,
  agentEmail: true,
  agentHeadlineText: true,
  brokerageName: true,
  brokeragePhone: true,
  isActive: true,
  collections: { where: { isPublished: true }, orderBy: { position: 'asc' }, select: { id: true, slug: true, name: true, description: true, predicate: true, isPublished: true } },
  featuredListings: {
    where: { listing: { is: buildPublicListingWhere() } },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      position: true,
      listing: {
        select: {
          id: true,
          listPrice: true,
          status: true,
          imageUrl: true,
          slug: true,
          bedrooms: true,
          bathrooms: true,
          squareFeet: true,
          property: {
            select: { id: true, address: true, city: true, state: true },
          },
        },
      },
    },
  },
  } satisfies Prisma.PortalSelect;
}

const READINESS_PORTAL_FIELDS = {
  id: true,
  accountId: true,
  slug: true,
  isActive: true,
  suspendedAt: true,
  agentEmail: true,
  brokerageName: true,
  brokeragePhone: true,
  collections: { where: { isPublished: true }, select: { id: true, predicate: true, isPublished: true } },
} satisfies Prisma.PortalSelect;


// Per-route rate limiter for inquiry submissions: 5/hour per IP per slug
const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.params.slug}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many inquiries submitted. Please try again later.' },
});

// Per-route rate limiter for listing search: each request runs a free-text
// OR query plus a count, both unauthenticated — 120/min per IP per slug
// allows normal interactive browsing while bounding query-cost abuse.
const listingsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.params.slug}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// GET /slug/:slug/available — check slug availability
router.get('/slug/:slug/available', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const slugError = validateSlug(slug);
    if (slugError) return res.json({ available: false, reason: slugError });

    const existing = await prisma.portal.findUnique({ where: { slug }, select: { id: true } });
    res.json({ available: !existing });
  } catch (err) {
    next(err);
  }
});


// GET /slug/:slug — public portal config lookup.
// A suspended portal (issue #205, manual admin action) is a distinct state
// from "doesn't exist" / "never launched" — it returns a minimal, generic
// { suspended: true } payload (no agent/brokerage info) rather than 404, so
// The portal can render a soft-land page instead of a bare not-found.
router.get('/slug/:slug', async (req, res, next) => {
  try {
    const portal = await prisma.portal.findUnique({
      where: { slug: req.params.slug },
      select: { ...buildPublicFields(), suspendedAt: true },
    });
    if (!portal) return res.status(404).json({ error: 'Portal not found' });
    if (portal.suspendedAt) return res.json({ suspended: true });
    if (!portal.isActive) return res.status(404).json({ error: 'Portal not found' });
    const { suspendedAt: _suspendedAt, ...publicPortal } = portal;
    res.json(publicPortal);
  } catch (err) {
    next(err);
  }
});

// GET /slug/:slug/readiness — public-safe resolved listing/search readiness.
router.get('/slug/:slug/readiness', async (req, res, next) => {
  try {
    const portal = await prisma.portal.findUnique({
      where: { slug: req.params.slug },
      select: READINESS_PORTAL_FIELDS,
    });
    if (!portal || !portal.isActive || portal.suspendedAt) return res.status(404).json({ error: 'Portal not found' });
    res.json(await getPortalReadiness(portal));
  } catch (err) {
    handlePortalConfigError(err, res, next);
  }
});

// GET /slug/:slug/listings — portal-scoped listing search. Scope and compliance
// gates are enforced server-side by portalReadinessService.
router.get('/slug/:slug/listings', listingsLimiter, async (req, res, next) => {
  try {
    const portal = await prisma.portal.findUnique({
      where: { slug: req.params.slug },
      select: READINESS_PORTAL_FIELDS,
    });
    if (!portal || !portal.isActive || portal.suspendedAt) return res.status(404).json({ error: 'Portal not found' });
    res.json(await getPortalListings(portal, {
      q: parseStringParam(req.query.q),
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 12),
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as string | undefined,
      minPrice: parseNumberParam(req.query.minPrice),
      maxPrice: parseNumberParam(req.query.maxPrice),
      bedrooms: parseNumberParam(req.query.bedrooms),
      bathrooms: parseNumberParam(req.query.bathrooms),
      propertyType: req.query.propertyType as string | undefined,
    }));
  } catch (err) {
    handlePortalConfigError(err, res, next);
  }
});

async function publicLanding(req, res, next, kind: 'area' | 'collection') {
  try {
    const portal = await prisma.portal.findUnique({ where: { slug: req.params.slug }, select: READINESS_PORTAL_FIELDS });
    if (!portal || !portal.isActive || portal.suspendedAt) return res.status(404).json({ error: 'Portal not found' });
    const metadata = kind === 'area'
      ? await prisma.geographicArea.findFirst({ where: { accountId: portal.accountId, slug: req.params.itemSlug, isPublished: true }, select: { id: true, slug: true, name: true, description: true } })
      : await prisma.listingCollection.findFirst({ where: { portalId: portal.id, slug: req.params.itemSlug, isPublished: true }, select: { id: true, slug: true, name: true, description: true, predicate: true } });
    if (!metadata) return res.status(404).json({ error: `${kind === 'area' ? 'Area' : 'Collection'} not found` });
    const readiness = await getPortalReadiness(portal); if (!readiness.canShowListings) return res.json({ metadata, properties: [], readiness, gated: true });
    const predicate = kind === 'area' ? { areaSlugs: [metadata.slug] } : (metadata as unknown as { predicate: Prisma.JsonValue }).predicate;
    const listingWhere = buildPublicListingWhere({
      ...(getPortalConfig().listings.boardIds.length ? { mlsBoardId: { in: getPortalConfig().listings.boardIds } } : {}),
    });
    const compiledWhere = compileCollectionPredicate(predicate, { accountId: portal.accountId, portalId: portal.id, boardIds: getPortalConfig().listings.boardIds, publicVisibility: true, ...(kind === 'collection' ? { collectionId: metadata.id } : {}) });
    const where: Prisma.PropertyWhereInput = { AND: [compiledWhere, { listings: { some: listingWhere } }] };
    const properties = await prisma.property.findMany({ where, take: 24, include: { listings: { where: listingWhere, orderBy: { listDate: 'desc' }, take: 1 }, media: { orderBy: { order: 'asc' }, take: 1 } } });
    res.json({ metadata, readiness, gated: false, properties: properties.map((p) => ({ id: p.id, address: p.address, city: p.city, state: p.state, zipCode: p.zipCode, bedrooms: p.bedrooms, bathrooms: p.bathrooms, squareFeet: p.squareFeet, price: p.listings[0]?.listPrice == null ? null : Number(p.listings[0].listPrice), imageUrl: p.listings[0]?.imageUrl ?? (isMlsPublicDisplayEnabled() ? p.media[0]?.url ?? null : null), slug: p.listings[0]?.slug ?? null, listingId: p.listings[0]?.id ?? null, subdivision: p.subdivision, status: p.listings[0]?.status ?? null })) });
  } catch (e) { next(e); }
}
router.get('/slug/:slug/areas/:itemSlug', listingsLimiter, (req, res, next) => publicLanding(req, res, next, 'area'));
router.get('/slug/:slug/collections/:itemSlug', listingsLimiter, (req, res, next) => publicLanding(req, res, next, 'collection'));

// GET /slug/:slug/properties/:identifier — one portal-scoped property by
// stable listing slug or property id. All readiness, geography, IDX, status,
// and board gates are enforced by portalReadinessService before lookup.
router.get('/slug/:slug/properties/:identifier', listingsLimiter, async (req, res, next) => {
  try {
    const portal = await prisma.portal.findUnique({
      where: { slug: req.params.slug },
      select: READINESS_PORTAL_FIELDS,
    });
    if (!portal || !portal.isActive || portal.suspendedAt) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const property = await getPortalProperty(portal, req.params.identifier);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    res.json(property);
  } catch (err) {
    handlePortalConfigError(err, res, next);
  }
});

// GET /slug/:slug/config — code-defined portal presentation and listing policy.
// Future standalone migration: keep this response stable so a Railway config
// service can serve the same JSON shape at /v1/portals/:slug/config.
router.get('/slug/:slug/config', async (req, res, next) => {
  try {
    res.json(getPublicPortalConfig());
  } catch (err) {
    handlePortalConfigError(err, res, next);
  }
});

// GET /slug/:slug/listing-policy — public-safe listing mode and MLS scope.
router.get('/slug/:slug/listing-policy', async (req, res, next) => {
  try {
    res.json(getPublicPortalListingPolicy());
  } catch (err) {
    handlePortalConfigError(err, res, next);
  }
});

// GET /domain/:hostname — lookup by custom domain
router.get('/domain/:hostname', async (req, res, next) => {
  try {
    const portal = await prisma.portal.findUnique({
      where: { customDomain: req.params.hostname },
      select: buildPublicFields(),
    });
    if (!portal || !portal.isActive) return res.status(404).json({ error: 'Portal not found' });
    res.json(portal);
  } catch (err) {
    next(err);
  }
});

// GET /domain/:hostname/config — host-based config lookup for custom domains.
router.get('/domain/:hostname/config', async (req, res, next) => {
  try {
    res.json(getPublicPortalConfig());
  } catch (err) {
    handlePortalConfigError(err, res, next);
  }
});

// POST /:slug/inquiries — submit inquiry
router.post('/:slug/inquiries', inquiryLimiter, async (req, res, next) => {
  try {
    const {
      visitorName,
      visitorEmail,
      visitorPhone,
      message,
      listingId,
      contactPreference,
      areaSlug,
      collectionSlug,
    } = req.body;

    if (!visitorName || !visitorEmail || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const inquiry = await createInquiry({
      portalSlug: req.params.slug,
      visitorName,
      visitorEmail,
      visitorPhone,
      message,
      listingId,
      contactPreference,
      areaSlug,
      collectionSlug,
    });

    enqueueLeadResponse('inquiry', inquiry.id).catch(() => {});

    res.status(201).json({ ok: true });
  } catch (err) {
    if (err instanceof InquiryInputError) return res.status(err.statusCode).json({ error: err.message });
    logger.error('Portal inquiry submission failed:', err);
    res.status(400).json({ error: 'Unable to submit inquiry. Please try again.' });
  }
});

export default router;
