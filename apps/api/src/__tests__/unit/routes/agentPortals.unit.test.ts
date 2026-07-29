import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => {
  const inquiry = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    groupBy: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  };
  return ({
  portal: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  accountMember: {
    findFirst: vi.fn(),
  },
  portalInquiry: inquiry,
  inquiry,
  $transaction: vi.fn(),
  });
});

const mockGetAccountEmailTarget = vi.hoisted(() => vi.fn());
const mockSendPortalLaunchedEmails = vi.hoisted(() => vi.fn());

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@aws-sdk/client-s3', () => ({ S3Client: vi.fn(), PutObjectCommand: vi.fn() }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://presigned-url'),
}));
vi.mock('../../../services/lifecycleEmailService.js', () => ({
  getAccountEmailTarget: mockGetAccountEmailTarget,
  sendPortalLaunchedEmails: mockSendPortalLaunchedEmails,
}));

// Mock service functions
vi.mock('../../../services/agentPortalsService.js', () => ({
  validateSlug: (slug: string) => {
    if (!slug) return 'Slug is required';
    if (['www', 'api', 'app', 'admin', 'mail', 'portal'].includes(slug)) return 'Slug is reserved';
    if (!/^[a-z0-9-]+$/.test(slug)) return 'Slug must be lowercase';
    return null;
  },
  checkOwnership: async (portalId: string, agentId: string) => {
    const portal = await mockPrisma.portal.findUnique({ where: { id: portalId } });
    if (!portal) throw Object.assign(new Error('Not found'), { statusCode: 404 });
    if (portal.agentId !== agentId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    return portal;
  },
  generateLogoUploadUrl: vi.fn().mockResolvedValue('https://presigned-url'),
  validateFeaturedListingAccess: vi.fn().mockResolvedValue(undefined),
  validateActivation: vi.fn().mockResolvedValue(null),
}));

const { default: express } = await import('express');
const { default: router } = await import('../../../routes/agentPortals.js');
const { default: request } = await import('supertest');

function buildApp(userId = 'agent1') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, role: 'AGENT' };
    next();
  });
  app.use('/', router);
  return app;
}

