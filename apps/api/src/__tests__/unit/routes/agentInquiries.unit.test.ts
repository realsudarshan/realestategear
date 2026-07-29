import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  accountMember: { findFirst: vi.fn() },
  inquiry: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
}));
vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('../../../middleware/auth.js', () => ({ requireRole: () => (req, _res, next) => { req.user = { id: 'agent1', role: 'AGENT' }; next(); } }));
vi.mock('../../../utils/logger.js', () => ({ default: { error: vi.fn() } }));
const { default: express } = await import('express');
const { default: request } = await import('supertest');
const { default: router } = await import('../../../routes/agentInquiries.js');

function app() { const instance = express(); instance.use(express.json()); instance.use('/', router); return instance; }

describe('canonical Agent HQ inquiries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.accountMember.findFirst.mockResolvedValue({ accountId: 'acc1' });
    mockPrisma.inquiry.findMany.mockResolvedValue([]);
    mockPrisma.inquiry.count.mockResolvedValue(0);
  });

  it('lists anonymous and authenticated inquiries by account', async () => {
    mockPrisma.inquiry.findMany.mockResolvedValue([{ id: 'i1', userId: null, visitorName: 'Ada Buyer', visitorEmail: 'ada@example.com', listing: null }]);
    mockPrisma.inquiry.count.mockResolvedValue(1);
    const response = await request(app()).get('/');
    expect(response.status).toBe(200);
    expect(response.body.inquiries[0].user.email).toBe('ada@example.com');
    expect(mockPrisma.inquiry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ accountId: 'acc1' }) }));
  });

  it('scopes agent responses to account membership to block IDOR', async () => {
    mockPrisma.inquiry.updateMany.mockResolvedValue({ count: 0 });
    const denied = await request(app()).put('/foreign/respond').send({ agentResponse: 'Hello' });
    expect(denied.status).toBe(404);
    expect(mockPrisma.inquiry.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', accountId: 'acc1' } }));

    mockPrisma.inquiry.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.inquiry.findFirst.mockResolvedValue({ id: 'i1', status: 'RESPONDED' });
    const allowed = await request(app()).put('/i1/respond').send({ agentResponse: 'Hello' });
    expect(allowed.status).toBe(200);
  });
});
