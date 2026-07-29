import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  portal: {
    findUnique: vi.fn(),
  },
  accountMember: {
    findFirst: vi.fn(),
  },
}));

const mockDomainService = vi.hoisted(() => ({
  listDomainsForPortal: vi.fn(),
  createDomain: vi.fn(),
  verifyDomain: vi.fn(),
  setCanonicalDomain: vi.fn(),
  removeDomain: vi.fn(),
}));

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@aws-sdk/client-s3', () => ({ S3Client: vi.fn(), PutObjectCommand: vi.fn() }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://presigned-url'),
}));
vi.mock('../../../services/lifecycleEmailService.js', () => ({
  getAccountEmailTarget: vi.fn(),
  sendPortalLaunchedEmails: vi.fn(),
}));
vi.mock('../../../services/portalDomainService.js', () => mockDomainService);

// agentPortalsService (checkOwnership, etc.) is NOT mocked here, unlike
// agentPortals.unit.test.ts — running it for real against mockPrisma means
// these tests also confirm the domain routes are ownership-gated, matching
// every other /:id/* route in this router.

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

describe('portal domain routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.portal.findUnique.mockImplementation(async ({ where: { id } }: any) =>
      id === 'p1' ? { id: 'p1', accountId: 'acc1' } : null
    );
    mockPrisma.accountMember.findFirst.mockImplementation(async ({ where: { accountId, userId } }: any) =>
      accountId === 'acc1' && userId === 'agent1' ? { id: 'mem1', accountId, userId } : null
    );
  });

  it('GET /:id/domains lists domains for the owning agent', async () => {
    mockDomainService.listDomainsForPortal.mockResolvedValue([{ id: 'd1', hostname: 'example.com' }]);
    const res = await request(buildApp()).get('/p1/domains');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'd1', hostname: 'example.com' }]);
  });

  it('GET /:id/domains is forbidden for an agent who is not on the account', async () => {
    const res = await request(buildApp('someone-else')).get('/p1/domains');
    expect(res.status).toBe(403);
    expect(mockDomainService.listDomainsForPortal).not.toHaveBeenCalled();
  });

  it('GET /:id/domains 404s for a portal that does not exist', async () => {
    const res = await request(buildApp()).get('/missing/domains');
    expect(res.status).toBe(404);
    expect(mockDomainService.listDomainsForPortal).not.toHaveBeenCalled();
  });

  it('POST /:id/domains requires a hostname', async () => {
    const res = await request(buildApp()).post('/p1/domains').send({});
    expect(res.status).toBe(400);
    expect(mockDomainService.createDomain).not.toHaveBeenCalled();
  });

  it('POST /:id/domains creates a domain', async () => {
    mockDomainService.createDomain.mockResolvedValue({ id: 'd1', hostname: 'example.com', status: 'PENDING' });
    const res = await request(buildApp()).post('/p1/domains').send({ hostname: 'example.com' });
    expect(res.status).toBe(201);
    expect(mockDomainService.createDomain).toHaveBeenCalledWith('p1', 'example.com');
  });

  it('POST /:id/domains surfaces entitlement errors with the service status code', async () => {
    mockDomainService.createDomain.mockRejectedValue(
      Object.assign(new Error('Your plan does not include custom domains.'), { statusCode: 403 })
    );
    const res = await request(buildApp()).post('/p1/domains').send({ hostname: 'example.com' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/custom domains/);
  });

  it('POST /:id/domains/:domainId/verify verifies via the service', async () => {
    mockDomainService.verifyDomain.mockResolvedValue({ id: 'd1', status: 'ACTIVE' });
    const res = await request(buildApp()).post('/p1/domains/d1/verify');
    expect(res.status).toBe(200);
    expect(mockDomainService.verifyDomain).toHaveBeenCalledWith('p1', 'd1');
  });

  it('PATCH /:id/domains/:domainId/canonical sets canonical via the service', async () => {
    mockDomainService.setCanonicalDomain.mockResolvedValue({ id: 'd1', canonical: true });
    const res = await request(buildApp()).patch('/p1/domains/d1/canonical');
    expect(res.status).toBe(200);
    expect(mockDomainService.setCanonicalDomain).toHaveBeenCalledWith('p1', 'd1');
  });

  it('DELETE /:id/domains/:domainId removes via the service', async () => {
    mockDomainService.removeDomain.mockResolvedValue(undefined);
    const res = await request(buildApp()).delete('/p1/domains/d1');
    expect(res.status).toBe(204);
    expect(mockDomainService.removeDomain).toHaveBeenCalledWith('p1', 'd1');
  });
});
