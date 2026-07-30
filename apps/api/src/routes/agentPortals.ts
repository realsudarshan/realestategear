import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Prisma, prisma } from 'db';
import { sendEmail } from 'email';
import {
  validateSlug,
  checkOwnership,
  generateLogoUploadUrl,
  validateFeaturedListingAccess,
  validateActivation,
} from '../services/agentPortalsService.js';
import { getPortalReadiness } from '../services/portalReadinessService.js';
import {
  createDomain,
  listDomainsForPortal,
  removeDomain,
  setCanonicalDomain,
  verifyDomain,
} from '../services/portalDomainService.js';
import { getAccountEmailTarget, sendPortalLaunchedEmails } from '../services/lifecycleEmailService.js';
import { TtlCache } from '../utils/ttlCache.js';
import logger from '../utils/logger.js';

const router = Router();

// ─── Launch-checklist endpoints: test-inquiry + preview-ping ───────────────

// Account membership cache for the rate-limit keyGenerator below. Account
// memberships are stable for a user's session — a 5-minute TTL is plenty,
// and keeps us from hitting Postgres on every test-inquiry call.
const accountByUserCache = new TtlCache<string, string>({
  ttlMs: 5 * 60_000,
  maxSize: 500,
});

async function resolveAccountForUser(userId: string): Promise<string | null> {
  const cached = accountByUserCache.get(userId);
  if (cached) return cached;
  const member = await prisma.accountMember.findFirst({
    where: { userId },
    select: { accountId: true },
  });
  if (member?.accountId) accountByUserCache.set(userId, member.accountId);
  return member?.accountId ?? null;
}

