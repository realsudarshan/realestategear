import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => {
  const inquiry = {
    groupBy: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  };
  return ({
  account: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  portalInquiry: inquiry,
  inquiry,
  portal: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
  });
});

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('../../../utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn() },
}));

const { default: express } = await import('express');
const { default: router } = await import('../../../routes/adminAccounts.js');
const { default: request } = await import('supertest');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/', router);
  return app;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeAccount(overrides = {}) {
  return {
    id: 'acc1',
    name: 'Acme',
    createdAt: new Date('2026-01-01'),
    portals: [{ id: 'p1', isActive: true }],
    ...overrides,
  };
}

// ─── GET / ───────────────────────────────────────────────────────────────────

describe('GET /', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portalInquiry.groupBy.mockResolvedValue([]);
    mockPrisma.portalInquiry.findMany.mockResolvedValue([]);
  });

  it('returns accounts array on happy path', async () => {
    mockPrisma.account.findMany.mockResolvedValue([makeAccount()]);
    // Provide recent activity so no_activity is not triggered
    mockPrisma.portalInquiry.groupBy.mockResolvedValue([
      { portalId: 'p1', _count: { id: 2 } },
    ]);

    const res = await request(buildApp()).get('/');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('acc1');
    expect(res.body[0].signals).toEqual([]);
  });

  it('emits no_activity signal when portal has no inquiries in 14d', async () => {
    mockPrisma.account.findMany.mockResolvedValue([
      makeAccount({ portals: [{ id: 'p1', isActive: true }] }),
    ]);
    // groupBy returns empty (no recent inquiries)
    mockPrisma.portalInquiry.groupBy.mockResolvedValue([]);

    const res = await request(buildApp()).get('/');

    expect(res.status).toBe(200);
    expect(res.body[0].signals).toContain('no_activity');
  });

  it('does NOT emit no_activity when portal has recent inquiries', async () => {
    mockPrisma.account.findMany.mockResolvedValue([
      makeAccount({ portals: [{ id: 'p1', isActive: true }] }),
    ]);
    // First groupBy call (14d cutoff) returns a hit
    mockPrisma.portalInquiry.groupBy.mockResolvedValueOnce([
      { portalId: 'p1', _count: { id: 5 } },
    ]);

    const res = await request(buildApp()).get('/');

    expect(res.body[0].signals).not.toContain('no_activity');
  });

  it('emits never_published when no portals are active', async () => {
    mockPrisma.account.findMany.mockResolvedValue([
      makeAccount({ portals: [{ id: 'p1', isActive: false }] }),
    ]);

    const res = await request(buildApp()).get('/');

    expect(res.body[0].signals).toContain('never_published');
  });

  it('emits both signals simultaneously', async () => {
    mockPrisma.account.findMany.mockResolvedValue([
      makeAccount({ portals: [{ id: 'p1', isActive: false }] }),
    ]);
    // no recent inquiries → no_activity
    mockPrisma.portalInquiry.groupBy.mockResolvedValue([]);

    const res = await request(buildApp()).get('/');

    expect(res.body[0].signals).toContain('no_activity');
    expect(res.body[0].signals).toContain('never_published');
  });

  it('handles accounts with no portals (empty allPortalIds)', async () => {
    mockPrisma.account.findMany.mockResolvedValue([
      makeAccount({ portals: [] }),
    ]);

    const res = await request(buildApp()).get('/');

    expect(res.status).toBe(200);
    expect(res.body[0].portalCount).toBe(0);
    // no_activity and never_published not emitted for accounts with no portals at all
    expect(res.body[0].signals).not.toContain('no_activity');
    expect(res.body[0].signals).not.toContain('never_published');
  });

  it('sums recentInquiryCount across multiple portals', async () => {
    mockPrisma.account.findMany.mockResolvedValue([
      makeAccount({ portals: [{ id: 'p1', isActive: true }, { id: 'p2', isActive: true }] }),
    ]);
    // 1st groupBy = 14d recent activity query
    // 2nd groupBy = 30d count query
    mockPrisma.portalInquiry.groupBy
      .mockResolvedValueOnce([
        { portalId: 'p1', _count: { id: 1 } },
        { portalId: 'p2', _count: { id: 1 } },
      ])
      .mockResolvedValueOnce([
        { portalId: 'p1', _count: { id: 3 } },
        { portalId: 'p2', _count: { id: 7 } },
      ]);
    mockPrisma.portalInquiry.findMany.mockResolvedValue([]);

    const res = await request(buildApp()).get('/');

    expect(res.body[0].recentInquiryCount).toBe(10);
  });

  it('picks max lastInquiryAt across multiple portals', async () => {
    const older = new Date('2026-05-01');
    const newer = new Date('2026-05-20');
    mockPrisma.account.findMany.mockResolvedValue([
      makeAccount({ portals: [{ id: 'p1', isActive: true }, { id: 'p2', isActive: true }] }),
    ]);
    mockPrisma.portalInquiry.groupBy.mockResolvedValue([]);
    mockPrisma.portalInquiry.findMany.mockResolvedValue([
      { portalId: 'p1', createdAt: older },
      { portalId: 'p2', createdAt: newer },
    ]);

    const res = await request(buildApp()).get('/');

    expect(new Date(res.body[0].lastInquiryAt).toISOString()).toBe(newer.toISOString());
  });

  it('calls next(error) when prisma throws', async () => {
    mockPrisma.account.findMany.mockRejectedValue(new Error('DB failure'));

    const app = express();
    app.use(express.json());
    app.use('/', router);
    // Error handler to capture the next(error) call
    app.use((err, req, res, next) => res.status(500).json({ error: err.message }));

    const res = await request(app).get('/');
    expect(res.status).toBe(500);
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

describe('GET /:id', () => {
  const accountDetail = {
    id: 'acc1',
    name: 'Acme',
    createdAt: new Date('2026-01-01'),
    members: [
      {
        id: 'mem1',
        role: 'OWNER',
        user: { email: 'owner@acme.com', firstName: 'Alice', lastName: 'Smith' },
      },
    ],
    portals: [
      { id: 'p1', name: 'Acme Portal', slug: 'acme', isActive: true, createdAt: new Date() },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portalInquiry.count.mockResolvedValue(0);
  });

  it('returns 404 when account does not exist', async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);

    const res = await request(buildApp()).get('/nonexistent-id');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Account not found');
  });

  it('returns account detail with portal inquiry counts on happy path', async () => {
    mockPrisma.account.findUnique.mockResolvedValue(accountDetail);
    mockPrisma.portalInquiry.count.mockResolvedValue(12);

    const res = await request(buildApp()).get('/acc1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('acc1');
    expect(res.body.portals[0].inquiryCount30d).toBe(12);
    expect(res.body.members).toHaveLength(1);
  });

  it('returns correct inquiryCount30d for each portal', async () => {
    const multiPortal = {
      ...accountDetail,
      portals: [
        { id: 'p1', name: 'Portal 1', slug: 's1', isActive: true, createdAt: new Date() },
        { id: 'p2', name: 'Portal 2', slug: 's2', isActive: false, createdAt: new Date() },
      ],
    };
    mockPrisma.account.findUnique.mockResolvedValue(multiPortal);
    mockPrisma.portalInquiry.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);

    const res = await request(buildApp()).get('/acc1');

    expect(res.body.portals[0].inquiryCount30d).toBe(5);
    expect(res.body.portals[1].inquiryCount30d).toBe(0);
  });

  it('calls next(error) when prisma throws', async () => {
    mockPrisma.account.findUnique.mockRejectedValue(new Error('DB failure'));

    const app = express();
    app.use(express.json());
    app.use('/', router);
    app.use((err, req, res, next) => res.status(500).json({ error: err.message }));

    const res = await request(app).get('/acc1');
    expect(res.status).toBe(500);
  });
});

