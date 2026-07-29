import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  accountMember: { findFirst: vi.fn() },
  portal: { findFirst: vi.fn() },
  inquiry: { findMany: vi.fn(), groupBy: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
}));
vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('../../../utils/logger.js', () => ({ default: { error: vi.fn() } }));
const { default: express } = await import('express');
const { default: request } = await import('supertest');
const { default: router, csvCell } = await import('../../../routes/ownerLeads.js');

function app(userId = 'owner-1') {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => { req.user = { id: userId }; next(); });
  instance.use('/', router);
  return instance;
}

const lead = {
  id: 'i1', accountId: 'a1', portalId: 'p1', status: 'NEW', source: 'PORTAL_ANONYMOUS',
  visitorName: 'Ada', visitorEmail: 'ada@example.com', visitorPhone: null, message: 'Hello', createdAt: new Date('2026-07-01'),
  portal: { name: 'Portal' }, listing: null,
};

describe('owner leads routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.accountMember.findFirst.mockResolvedValue({ accountId: 'a1' });
    mockPrisma.portal.findFirst.mockResolvedValue({ id: 'p1', accountId: 'a1' });
    mockPrisma.inquiry.findMany.mockResolvedValue([lead]);
    mockPrisma.inquiry.groupBy.mockResolvedValue([{ status: 'NEW', _count: { _all: 1 } }]);
  });

  it('requires current OWNER membership', async () => {
    mockPrisma.accountMember.findFirst.mockResolvedValue(null);
    const response = await request(app()).get('/?portalSlug=portal');
    expect(response.status).toBe(403);
    expect(mockPrisma.accountMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner-1', accountId: 'a1', role: 'OWNER' } }));
  });

  it('rejects cross-account portal scope', async () => {
    mockPrisma.portal.findFirst.mockResolvedValue(null);
    const response = await request(app()).get('/?portalId=other-account-portal');
    expect(response.status).toBe(403);
    expect(mockPrisma.inquiry.findMany).not.toHaveBeenCalled();
  });

  it('returns cursor pagination and stable status counts', async () => {
    mockPrisma.inquiry.findMany.mockResolvedValue([lead, { ...lead, id: 'i2' }]);
    const response = await request(app()).get('/?portalSlug=portal&limit=1');
    expect(response.status).toBe(200);
    expect(response.body.leads).toHaveLength(1);
    expect(response.body.nextCursor).toBe('i1');
    expect(response.body.counts).toMatchObject({ NEW: 1, READ: 0, RESPONDED: 0, ARCHIVED: 0, total: 1 });
  });

  it('scopes status writes and preserves responded state safety', async () => {
    mockPrisma.inquiry.findFirst.mockResolvedValue({ id: 'i1', respondedAt: null });
    mockPrisma.inquiry.update.mockResolvedValue({ ...lead, status: 'RESPONDED' });
    const response = await request(app()).patch('/i1?portalSlug=portal').send({ status: 'RESPONDED' });
    expect(response.status).toBe(200);
    expect(mockPrisma.inquiry.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'i1', accountId: 'a1', portalId: 'p1' } }));
    expect(mockPrisma.inquiry.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'RESPONDED', respondedAt: expect.any(Date) }) }));
  });

  it('returns 404 rather than updating an inquiry outside scope', async () => {
    mockPrisma.inquiry.findFirst.mockResolvedValue(null);
    const response = await request(app()).patch('/foreign?portalSlug=portal').send({ status: 'READ' });
    expect(response.status).toBe(404);
    expect(mockPrisma.inquiry.update).not.toHaveBeenCalled();
  });

  it('bounds CSV export and neutralizes spreadsheet formulas', async () => {
    mockPrisma.inquiry.findMany.mockResolvedValue([{ ...lead, visitorName: '=HYPERLINK("bad")' }]);
    const response = await request(app()).get('/export.csv?portalSlug=portal');
    expect(response.status).toBe(200);
    expect(response.text).toContain("'=HYPERLINK");
    expect(mockPrisma.inquiry.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1000 }));
    expect(csvCell('  +cmd')).toBe('"\'  +cmd"');
  });
});
