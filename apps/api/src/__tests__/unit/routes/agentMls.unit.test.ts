import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  accountMlsAccess: { findFirst: vi.fn() },
}));

const mockVerify = vi.hoisted(() => vi.fn());

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('../../../services/mlsVerificationService.js', () => ({
  verifyAndLinkMlsAccess: mockVerify,
}));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { default: express } = await import('express');
const { default: router } = await import('../../../routes/agentMls.js');
const { default: request } = await import('supertest');

function buildApp(accountId = 'acc1') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user1', accountId, role: 'AGENT' };
    next();
  });
  app.use('/', router);
  return app;
}

describe('GET /status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns { verified: false } when no access record exists', async () => {
    mockPrisma.accountMlsAccess.findFirst.mockResolvedValue(null);
    const res = await request(buildApp()).get('/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ verified: false });
  });

  it('returns verified status with details when a record exists', async () => {
    const ts = new Date('2026-06-01T00:00:00.000Z');
    mockPrisma.accountMlsAccess.findFirst.mockResolvedValue({
      mlsBoardId: 'CanopyMLS',
      membershipId: '12345',
      verifiedAt: ts,
    });
    const res = await request(buildApp()).get('/status');
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.membershipId).toBe('12345');
    expect(res.body.mlsBoardId).toBe('CanopyMLS');
  });
});

describe('POST /verify', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when mlsId is missing', async () => {
    const res = await request(buildApp()).post('/verify').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when mlsId is not a string', async () => {
    const res = await request(buildApp()).post('/verify').send({ mlsId: 42 });
    expect(res.status).toBe(400);
  });

  it('calls verifyAndLinkMlsAccess and returns the result', async () => {
    mockVerify.mockResolvedValue({ status: 'verified', accessId: 'a1', agent: { name: 'Jane', email: null } });
    const res = await request(buildApp()).post('/verify').send({ mlsId: '12345' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('verified');
    expect(mockVerify).toHaveBeenCalledWith('acc1', '12345');
  });

  it('returns not_found result from the service', async () => {
    mockVerify.mockResolvedValue({ status: 'not_found' });
    const res = await request(buildApp()).post('/verify').send({ mlsId: '99999' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('not_found');
  });

  it('propagates errors to the next middleware', async () => {
    mockVerify.mockRejectedValue(new Error('db down'));
    const app = buildApp();
    app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
    const res = await request(app).post('/verify').send({ mlsId: '12345' });
    expect(res.status).toBe(500);
  });
});
