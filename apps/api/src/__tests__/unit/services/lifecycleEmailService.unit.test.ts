import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  emailDelivery: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
const mockSendPlatformEmail = vi.hoisted(() => vi.fn());

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('email', () => ({
  PLATFORM_EMAIL_KINDS: {
    PORTAL_LAUNCHED: 'portal_launched',
    INTERNAL_PORTAL_LAUNCHED: 'internal_portal_launched',
  },
  buildPlatformEmail: vi.fn(() => ({ subject: 'Subject', text: 'Body' })),
  sendPlatformEmail: mockSendPlatformEmail,
}));
const mockLogger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('../../../utils/logger.js', () => ({ default: mockLogger }));

const {
  sendAccountLifecycleEmail,
  sendPortalLaunchedEmails,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} = await import('../../../services/lifecycleEmailService.js');

const account = {
  id: 'acc-1',
  name: 'Smith Realty',
  members: [{
    role: 'OWNER',
    user: {
      id: 'usr-1',
      email: 'agent@example.com',
      firstName: 'Jane',
      marketingEmailsOptOutAt: null,
    },
  }],
};

describe('lifecycleEmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_UNSUBSCRIBE_SECRET = 'test-secret';
    mockPrisma.emailDelivery.create.mockResolvedValue({ id: 'delivery-1' });
    mockPrisma.emailDelivery.update.mockResolvedValue({});
    mockPrisma.emailDelivery.delete.mockResolvedValue({});
    mockSendPlatformEmail.mockResolvedValue({ ok: true, id: 'em_1' });
  });

  it('logs successful lifecycle sends exactly once', async () => {
    const result = await sendAccountLifecycleEmail({ account, kind: 'portal_launched' });

    expect(result).toMatchObject({ ok: true, id: 'em_1' });
    expect(mockPrisma.emailDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'acc-1',
        userId: 'usr-1',
        kind: 'portal_launched',
        to: 'agent@example.com',
        subject: 'Subject',
      }),
    });
    expect(mockPrisma.emailDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: { providerId: 'em_1' },
    });
  });

  it('can use a separate delivery key without changing the template kind', async () => {
    await sendAccountLifecycleEmail({
      account,
      kind: 'portal_launched',
      deliveryKind: 'portal_launched:evt_123',
    });

    expect(mockPrisma.emailDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: 'portal_launched:evt_123' }),
    });
    expect(mockSendPlatformEmail).toHaveBeenCalledWith(expect.objectContaining({ kind: 'portal_launched' }));
  });

  it('does not claim delivery when the provider skips send', async () => {
    mockSendPlatformEmail.mockResolvedValue({ ok: false, skipped: true });

    const result = await sendAccountLifecycleEmail({ account, kind: 'portal_launched' });

    expect(result).toMatchObject({ ok: false, skipped: true });
    expect(mockPrisma.emailDelivery.delete).toHaveBeenCalledWith({ where: { id: 'delivery-1' } });
    expect(mockPrisma.emailDelivery.update).not.toHaveBeenCalled();
  });

  it('keeps the delivery row when provider success is followed by log update failure', async () => {
    mockPrisma.emailDelivery.update.mockRejectedValue(new Error('db down'));

    await expect(sendAccountLifecycleEmail({ account, kind: 'portal_launched' })).rejects.toThrow('db down');

    expect(mockSendPlatformEmail).toHaveBeenCalledOnce();
    expect(mockPrisma.emailDelivery.delete).not.toHaveBeenCalled();
  });

  it('skips opted-out owners before creating a delivery row', async () => {
    const result = await sendAccountLifecycleEmail({
      account: {
        ...account,
        members: [{
          role: 'OWNER',
          user: { ...account.members[0].user, marketingEmailsOptOutAt: new Date() },
        }],
      },
      kind: 'portal_launched',
    });

    expect(result).toMatchObject({ ok: false, skipped: true, reason: 'marketing_opt_out' });
    expect(mockPrisma.emailDelivery.create).not.toHaveBeenCalled();
  });

  it('returns already_sent when the delivery uniqueness guard fires', async () => {
    mockPrisma.emailDelivery.create.mockRejectedValue({ code: 'P2002' });

    const result = await sendAccountLifecycleEmail({ account, kind: 'portal_launched' });

    expect(result).toMatchObject({ ok: false, skipped: true, reason: 'already_sent' });
    expect(mockSendPlatformEmail).not.toHaveBeenCalled();
  });

  it('rethrows non-P2002 delivery creation errors without swallowing them', async () => {
    mockPrisma.emailDelivery.create.mockRejectedValue(new Error('connection refused'));

    await expect(sendAccountLifecycleEmail({ account, kind: 'portal_launched' })).rejects.toThrow('connection refused');
    expect(mockSendPlatformEmail).not.toHaveBeenCalled();
  });

  it('cleans up the delivery row when the provider send throws, so retries are not blocked', async () => {
    mockSendPlatformEmail.mockRejectedValue(new Error('provider timeout'));

    await expect(sendAccountLifecycleEmail({ account, kind: 'portal_launched' })).rejects.toThrow('provider timeout');

    expect(mockPrisma.emailDelivery.delete).toHaveBeenCalledWith({ where: { id: 'delivery-1' } });
    expect(mockPrisma.emailDelivery.update).not.toHaveBeenCalled();
  });

  it('logs when the cleanup delete itself fails, instead of swallowing it silently', async () => {
    mockSendPlatformEmail.mockRejectedValue(new Error('provider timeout'));
    mockPrisma.emailDelivery.delete.mockRejectedValue(new Error('db unreachable'));

    await expect(sendAccountLifecycleEmail({ account, kind: 'portal_launched' })).rejects.toThrow('provider timeout');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to clean up delivery row'),
      expect.objectContaining({ deliveryId: 'delivery-1', accountId: 'acc-1' })
    );
  });

  it('skips with missing_recipient when there is no owner and no explicit "to"', async () => {
    const result = await sendAccountLifecycleEmail({
      account: { ...account, members: [] },
      kind: 'portal_launched',
    });

    expect(result).toMatchObject({ ok: false, skipped: true, reason: 'missing_recipient' });
    expect(mockPrisma.emailDelivery.create).not.toHaveBeenCalled();
  });

  it('bypasses the opt-out check when ignoreOptOut is set, using the explicit "to" address', async () => {
    const result = await sendAccountLifecycleEmail({
      account: {
        ...account,
        members: [{
          role: 'OWNER',
          user: { ...account.members[0].user, marketingEmailsOptOutAt: new Date() },
        }],
      },
      kind: 'portal_launched',
      ignoreOptOut: true,
      to: 'internal@realestategear.com',
    });

    expect(result).toMatchObject({ ok: true });
    expect(mockPrisma.emailDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ to: 'internal@realestategear.com' }),
    });
  });

  it('keys portal-launched delivery by portal id, so a second portal for the same account is not deduped away', async () => {
    await sendPortalLaunchedEmails({ account, portalId: 'portal-1', portalName: 'First', portalSlug: 'first' });
    expect(mockPrisma.emailDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: 'portal_launched:portal-1' }),
    });
    expect(mockPrisma.emailDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: 'internal_portal_launched:portal-1' }),
    });

    vi.clearAllMocks();
    mockPrisma.emailDelivery.create.mockResolvedValue({ id: 'delivery-2' });
    mockPrisma.emailDelivery.update.mockResolvedValue({});
    mockSendPlatformEmail.mockResolvedValue({ ok: true, id: 'em_2' });

    await sendPortalLaunchedEmails({ account, portalId: 'portal-2', portalName: 'Second', portalSlug: 'second' });
    expect(mockPrisma.emailDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: 'portal_launched:portal-2' }),
    });
  });

  it('round-trips signed unsubscribe tokens and rejects tampering', () => {
    const token = signUnsubscribeToken('usr-1');

    expect(verifyUnsubscribeToken(token)).toBe('usr-1');
    expect(verifyUnsubscribeToken(token.replace('usr-1', 'usr-2'))).toBeNull();
  });

  it('rejects malformed unsubscribe tokens (no separator, empty string)', () => {
    expect(verifyUnsubscribeToken('')).toBeNull();
    expect(verifyUnsubscribeToken('no-dot-token')).toBeNull();
    expect(verifyUnsubscribeToken('usr-1.')).toBeNull();
  });
});
