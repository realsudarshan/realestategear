import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  user: { update: vi.fn() },
}));
const mockVerifyUnsubscribeToken = vi.hoisted(() => vi.fn());

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('../../../services/lifecycleEmailService.js', () => ({
  verifyUnsubscribeToken: mockVerifyUnsubscribeToken,
}));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { default: express } = await import('express');
const { default: request } = await import('supertest');
const { default: router } = await import('../../../routes/email.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/email', router);
  return app;
}

describe('GET /api/email/unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for a missing token', async () => {
    mockVerifyUnsubscribeToken.mockReturnValue(null);

    const res = await request(buildApp()).get('/api/email/unsubscribe');

    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid or tampered token', async () => {
    mockVerifyUnsubscribeToken.mockReturnValue(null);

    const res = await request(buildApp()).get('/api/email/unsubscribe?token=bad.sig');

    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('marks the user opted out and returns 200 for a valid token', async () => {
    mockVerifyUnsubscribeToken.mockReturnValue('usr-1');
    mockPrisma.user.update.mockResolvedValue({});

    const res = await request(buildApp()).get('/api/email/unsubscribe?token=usr-1.sig');

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'usr-1' },
      data: { marketingEmailsOptOutAt: expect.any(Date) },
    });
  });

  it('returns 500 when the opt-out write fails', async () => {
    mockVerifyUnsubscribeToken.mockReturnValue('usr-1');
    mockPrisma.user.update.mockRejectedValue(new Error('db down'));

    const res = await request(buildApp()).get('/api/email/unsubscribe?token=usr-1.sig');

    expect(res.status).toBe(500);
  });
});
