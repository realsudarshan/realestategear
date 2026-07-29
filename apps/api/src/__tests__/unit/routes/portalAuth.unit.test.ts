import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const mockPrisma = vi.hoisted(() => ({
  portal: { findUnique: vi.fn() },
  user: { create: vi.fn(), findFirst: vi.fn() },
}));

const mockSendWelcome = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('email', () => ({
  sendWelcome: mockSendWelcome,
  sendPasswordReset: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../utils/googleOAuthWeb.js', () => ({
  getGoogleWebOAuthConfig: () => ({
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3001/api/auth/google/callback',
  }),
  buildGoogleAuthorizeUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth?mock=1',
  exchangeGoogleCode: vi.fn(),
  fetchGoogleUserInfo: vi.fn(),
  isGoogleEmailVerified: () => false,
  resolveOAuthCallbackBase: (authPurpose, rawCallbackBase) => {
    const expected = authPurpose === 'agent'
      ? (process.env.AGENT_HQ_URL || 'http://localhost:3002').replace(/\/$/, '')
      : (process.env.FRONTEND_URL || process.env.WEB_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const raw = (rawCallbackBase || '').replace(/\/$/, '');
    return raw === expected ? expected : null;
  },
}));

const { default: express } = await import('express');
const { default: portalAuthRouter } = await import('../../../routes/portalAuth.js');
const { default: request } = await import('supertest');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/portals', portalAuthRouter);
  return app;
}

const ACTIVE_PORTAL = { id: 'portal-1', accountId: 'acc-A', isActive: true };