describe('POST / — create portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.accountMember.findFirst.mockResolvedValue({ id: 'mem1', accountId: 'acc1' });
    mockGetAccountEmailTarget.mockResolvedValue({ id: 'acc1', name: 'Acc', members: [] });
    mockSendPortalLaunchedEmails.mockResolvedValue(undefined);
  });

  it('creates portal with valid slug', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(null);
    mockPrisma.portal.create.mockResolvedValue({ id: 'p1', slug: 'my-portal', accountId: 'acc1' });

    const res = await request(buildApp()).post('/').send({ name: 'My Portal', slug: 'my-portal' });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('my-portal');
  });

  it('returns 400 for missing name', async () => {
    const res = await request(buildApp()).post('/').send({ slug: 'my-portal' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for reserved slug', async () => {
    const res = await request(buildApp()).post('/').send({ name: 'Test', slug: 'www' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when slug is already taken', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'existing' });
    const res = await request(buildApp()).post('/').send({ name: 'Test', slug: 'taken-slug' });
    expect(res.status).toBe(409);
  });

  it('returns 400 when creating with isActive:true but failing activation validation', async () => {
    const { validateActivation } = await import('../../../services/agentPortalsService.js');
    (validateActivation as ReturnType<typeof vi.fn>).mockResolvedValueOnce('Agent email is required to activate a portal');
    mockPrisma.portal.findUnique.mockResolvedValue(null);
    const res = await request(buildApp()).post('/').send({ name: 'Test', slug: 'my-portal', isActive: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('creates portal with isActive:true when activation validation passes', async () => {
    const { validateActivation } = await import('../../../services/agentPortalsService.js');
    (validateActivation as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    mockPrisma.portal.findUnique.mockResolvedValue(null);
    mockPrisma.portal.create.mockResolvedValue({ id: 'p1', slug: 'my-portal', accountId: 'acc1', isActive: true });
    const res = await request(buildApp()).post('/').send({ name: 'Test', slug: 'my-portal', isActive: true, agentEmail: 'agent@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.isActive).toBe(true);

    await vi.waitFor(() => expect(mockSendPortalLaunchedEmails).toHaveBeenCalledWith(
      expect.objectContaining({ portalId: 'p1', portalSlug: 'my-portal' })
    ));
  });

  it('does not notify portal launched when created inactive', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(null);
    mockPrisma.portal.create.mockResolvedValue({ id: 'p1', slug: 'my-portal', accountId: 'acc1', isActive: false });

    const res = await request(buildApp()).post('/').send({ name: 'Test', slug: 'my-portal' });
    expect(res.status).toBe(201);
    expect(mockSendPortalLaunchedEmails).not.toHaveBeenCalled();
  });
});

describe('GET /:id — get portal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns portal for owner', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', agentId: 'agent1', slug: 'my-portal' });
    const res = await request(buildApp()).get('/p1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('p1');
  });

  it('returns 404 when portal not found', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(null);
    const res = await request(buildApp()).get('/missing');
    expect(res.status).toBe(404);
  });

  it('returns 403 when agent is not owner', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', agentId: 'other-agent' });
    const res = await request(buildApp('agent1')).get('/p1');
    expect(res.status).toBe(403);
  });
});

describe('PATCH /:id — partial update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccountEmailTarget.mockResolvedValue({ id: 'acc1', name: 'Acc', members: [] });
    mockSendPortalLaunchedEmails.mockResolvedValue(undefined);
  });

  it('updates portal fields', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', agentId: 'agent1' });
    mockPrisma.portal.update.mockResolvedValue({ id: 'p1', agentId: 'agent1', name: 'Updated Name' });

    const res = await request(buildApp()).patch('/p1').send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });

  it('blocks activation when agentEmail is missing', async () => {
    const { validateActivation } = await import('../../../services/agentPortalsService.js');
    vi.mocked(validateActivation).mockResolvedValue('agentEmail is required to activate');

    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', agentId: 'agent1', slug: 'my-portal', agentEmail: null });

    const res = await request(buildApp()).patch('/p1').send({ isActive: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('allows activation when slug and agentEmail are present, and notifies portal launched', async () => {
    const { validateActivation } = await import('../../../services/agentPortalsService.js');
    vi.mocked(validateActivation).mockResolvedValue(null);

    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', agentId: 'agent1', accountId: 'acc1', slug: 'my-portal', agentEmail: 'a@b.com', isActive: false });
    mockPrisma.portal.update.mockResolvedValue({ id: 'p1', agentId: 'agent1', slug: 'my-portal', isActive: true });

    const res = await request(buildApp()).patch('/p1').send({ isActive: true });
    expect(res.status).toBe(200);

    await vi.waitFor(() => expect(mockSendPortalLaunchedEmails).toHaveBeenCalledWith(
      expect.objectContaining({ portalId: 'p1' })
    ));
  });

  it('does not notify portal launched when isActive was already true (no transition)', async () => {
    const { validateActivation } = await import('../../../services/agentPortalsService.js');
    vi.mocked(validateActivation).mockResolvedValue(null);

    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', agentId: 'agent1', accountId: 'acc1', slug: 'my-portal', agentEmail: 'a@b.com', isActive: true });
    mockPrisma.portal.update.mockResolvedValue({ id: 'p1', agentId: 'agent1', slug: 'my-portal', isActive: true });

    const res = await request(buildApp()).patch('/p1').send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(mockSendPortalLaunchedEmails).not.toHaveBeenCalled();
  });
});

describe('DELETE /:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes portal for owner', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', agentId: 'agent1' });
    mockPrisma.portal.delete.mockResolvedValue({});

    const res = await request(buildApp()).delete('/p1');
    expect(res.status).toBe(204);
  });

  it('returns 403 when agent is not owner', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', agentId: 'other-agent' });
    const res = await request(buildApp('agent1')).delete('/p1');
    expect(res.status).toBe(403);
  });
});

