import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  accountMember: { findFirst: vi.fn() },
}));

vi.mock('db', () => ({ prisma: mockPrisma }));

const { requireOwner } = await import('../../../middleware/requireOwner.js');

function makeReqRes(user?: any) {
  const req: any = { user };
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
  };
  return { req, res, next: vi.fn() };
}

describe('requireOwner middleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when req.user is missing entirely', async () => {
    const { req, res, next } = makeReqRes();
    await requireOwner(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user.id is missing', async () => {
    const { req, res, next } = makeReqRes({ accountId: 'acc-1' });
    await requireOwner(req, res, next);
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when req.user.accountId is missing', async () => {
    const { req, res, next } = makeReqRes({ id: 'usr-1' });
    await requireOwner(req, res, next);
    expect(res.statusCode).toBe(401);
  });

  it('calls next() when the user is OWNER of the account', async () => {
    mockPrisma.accountMember.findFirst.mockResolvedValue({ role: 'OWNER' });
    const { req, res, next } = makeReqRes({ id: 'usr-1', accountId: 'acc-1' });
    await requireOwner(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.accountMember.findFirst).toHaveBeenCalledWith({
      where: { userId: 'usr-1', accountId: 'acc-1' },
      select: { role: true },
    });
  });

  it('returns 403 when the user is an AGENT (not OWNER)', async () => {
    mockPrisma.accountMember.findFirst.mockResolvedValue({ role: 'AGENT' });
    const { req, res, next } = makeReqRes({ id: 'usr-1', accountId: 'acc-1' });
    await requireOwner(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the user has no AccountMember record', async () => {
    mockPrisma.accountMember.findFirst.mockResolvedValue(null);
    const { req, res, next } = makeReqRes({ id: 'usr-1', accountId: 'acc-1' });
    await requireOwner(req, res, next);
    expect(res.statusCode).toBe(403);
  });

  it('forwards DB errors via next(err)', async () => {
    const dbErr = new Error('db down');
    mockPrisma.accountMember.findFirst.mockRejectedValueOnce(dbErr);
    const { req, res, next } = makeReqRes({ id: 'usr-1', accountId: 'acc-1' });
    await requireOwner(req, res, next);
    expect(next).toHaveBeenCalledWith(dbErr);
  });
});