// ─── PATCH /:accountId/portals/:portalId/suspend ───────────────────────────

describe('PATCH /:accountId/portals/:portalId/suspend', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a non-boolean suspended value', async () => {
    const res = await request(buildApp())
      .patch('/acc1/portals/p1/suspend')
      .send({ suspended: 'yes' });

    expect(res.status).toBe(400);
    expect(mockPrisma.portal.updateMany).not.toHaveBeenCalled();
  });

  it('returns 404 when the portal does not belong to the account', async () => {
    mockPrisma.portal.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(buildApp())
      .patch('/acc1/portals/p1/suspend')
      .send({ suspended: true });

    expect(res.status).toBe(404);
    expect(mockPrisma.portal.findUnique).not.toHaveBeenCalled();
  });

  it('sets suspendedAt when suspended is true, scoped to id + accountId', async () => {
    mockPrisma.portal.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', suspendedAt: new Date() });

    const res = await request(buildApp())
      .patch('/acc1/portals/p1/suspend')
      .send({ suspended: true });

    expect(res.status).toBe(200);
    expect(mockPrisma.portal.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', accountId: 'acc1' },
      data: { suspendedAt: expect.any(Date) },
    });
  });

  it('clears suspendedAt when suspended is false', async () => {
    mockPrisma.portal.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1', suspendedAt: null });

    const res = await request(buildApp())
      .patch('/acc1/portals/p1/suspend')
      .send({ suspended: false });

    expect(res.status).toBe(200);
    expect(mockPrisma.portal.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', accountId: 'acc1' },
      data: { suspendedAt: null },
    });
  });
});