describe('GET /:id — neighborhood in response', () => {
  beforeEach(() => vi.clearAllMocks());

  it('includes neighborhood relation in GET response', async () => {
    const portalWithNeighborhood = {
      id: 'p1',
      agentId: 'agent1',
      slug: 'my-portal',
      neighborhood: { id: 'n1', name: 'Lake Norman', zipCodes: ['28117'], geoRules: [] },
      featuredProperties: [],
    };
    mockPrisma.portal.findUnique.mockResolvedValue(portalWithNeighborhood);
    const res = await request(buildApp()).get('/p1');
    expect(res.status).toBe(200);
    expect(res.body.neighborhood).toBeDefined();
    expect(res.body.neighborhood.name).toBe('Lake Norman');
  });
});

describe('GET /:id/inquiries — list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', agentId: 'agent1' });
    mockPrisma.portalInquiry.groupBy.mockResolvedValue([
      { status: 'NEW', _count: { _all: 2 } },
      { status: 'READ', _count: { _all: 1 } },
    ]);
  });

  it('returns inquiries with per-status counts', async () => {
    mockPrisma.portalInquiry.findMany.mockResolvedValue([
      { id: 'i1', status: 'NEW', createdAt: new Date().toISOString() },
    ]);
    const res = await request(buildApp()).get('/p1/inquiries');
    expect(res.status).toBe(200);
    expect(res.body.inquiries).toHaveLength(1);
    expect(res.body.counts).toEqual({ NEW: 2, READ: 1, ARCHIVED: 0, RESPONDED: 0, total: 3 });
    expect(res.body.nextCursor).toBeNull();
  });

  it('includes RESPONDED (set by the AI lead-response pipeline, not this API) in total', async () => {
    // Regression: RESPONDED previously fell out of the per-status counts while
    // still being tallied into total, so "All" didn't match New+Read+Archived.
    mockPrisma.portalInquiry.groupBy.mockResolvedValue([
      { status: 'NEW', _count: { _all: 2 } },
      { status: 'RESPONDED', _count: { _all: 3 } },
    ]);
    mockPrisma.portalInquiry.findMany.mockResolvedValue([]);
    const res = await request(buildApp()).get('/p1/inquiries');
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ NEW: 2, READ: 0, ARCHIVED: 0, RESPONDED: 3, total: 5 });
  });

  it('sets nextCursor when a full page + 1 is returned', async () => {
    // Default page size is 20; return 21 so the route slices to 20 and pages.
    const rows = Array.from({ length: 21 }, (_, n) => ({
      id: `i${n}`,
      status: 'NEW',
      createdAt: new Date().toISOString(),
    }));
    mockPrisma.portalInquiry.findMany.mockResolvedValue(rows);
    const res = await request(buildApp()).get('/p1/inquiries');
    expect(res.status).toBe(200);
    expect(res.body.inquiries).toHaveLength(20);
    expect(res.body.nextCursor).toBe('i19');
  });

  it('rejects an invalid status filter with 400', async () => {
    const res = await request(buildApp()).get('/p1/inquiries?status=BOGUS');
    expect(res.status).toBe(400);
  });

  it('returns 403 when agent is not owner', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', agentId: 'other-agent' });
    const res = await request(buildApp('agent1')).get('/p1/inquiries');
    expect(res.status).toBe(403);
  });

  it('applies a valid status filter to the query', async () => {
    mockPrisma.portalInquiry.findMany.mockResolvedValue([]);
    const res = await request(buildApp()).get('/p1/inquiries?status=READ');
    expect(res.status).toBe(200);
    expect(mockPrisma.portalInquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { portalId: 'p1', status: 'READ' } })
    );
  });

  it('passes the cursor through to prisma for a subsequent page', async () => {
    mockPrisma.portalInquiry.findMany.mockResolvedValue([]);
    const res = await request(buildApp()).get('/p1/inquiries?cursor=i19');
    expect(res.status).toBe(200);
    expect(mockPrisma.portalInquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'i19' }, skip: 1 })
    );
  });

  it('honors a custom limit query param', async () => {
    mockPrisma.portalInquiry.findMany.mockResolvedValue([]);
    const res = await request(buildApp()).get('/p1/inquiries?limit=5');
    expect(res.status).toBe(200);
    // take is limit+1 (the route fetches one extra row to detect a next page).
    expect(mockPrisma.portalInquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 6 })
    );
  });

  it('caps an oversized limit at the max page size', async () => {
    mockPrisma.portalInquiry.findMany.mockResolvedValue([]);
    const res = await request(buildApp()).get('/p1/inquiries?limit=500');
    expect(res.status).toBe(200);
    expect(mockPrisma.portalInquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 51 })
    );
  });

  it('falls back to the default page size for limit=0 (falsy)', async () => {
    mockPrisma.portalInquiry.findMany.mockResolvedValue([]);
    const res = await request(buildApp()).get('/p1/inquiries?limit=0');
    expect(res.status).toBe(200);
    expect(mockPrisma.portalInquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 21 })
    );
  });

  it('clamps a negative limit up to a minimum of 1', async () => {
    mockPrisma.portalInquiry.findMany.mockResolvedValue([]);
    const res = await request(buildApp()).get('/p1/inquiries?limit=-5');
    expect(res.status).toBe(200);
    expect(mockPrisma.portalInquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 })
    );
  });

  it('falls back to the default page size for a non-numeric limit', async () => {
    mockPrisma.portalInquiry.findMany.mockResolvedValue([]);
    const res = await request(buildApp()).get('/p1/inquiries?limit=abc');
    expect(res.status).toBe(200);
    expect(mockPrisma.portalInquiry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 21 })
    );
  });

  it('skips the counts groupBy on a cursor-paginated (non-first) page', async () => {
    mockPrisma.portalInquiry.findMany.mockResolvedValue([]);
    const res = await request(buildApp()).get('/p1/inquiries?cursor=i19');
    expect(res.status).toBe(200);
    expect(mockPrisma.portalInquiry.groupBy).not.toHaveBeenCalled();
    expect(res.body.counts).toEqual({ NEW: 0, READ: 0, ARCHIVED: 0, RESPONDED: 0, total: 0 });
  });

  it('returns 404 when the portal does not exist', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(null);
    const res = await request(buildApp()).get('/missing/inquiries');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /:id/inquiries/:inquiryId — status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', agentId: 'agent1' });
  });

  it('updates status for an owned inquiry', async () => {
    mockPrisma.portalInquiry.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.portalInquiry.findUnique.mockResolvedValue({ id: 'i1', status: 'READ' });
    const res = await request(buildApp()).patch('/p1/inquiries/i1').send({ status: 'READ' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('READ');
    // Cross-portal guard: update is scoped to { id, portalId }.
    expect(mockPrisma.portalInquiry.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', portalId: 'p1', status: { not: 'RESPONDED' } },
      data: { status: 'READ' },
    });
  });

  it('rejects an invalid status with 400', async () => {
    const res = await request(buildApp()).patch('/p1/inquiries/i1').send({ status: 'BOGUS' });
    expect(res.status).toBe(400);
    expect(mockPrisma.portalInquiry.updateMany).not.toHaveBeenCalled();
  });

  it('returns 404 when the inquiry belongs to another portal (no rows updated)', async () => {
    mockPrisma.portalInquiry.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.portalInquiry.findFirst.mockResolvedValue(null);
    const res = await request(buildApp()).patch('/p1/inquiries/other').send({ status: 'READ' });
    expect(res.status).toBe(404);
  });

  it('returns 409 instead of 404 when the inquiry exists but is RESPONDED (terminal state)', async () => {
    // Regression: an ordinary "Archive" click on an already-answered lead must
    // not be able to move it out of RESPONDED — that status is the sole guard
    // against the AI lead-response pipeline sending a duplicate reply.
    mockPrisma.portalInquiry.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.portalInquiry.findFirst.mockResolvedValue({ status: 'RESPONDED' });
    const res = await request(buildApp()).patch('/p1/inquiries/i1').send({ status: 'ARCHIVED' });
    expect(res.status).toBe(409);
    expect(mockPrisma.portalInquiry.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', portalId: 'p1', status: { not: 'RESPONDED' } },
      data: { status: 'ARCHIVED' },
    });
  });

  it('returns 403 when agent is not owner', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', agentId: 'other-agent' });
    const res = await request(buildApp('agent1')).patch('/p1/inquiries/i1').send({ status: 'READ' });
    expect(res.status).toBe(403);
  });

  it('returns 404 when the portal does not exist', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(null);
    const res = await request(buildApp()).patch('/missing/inquiries/i1').send({ status: 'READ' });
    expect(res.status).toBe(404);
  });
});
