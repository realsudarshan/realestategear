import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  inquiry: { findUnique: vi.fn() },
  accountMember: { findFirst: vi.fn() },
}));
vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('../../../utils/logger.js', () => ({ default: { warn: vi.fn() } }));

const { fromInquiry } = await import('../../../services/leadContextService.js');

describe('fromInquiry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null for a missing inquiry', async () => {
    mockPrisma.inquiry.findUnique.mockResolvedValue(null);
    expect(await fromInquiry('missing')).toBeNull();
  });

  it('builds context from canonical snapshots and relations', async () => {
    mockPrisma.inquiry.findUnique.mockResolvedValue({
      id: 'inq-1', accountId: 'acc-1', visitorName: 'Ada Buyer', visitorEmail: 'ada@example.com',
      visitorPhone: '555-0100', message: 'Interested', contactPreference: 'EMAIL', createdAt: new Date('2026-07-01'),
      contact: { id: 'c-1', stage: 'NEW', tags: ['buyer'], source: 'portal', interactions: [{ id: 'x' }] },
      listing: null,
    });
    mockPrisma.accountMember.findFirst.mockResolvedValue({ userId: 'owner-1' });
    const context = await fromInquiry('inq-1');
    expect(context).toMatchObject({
      source: { type: 'inquiry', id: 'inq-1' },
      lead: { firstName: 'Ada', lastName: 'Buyer', contactId: 'c-1', priorInteractionCount: 1 },
      agentId: 'owner-1',
    });
  });
});