// 5/hr per account on test-inquiry: every send triggers SMTP and emails the
// agent. Without a limit, an authenticated agent (or a compromised session)
// could spam their inbox. Account-scoped (not user-scoped) so a multi-user
// account collectively shares the quota — otherwise an account with N agents
// gets 5N/hr.
const testInquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: async (req) => {
    if (!req.user?.id) return `test-inquiry:ip:${ipKeyGenerator(req.ip)}`;
    const accountId = await resolveAccountForUser(req.user.id);
    return accountId ? `test-inquiry:acct:${accountId}` : `test-inquiry:user:${req.user.id}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many test inquiries. Try again in an hour.' },
});

// 60s TTL on preview-ping per portal id — a server-side ping of the public
// portal URL is cheap but adds an HTTP hop on every checklist render.
const previewPingCache = new TtlCache<string, { ok: boolean; status: number; checkedAt: string }>({
  ttlMs: 60_000,
  maxSize: 500,
});

// Slug regex matches validateSlug's contract: lowercase alphanumeric + hyphens,
// 1-64 chars. Defense in depth — portal-create already enforces this, but the
// preview-ping URL is server-constructed from `slug` and we don't trust DB
// values to never drift from the original regex.
const SLUG_RE = /^[a-z0-9-]{1,64}$/;

// ─── Portal write-path field handling ──────────────────────────────────────
// Only these scalar columns are user-writable. Everything else on the request
// body — relation objects echoed back from GET (`segments`, `account`,
// `featuredListings`), the server-managed `contactRoutingVerifiedAt`, and any
// vestigial client fields — is dropped before it reaches Prisma. Without this
// whitelist, unknown keys make prisma.portal.{create,update} throw a 500
// (the mass-assignment footgun that broke both create and edit).
// `customDomain` is deliberately NOT writable here: it's a @unique column that
// portalPublic resolves portals by hostname, with no ownership/DNS verification
// anywhere. Allowing raw writes would let any agent squat another's domain.
// Re-add behind a verified-domain flow.
const PORTAL_WRITABLE_FIELDS = [
  'name',
  'slug',
  'themePresetId',
  'logoUrl',
  'agentDisplayName',
  'agentPhone',
  'agentEmail',
  'agentHeadlineText',
  'isActive',
  'brokerageName',
  'brokeragePhone',
];

type PortalWritableData = Pick<Prisma.PortalUncheckedCreateInput,
  | 'name'
  | 'slug'
  | 'themePresetId'
  | 'logoUrl'
  | 'agentDisplayName'
  | 'agentPhone'
  | 'agentEmail'
  | 'agentHeadlineText'
  | 'isActive'
  | 'brokerageName'
  | 'brokeragePhone'
>;

function pickPortalWritableFields(body: Record<string, unknown>): Partial<PortalWritableData> {
  const data: Partial<PortalWritableData> = {};
  for (const key of PORTAL_WRITABLE_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key] as never;
  }
  return data;
}

const COLLECTION_INCLUDE = {
  collections: { select: { id: true, name: true, slug: true, isPublished: true, position: true } },
};

async function notifyPortalLaunched(accountId: string, portal: { id: string; name: string; slug: string }) {
  const account = await getAccountEmailTarget(accountId);
  if (!account) return;
  await sendPortalLaunchedEmails({
    account,
    portalId: portal.id,
    portalName: portal.name,
    portalSlug: portal.slug,
  });
}

function fireNotifyPortalLaunched(accountId: string, portal: { id: string; name: string; slug: string }) {
  notifyPortalLaunched(accountId, portal).catch((err) =>
    logger.warn('Portal launched email failed:', { error: err?.message, portalId: portal.id })
  );
}

// GET / — list portals for the authenticated agent
router.get('/', async (req, res, next) => {
  try {
    const member = await prisma.accountMember.findFirst({ where: { userId: req.user.id } });
    if (!member) return res.status(403).json({ error: 'No account membership found' });
    const portals = await prisma.portal.findMany({
      where: { accountId: member.accountId },
      include: {
        _count: { select: { inquiries: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(portals);
  } catch (err) {
    next(err);
  }
});

// POST / — create portal
router.post('/', async (req, res, next) => {
  try {
    const data = pickPortalWritableFields(req.body as Record<string, unknown>);

    if (!data.name) return res.status(400).json({ error: 'Name is required' });

    const slugError = validateSlug(data.slug);
    if (slugError) return res.status(400).json({ error: slugError });

    const existing = await prisma.portal.findUnique({ where: { slug: data.slug } });
    if (existing) return res.status(409).json({ error: 'Slug is already taken — try another' });

    if (data.isActive === true) {
      const activationError = await validateActivation(data);
      if (activationError) return res.status(400).json({ error: activationError });
    }

    const member = await prisma.accountMember.findFirst({ where: { userId: req.user.id } });
    if (!member) return res.status(403).json({ error: 'No account membership found' });

    const portalData: Prisma.PortalUncheckedCreateInput = {
      ...data,
      name: String(data.name),
      slug: String(data.slug),
      accountId: member.accountId,
    };

    const portal = await prisma.portal.create({
      data: portalData,
      include: COLLECTION_INCLUDE,
    });
    if (portal.isActive) {
      fireNotifyPortalLaunched(member.accountId, portal);
    }
    res.status(201).json(portal);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Slug is already taken — try another' });
    }
    next(err);
  }
});

const FEATURED_LISTING_FIELDS = {
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
};

// GET /:id — get one portal (owner only)
router.get('/:id', async (req, res, next) => {
  try {
    await checkOwnership(req.params.id, req.user.id);
    const portal = await prisma.portal.findUnique({
      where: { id: req.params.id },
      include: {
        featuredListings: {
          orderBy: { position: 'asc' },
          select: FEATURED_LISTING_FIELDS,
        },
        collections: { orderBy: { position: 'asc' } },
      },
    });
    res.json(portal);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// GET /:id/readiness — account-scoped resolved launch/listing gates.
router.get('/:id/readiness', async (req, res, next) => {
  try {
    await checkOwnership(req.params.id, req.user.id);
    const portal = await prisma.portal.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        accountId: true,
        slug: true,
        isActive: true,
        agentEmail: true,
        brokerageName: true,
        brokeragePhone: true,
        collections: { select: { id: true, predicate: true, isPublished: true } },
      },
    });
    if (!portal) return res.status(404).json({ error: 'Portal not found' });
    res.json(await getPortalReadiness(portal));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// Shared update path for PUT/PATCH: whitelist fields, validate, then commit the
// portal write and any segment-link changes in ONE transaction so a rejected
// update (e.g. slug collision) can't leave segment links already mutated.
async function updatePortal(req, res, next) {
  try {
    const owned = await checkOwnership(req.params.id, req.user.id);
    const data = pickPortalWritableFields(req.body as Record<string, unknown>);

    if (data.slug) {
      const slugError = validateSlug(data.slug);
      if (slugError) return res.status(400).json({ error: slugError });
    }
    if (data.name === '') return res.status(400).json({ error: 'Name cannot be empty' });

    if (data.isActive === true) {
      const merged = { ...owned, ...data };
      const activationError = await validateActivation(merged);
      if (activationError) return res.status(400).json({ error: activationError });
    }

    const updateOp = prisma.portal.update({
      where: { id: req.params.id },
      data,
      include: COLLECTION_INCLUDE,
    });

    const portal = await updateOp;
    if (!owned.isActive && portal.isActive) {
      fireNotifyPortalLaunched(owned.accountId, portal);
    }
    res.json(portal);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Slug is already taken — try another' });
    next(err);
  }
}

// PUT /:id — full update
router.put('/:id', updatePortal);

// PATCH /:id — partial update
router.patch('/:id', updatePortal);

// DELETE /:id — delete portal
router.delete('/:id', async (req, res, next) => {
  try {
    await checkOwnership(req.params.id, req.user.id);
    await prisma.portal.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// POST /:id/test-inquiry — agent self-test of contact routing.
//
// Sends a test email to the portal's configured agentEmail. On provider-ack,
// sets Portal.contactRoutingVerifiedAt = NOW() so the launch checklist's
// routing gate passes. Does NOT create an Inquiry row; routing tests are not leads.
// fake leads in the agent's inbox.
//
// /autoplan eng review E4: rate-limited, account-scoped, label clear in subject
// so the agent doesn't confuse it with a real lead.
router.post('/:id/test-inquiry', testInquiryLimiter, async (req, res, next) => {
  try {
    await checkOwnership(req.params.id, req.user.id);

    const portal = await prisma.portal.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, slug: true, agentEmail: true },
    });
    if (!portal) return res.status(404).json({ error: 'Portal not found' });
    if (!portal.agentEmail) {
      return res.status(400).json({
        error: 'Set an agent email on the portal before running this check.',
      });
    }

    try {
      await sendEmail({
        to: portal.agentEmail,
        subject: `[Test] Inquiry routing check — ${portal.name}`,
        html: `
          <p>This is a test inquiry from Real Estate Gear's launch readiness checker.</p>
          <p>You're seeing this because you triggered the "Verify contact routing"
          gate on the launch checklist for <strong>${portal.name}</strong>.</p>
          <p>If you received this, your routing is working. No further action needed.</p>
          <p style="color:#888;font-size:12px;margin-top:24px;">
            Portal: ${portal.slug}<br>
            Sent: ${new Date().toISOString()}
          </p>
        `,
      });
    } catch (err) {
      logger.error('Test inquiry send failed:', err);
      return res.status(502).json({
        ok: false,
        error: 'Email provider did not accept the message. Routing not verified.',
      });
    }

    const updated = await prisma.portal.update({
      where: { id: portal.id },
      data: { contactRoutingVerifiedAt: new Date() },
      select: { id: true, contactRoutingVerifiedAt: true },
    });

    res.json({ ok: true, contactRoutingVerifiedAt: updated.contactRoutingVerifiedAt });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// GET /:id/preview-ping — server-side HEAD against the portal's public URL.
//
// Used by the launch checklist's "public page returns 200" gate.
//
// SSRF posture (/autoplan eng review E2, flagged critical/confidence 9 by both
// eng voices):
// - URL is constructed from PUBLIC_WEB_ORIGIN env + URL-encoded slug. The slug
//   pattern (^[a-z0-9-]{1,64}$) is re-validated here in case a DB row drifted
//   from the original validateSlug contract.
// - redirect: 'manual' — a portal that 30x's somewhere else should not pass.
// - 3s AbortSignal timeout — bounded blocking on the API node.
// - No DNS-level IP allowlist: we rely on PUBLIC_WEB_ORIGIN being correctly
//   set to a public domain at deploy time. If it isn't, every preview-ping
//   reaches the misconfigured target — that's a deployment-config bug, not a
//   request-input attack vector.
// - 60s TtlCache per portal id keeps the load reasonable when an agent
//   re-renders the checklist a few times in a row.
router.get('/:id/preview-ping', async (req, res, next) => {
  try {
    await checkOwnership(req.params.id, req.user.id);

    const portal = await prisma.portal.findUnique({
      where: { id: req.params.id },
      select: { slug: true },
    });
    if (!portal) return res.status(404).json({ error: 'Portal not found' });
    if (!SLUG_RE.test(portal.slug)) {
      return res.status(400).json({
        ok: false,
        error: 'Portal slug does not match the expected pattern. Edit the slug and re-check.',
      });
    }

    const cached = previewPingCache.get(req.params.id);
    if (cached) return res.json(cached);

    const baseOrigin = process.env.PUBLIC_WEB_ORIGIN;
    if (!baseOrigin) {
      logger.error('PUBLIC_WEB_ORIGIN is not set; cannot ping portal preview.');
      return res.status(503).json({
        ok: false,
        error: 'Preview ping not configured on the server.',
      });
    }

    // URL constructor handles encoding + protocol validation. Constructed
    // entirely from server-known values; no request-input leaks in.
    const target = new URL(`/p/${encodeURIComponent(portal.slug)}`, baseOrigin).toString();

    let ok = false;
    let status = 0;
    try {
      const r = await fetch(target, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(3000),
      });
      status = r.status;
      ok = r.ok; // 200-299 — explicitly excludes 3xx redirects and 4xx/5xx.
    } catch (err) {
      logger.warn(`Preview ping failed for portal ${req.params.id}:`, err);
      ok = false;
    }

    const result = { ok, status, checkedAt: new Date().toISOString() };
    previewPingCache.set(req.params.id, result);
    res.json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// GET /:id/logo-upload-url — presigned R2/S3 PUT URL
router.get('/:id/logo-upload-url', async (req, res, next) => {
  try {
    const contentType = req.query.contentType as string;
    if (!contentType) return res.status(400).json({ error: 'contentType query param required' });

    const url = await generateLogoUploadUrl(req.params.id, req.user.id, contentType);
    const publicBase = process.env.STORAGE_PUBLIC_BASE_URL ?? '';
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const publicUrl = `${publicBase}/portals/${req.params.id}/logo.${ext}`;
    res.json({ uploadUrl: url, publicUrl });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// PUT /:id/featured-listings — replace featured listings list
router.put('/:id/featured-listings', async (req, res, next) => {
  try {
    await checkOwnership(req.params.id, req.user.id);
    const { listingIds } = req.body; // ordered array, max 6

    if (!Array.isArray(listingIds)) {
      return res.status(400).json({ error: 'listingIds must be an array' });
    }
    if (listingIds.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 featured listings allowed' });
    }

    for (const listingId of listingIds) {
      await validateFeaturedListingAccess(req.params.id, listingId, req.user.id);
    }

    await prisma.$transaction([
      prisma.portalFeaturedListing.deleteMany({ where: { portalId: req.params.id } }),
      ...listingIds.map((listingId, i) =>
        prisma.portalFeaturedListing.create({
          data: { portalId: req.params.id, listingId, position: i },
        })
      ),
    ]);

    res.json({ updated: true });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// ─── Custom domains ───────────────────────────────────────────────────────
// Verified custom domains for a portal. See portalDomainService.ts for the
// DNS-TXT verification state machine and plan-entitlement gating.

// GET /:id/domains — list a portal's custom domains (owner only)
router.get('/:id/domains', async (req, res, next) => {
  try {
    await checkOwnership(req.params.id, req.user.id);
    res.json(await listDomainsForPortal(req.params.id));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// POST /:id/domains — register a new custom domain (starts PENDING)
router.post('/:id/domains', async (req, res, next) => {
  try {
    await checkOwnership(req.params.id, req.user.id);
    const { hostname } = req.body ?? {};
    if (typeof hostname !== 'string' || !hostname.trim()) {
      return res.status(400).json({ error: 'hostname is required' });
    }
    const domain = await createDomain(req.params.id, hostname);
    res.status(201).json(domain);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// POST /:id/domains/:domainId/verify — check the DNS TXT ownership proof
router.post('/:id/domains/:domainId/verify', async (req, res, next) => {
  try {
    await checkOwnership(req.params.id, req.user.id);
    res.json(await verifyDomain(req.params.id, req.params.domainId));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// PATCH /:id/domains/:domainId/canonical — set as the portal's canonical domain
router.patch('/:id/domains/:domainId/canonical', async (req, res, next) => {
  try {
    await checkOwnership(req.params.id, req.user.id);
    res.json(await setCanonicalDomain(req.params.id, req.params.domainId));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// DELETE /:id/domains/:domainId — remove a custom domain
router.delete('/:id/domains/:domainId', async (req, res, next) => {
  try {
    await checkOwnership(req.params.id, req.user.id);
    await removeDomain(req.params.id, req.params.domainId);
    res.status(204).send();
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// ─── Inquiry inbox ─────────────────────────────────────────────────────────
// Leads submitted through a portal's public inquiry form. Read + status
// management only; agents reply from their own email (the inquiry
// notification already routes to portal.agentEmail).

// Mirrors Inquiry.status. Default is 'NEW' (schema default); READ marks a
// lead seen, ARCHIVED clears it from the active view without deleting history.
// Filterable/settable via this API — does NOT include 'RESPONDED', which the AI
// lead-response pipeline (aiDraftService.ts) sets directly on the model when an
// agent sends a drafted reply. RESPONDED inquiries still show under the "All"
// tab; see COUNT_STATUSES below for why they're still counted.
const INQUIRY_STATUSES = ['NEW', 'READ', 'ARCHIVED'] as const;
type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

// Every status Inquiry.status can actually hold, for seeding the counts
// object. Wider than INQUIRY_STATUSES so the "All" tab's total always equals
// the sum of the per-status counts, even for the RESPONDED rows this API
// doesn't let agents filter or transition to/from directly.
const COUNT_STATUSES = [...INQUIRY_STATUSES, 'RESPONDED'] as const;

const INQUIRY_PAGE_SIZE = 20;
const INQUIRY_MAX_PAGE_SIZE = 50;

// GET /:id/inquiries — paginated inquiries for a portal (owner only).
// Cursor pagination (unlike the offset-based { page, limit, total } envelope used
// elsewhere in this file) because the frontend is an infinite-scroll list, not a
// numbered table — cursor pagination avoids skipped/duplicated rows as new
// inquiries arrive between page fetches. The [portalId, createdAt] index backs
// the ordered scan. Returns per-status counts on the first page only (the
// frontend reads counts from page one) so the inbox can label its filter tabs
// without a second round-trip.
router.get('/:id/inquiries', async (req, res, next) => {
  try {
    await checkOwnership(req.params.id, req.user.id);

    const statusParam = req.query.status;
    let statusFilter: InquiryStatus | undefined;
    if (typeof statusParam === 'string' && statusParam.length > 0) {
      if (!INQUIRY_STATUSES.includes(statusParam as InquiryStatus)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      statusFilter = statusParam as InquiryStatus;
    }

    const take = Math.min(
      Math.max(Number(req.query.limit) || INQUIRY_PAGE_SIZE, 1),
      INQUIRY_MAX_PAGE_SIZE
    );
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const where = {
      portalId: req.params.id,
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const [rows, grouped] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1, // fetch one extra to detect a next page
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      // Only the first page's counts are read by the frontend (data.pages[0].counts) —
      // skip the aggregate on subsequent "Load more" fetches.
      cursor
        ? Promise.resolve([])
        : prisma.inquiry.groupBy({
            by: ['status'],
            where: { portalId: req.params.id },
            _count: { _all: true },
          }),
    ]);

    const hasMore = rows.length > take;
    const inquiries = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? inquiries[inquiries.length - 1].id : null;

    const counts: Record<string, number> = Object.fromEntries(COUNT_STATUSES.map((s) => [s, 0]));
    let total = 0;
    for (const g of grouped) {
      const n = g._count._all;
      total += n;
      if (g.status in counts) counts[g.status] = n;
    }

    res.json({ inquiries, nextCursor, counts: { ...counts, total } });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// PATCH /:id/inquiries/:inquiryId — update a single inquiry's status (owner only).
// updateMany scoped to { id, portalId } is the cross-portal write guard: an
// inquiryId from another portal matches zero rows → 404, never a silent update.
router.patch('/:id/inquiries/:inquiryId', async (req, res, next) => {
  try {
    await checkOwnership(req.params.id, req.user.id);

    const { status } = req.body ?? {};
    if (!INQUIRY_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status must be one of: NEW, READ, ARCHIVED' });
    }

    // RESPONDED is a terminal state set by the AI lead-response pipeline
    // (aiDraftService.ts) and is the sole guard against sending a lead a
    // second drafted reply (checkAlreadyResponded, plus the recovery cron's
    // `status: { not: 'RESPONDED' }` re-enqueue query). Excluding it here
    // keeps this route from ever moving an inquiry OUT of that state.
    const { count } = await prisma.inquiry.updateMany({
      where: { id: req.params.inquiryId, portalId: req.params.id, status: { not: 'RESPONDED' } },
      data: { status },
    });
    if (count === 0) {
      const existing = await prisma.inquiry.findFirst({
        where: { id: req.params.inquiryId, portalId: req.params.id },
        select: { status: true },
      });
      if (existing?.status === 'RESPONDED') {
        return res.status(409).json({ error: 'Cannot change status of an inquiry that has already been responded to' });
      }
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    const inquiry = await prisma.inquiry.findUnique({
      where: { id: req.params.inquiryId },
    });
    res.json(inquiry);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

export default router;