describe('POST /api/portals/:slug/auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a User scoped to the portal and returns 201 with a JWT carrying portalId', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(ACTIVE_PORTAL);
    mockPrisma.user.create.mockResolvedValue({
      id: 'usr-1',
      email: 'buyer@example.com',
      firstName: 'Pat',
      lastName: 'Buyer',
      role: 'USER',
      emailVerified: false,
      accountId: 'acc-A',
      portalId: 'portal-1',
    });

    const res = await request(buildApp())
      .post('/api/portals/jane-smith/auth/register')
      .send({
        email: 'Buyer@example.com',
        password: 'pass1234',
        firstName: 'Pat',
        lastName: 'Buyer',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('buyer@example.com');
    expect(typeof res.body.token).toBe('string');

    const decoded = jwt.decode(res.body.token);
    expect(decoded.accountId).toBe('acc-A');
    expect(decoded.portalId).toBe('portal-1');
    expect(decoded.role).toBe('USER');

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'buyer@example.com',
        role: 'USER',
        accountId: 'acc-A',
        portalId: 'portal-1',
      }),
    });
  });

  it('returns 404 when the portal slug is unknown', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(null);
    const res = await request(buildApp())
      .post('/api/portals/missing/auth/register')
      .send({
        email: 'buyer@example.com',
        password: 'pass1234',
      });
    expect(res.status).toBe(404);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('returns 404 when the portal exists but is inactive', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue({ ...ACTIVE_PORTAL, isActive: false });
    const res = await request(buildApp())
      .post('/api/portals/jane-smith/auth/register')
      .send({
        email: 'buyer@example.com',
        password: 'pass1234',
      });
    expect(res.status).toBe(404);
  });

  it('returns 409 on duplicate email within the same portal', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(ACTIVE_PORTAL);
    const dup = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    mockPrisma.user.create.mockRejectedValue(dup);

    const res = await request(buildApp())
      .post('/api/portals/jane-smith/auth/register')
      .send({ email: 'buyer@example.com', password: 'pass1234' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('allows the same email on two different portals (separate User rows)', async () => {
    // First portal: create succeeds
    mockPrisma.portal.findUnique.mockResolvedValueOnce({ id: 'portal-A', accountId: 'acc-1', isActive: true });
    mockPrisma.user.create.mockResolvedValueOnce({
      id: 'usr-A', email: 'buyer@example.com', firstName: null, lastName: null,
      role: 'USER', emailVerified: false, accountId: 'acc-1', portalId: 'portal-A',
    });
    const r1 = await request(buildApp())
      .post('/api/portals/portal-a/auth/register')
      .send({ email: 'buyer@example.com', password: 'pass1234' });
    expect(r1.status).toBe(201);

    // Second portal: also succeeds (different portalId = different User row)
    mockPrisma.portal.findUnique.mockResolvedValueOnce({ id: 'portal-B', accountId: 'acc-2', isActive: true });
    mockPrisma.user.create.mockResolvedValueOnce({
      id: 'usr-B', email: 'buyer@example.com', firstName: null, lastName: null,
      role: 'USER', emailVerified: false, accountId: 'acc-2', portalId: 'portal-B',
    });
    const r2 = await request(buildApp())
      .post('/api/portals/portal-b/auth/register')
      .send({ email: 'buyer@example.com', password: 'pass1234' });
    expect(r2.status).toBe(201);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(buildApp())
      .post('/api/portals/jane-smith/auth/register')
      .send({ email: 'buyer@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/portals/:slug/auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs in a consumer for the matching portal', async () => {
    const passwordHash = await bcrypt.hash('pass1234', 4);
    mockPrisma.portal.findUnique.mockResolvedValue(ACTIVE_PORTAL);
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'usr-1',
      email: 'buyer@example.com',
      firstName: 'Pat',
      lastName: 'Buyer',
      password: passwordHash,
      role: 'USER',
      emailVerified: false,
      accountId: 'acc-A',
      portalId: 'portal-1',
    });

    const res = await request(buildApp())
      .post('/api/portals/jane-smith/auth/login')
      .send({ email: 'buyer@example.com', password: 'pass1234' });

    expect(res.status).toBe(200);
    const decoded = jwt.decode(res.body.token);
    expect(decoded.portalId).toBe('portal-1');
    expect(decoded.accountId).toBe('acc-A');

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: 'buyer@example.com',
        OR: [
          { portalId: 'portal-1' },
          { memberships: { some: { accountId: 'acc-A', role: 'OWNER' } } },
        ],
      },
    });
  });

  it('returns 401 when password is wrong', async () => {
    const passwordHash = await bcrypt.hash('correct', 4);
    mockPrisma.portal.findUnique.mockResolvedValue(ACTIVE_PORTAL);
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u', email: 'b@example.com', password: passwordHash,
      role: 'USER', accountId: 'acc-A', portalId: 'portal-1',
    });
    const res = await request(buildApp())
      .post('/api/portals/jane-smith/auth/login')
      .send({ email: 'b@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when user is not found on this portal', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(ACTIVE_PORTAL);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await request(buildApp())
      .post('/api/portals/jane-smith/auth/login')
      .send({ email: 'nobody@example.com', password: 'pass1234' });
    expect(res.status).toBe(401);
  });

  it('returns 404 when the portal does not exist', async () => {
    mockPrisma.portal.findUnique.mockResolvedValue(null);
    const res = await request(buildApp())
      .post('/api/portals/missing/auth/login')
      .send({ email: 'b@example.com', password: 'pass1234' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/portals/:slug/auth/google/start', () => {
  const originalAgentHqUrl = process.env.AGENT_HQ_URL;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AGENT_HQ_URL = 'http://localhost:3002';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    process.env.AGENT_HQ_URL = originalAgentHqUrl;
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it('redirects to Google when callback_base matches the portal frontend', async () => {
    const res = await request(buildApp())
      .get('/api/portals/jane-smith/auth/google/start')
      .query({ callback_base: 'http://localhost:3000' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
  });

  it('returns 400 instead of falling back when callback_base is the agent-hq domain', async () => {
    const res = await request(buildApp())
      .get('/api/portals/jane-smith/auth/google/start')
      .query({ callback_base: 'http://localhost:3002' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_callback_base');
  });

  it('returns 400 for an attacker-controlled callback_base', async () => {
    const res = await request(buildApp())
      .get('/api/portals/jane-smith/auth/google/start')
      .query({ callback_base: 'https://evil.example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_callback_base');
  });
});
