import { vi, describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const mockPrisma = vi.hoisted(() => ({
  account: { create: vi.fn() },
  user: { create: vi.fn() },
  accountMember: { create: vi.fn() },
  $transaction: vi.fn(),
}));

const mockSendWelcome = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockSendPasswordReset = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('email', () => ({
  sendWelcome: mockSendWelcome,
  sendPasswordReset: mockSendPasswordReset,
}));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../utils/googleOAuthWeb.js', () => ({
  getGoogleWebOAuthConfig: () => ({}),
  buildGoogleAuthorizeUrl: () => '',
  exchangeGoogleCode: vi.fn(),
  fetchGoogleUserInfo: vi.fn(),
  isGoogleEmailVerified: () => false,
}));

const { default: express } = await import('express');
const { default: router } = await import('../../../routes/auth.js');
const { default: request } = await import('supertest');

const VALID_BODY = {
  email: 'Agent@Example.com',
  password: 'pass1234',
  firstName: 'Jane',
  lastName: 'Smith',
  accountName: 'Smith Realty',
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/', router);
  return app;
}

describe('POST /register-agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
  });

  it('creates Account + User + AccountMember, returns 201 with JWT carrying accountId', async () => {
    mockPrisma.account.create.mockResolvedValue({ id: 'acc-1', name: 'Smith Realty' });
    mockPrisma.user.create.mockResolvedValue({
      id: 'usr-1',
      email: 'agent@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'AGENT',
      emailVerified: false,
      accountId: 'acc-1',
      portalId: null,
    });
    mockPrisma.accountMember.create.mockResolvedValue({ id: 'mem-1' });

    const res = await request(buildApp()).post('/register-agent').send(VALID_BODY);

    expect(res.status).toBe(201);
    const decoded = jwt.decode(res.body.token);
    expect(decoded.accountId).toBe('acc-1');
    expect(decoded.role).toBe('AGENT');

    const accountCall = mockPrisma.account.create.mock.calls[0][0];
    expect(accountCall.data).toEqual({ name: 'Smith Realty' });

    expect(mockPrisma.accountMember.create).toHaveBeenCalledWith({
      data: { accountId: 'acc-1', userId: 'usr-1', role: 'OWNER' },
    });
  });

  it('returns 409 on duplicate agent email (Prisma P2002)', async () => {
    mockPrisma.account.create.mockResolvedValue({ id: 'acc-x', name: 'X' });
    const dup = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    mockPrisma.user.create.mockRejectedValue(dup);

    const res = await request(buildApp())
      .post('/register-agent')
      .send({ ...VALID_BODY, email: 'dup@example.com', firstName: 'Dup', lastName: 'User', accountName: 'Dup Realty' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('returns 400 when accountName is missing', async () => {
    const body = { ...VALID_BODY };
    delete body.accountName;
    const res = await request(buildApp()).post('/register-agent').send(body);
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(buildApp())
      .post('/register-agent')
      .send({ ...VALID_BODY, password: 'short' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is invalid', async () => {
    const res = await request(buildApp())
      .post('/register-agent')
      .send({ ...VALID_BODY, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});
