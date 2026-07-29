import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  contact: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  contactInteraction: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  accountMember: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
}));

vi.mock('db', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../middleware/auth.js', () => ({
  requireRole: () => (req, res, next) => {
    req.user = { id: 'agent1', role: 'AGENT' };
    next();
  },
}));

vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../services/contactService.js', () => ({
  getContacts: vi.fn(),
  getContactById: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  addInteraction: vi.fn(),
  getInteractions: vi.fn(),
  updateInteraction: vi.fn(),
  deleteInteraction: vi.fn(),
}));

const { default: express } = await import('express');
const { default: router } = await import('../../../routes/agentContacts.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'agent1', role: 'AGENT' };
    next();
  });
  app.use('/', router);
  return app;
}

const { default: request } = await import('supertest');

describe('PUT /:id/link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.accountMember.findFirst.mockResolvedValue({ id: 'mem1', accountId: 'acc1' });
  });

  it('returns 400 if email not provided', async () => {
    const res = await request(buildApp()).put('/c1/link').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 if contact not found', async () => {
    mockPrisma.contact.findFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .put('/c1/link')
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Contact not found');
  });

  it('returns 404 if portal user not found', async () => {
    mockPrisma.contact.findFirst.mockResolvedValue({ id: 'c1', userId: null });
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .put('/c1/link')
      .send({ email: 'nobody@test.com' });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('No portal user');
  });

  it('returns 409 if already linked to different user', async () => {
    mockPrisma.contact.findFirst.mockResolvedValue({ id: 'c1', userId: 'u-other' });
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'u-new' });

    const res = await request(buildApp())
      .put('/c1/link')
      .send({ email: 'new@test.com' });
    expect(res.status).toBe(409);
  });

  it('links contact to portal user', async () => {
    mockPrisma.contact.findFirst.mockResolvedValue({ id: 'c1', userId: null });
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1' });
    mockPrisma.contact.update.mockResolvedValue({ id: 'c1', userId: 'u1' });

    const res = await request(buildApp())
      .put('/c1/link')
      .send({ email: 'Test@Example.COM' });
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    });
  });
});

describe('DELETE /:id/link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.accountMember.findFirst.mockResolvedValue({ id: 'mem1', accountId: 'acc1' });
  });

  it('returns 404 if contact not found', async () => {
    mockPrisma.contact.findFirst.mockResolvedValue(null);

    const res = await request(buildApp()).delete('/c1/link');
    expect(res.status).toBe(404);
  });

  it('unlinks contact from portal user', async () => {
    mockPrisma.contact.findFirst.mockResolvedValue({ id: 'c1', userId: 'u1' });
    mockPrisma.contact.update.mockResolvedValue({});

    const res = await request(buildApp()).delete('/c1/link');
    expect(res.status).toBe(204);
    expect(mockPrisma.contact.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { userId: null },
    });
  });
});
