import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = vi.hoisted(() => ({
  portal: { findUnique: vi.fn() },
  user: { findFirst: vi.fn() },
  listing: { findUnique: vi.fn() },
  geographicArea: { findFirst: vi.fn() },
  listingCollection: { findFirst: vi.fn() },
  contact: { upsert: vi.fn() },
  contactInteraction: { create: vi.fn() },
  inquiry: { create: vi.fn() },
  inquiryDelivery: { create: vi.fn() },
}));
const mockPrisma = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock('db', () => ({
  prisma: mockPrisma,
}));

const { createInquiry } = await import('../../../services/inquiryService.js');

describe('createInquiry transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback) => callback(tx));
    tx.portal.findUnique.mockResolvedValue({ id: 'p1', accountId: 'a1', isActive: true, agentEmail: 'owner@example.com', name: 'Portal' });
    tx.contact.upsert.mockResolvedValue({ id: 'c1' });
    tx.contactInteraction.create.mockResolvedValue({ id: 'x1' });
    tx.inquiry.create.mockResolvedValue({ id: 'i1' });
    tx.inquiryDelivery.create.mockResolvedValue({ id: 'd1' });
  });

  it('atomically deduplicates contacts by normalized account email and enqueues delivery', async () => {
    await createInquiry({ portalSlug: 'portal', visitorName: 'Ada Buyer', visitorEmail: ' ADA@Example.com ', message: 'Interested' });
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(tx.contact.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { accountId_normalizedEmail: { accountId: 'a1', normalizedEmail: 'ada@example.com' } },
    }));
    expect(tx.inquiry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ source: 'PORTAL_ANONYMOUS', contactId: 'c1' }) }));
    expect(tx.inquiryDelivery.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ idempotencyKey: 'owner-inquiry:i1' }) }));
  });

  it('uses the same unique contact upsert under concurrent submissions', async () => {
    await Promise.all([
      createInquiry({ portalSlug: 'portal', visitorName: 'Ada Buyer', visitorEmail: 'ada@example.com', message: 'One' }),
      createInquiry({ portalSlug: 'portal', visitorName: 'Ada Buyer', visitorEmail: 'ADA@example.com', message: 'Two' }),
    ]);
    expect(tx.contact.upsert).toHaveBeenCalledTimes(2);
    for (const call of tx.contact.upsert.mock.calls) {
      expect(call[0].where.accountId_normalizedEmail).toEqual({ accountId: 'a1', normalizedEmail: 'ada@example.com' });
    }
  });

  it('records authenticated source snapshots from the portal user', async () => {
    tx.user.findFirst.mockResolvedValue({ id: 'u1', email: 'user@example.com', firstName: 'Pat', lastName: 'Buyer', phoneNumber: null });
    await createInquiry({ portalSlug: 'portal', userId: 'u1', message: 'Authenticated inquiry' });
    expect(tx.inquiry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ source: 'PORTAL_AUTHENTICATED', userId: 'u1', visitorEmail: 'user@example.com' }) }));
  });

  it('validates attribution in portal scope and writes server-owned snapshots', async () => {
    tx.geographicArea.findFirst.mockResolvedValue({ id: 'area-1', slug: 'lake-norman', name: 'Lake Norman' });
    tx.listingCollection.findFirst.mockResolvedValue({ id: 'collection-1', slug: 'golf-homes', name: 'Golf homes' });
    await createInquiry({ portalSlug: 'portal', visitorName: 'Ada Buyer', visitorEmail: 'ada@example.com', message: 'Interested', areaSlug: 'lake-norman', collectionSlug: 'golf-homes' });
    expect(tx.geographicArea.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { accountId: 'a1', slug: 'lake-norman', isPublished: true } }));
    expect(tx.listingCollection.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { portalId: 'p1', slug: 'golf-homes', isPublished: true } }));
    expect(tx.inquiry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ areaId: 'area-1', collectionId: 'collection-1', areaSnapshot: JSON.stringify({ slug: 'lake-norman', name: 'Lake Norman' }), collectionSnapshot: JSON.stringify({ slug: 'golf-homes', name: 'Golf homes' }) }) }));
  });

  it('rejects unscoped attribution instead of trusting a client snapshot', async () => {
    tx.geographicArea.findFirst.mockResolvedValue(null);
    await expect(createInquiry({ portalSlug: 'portal', visitorName: 'Ada Buyer', visitorEmail: 'ada@example.com', message: 'Interested', areaSlug: 'other-account' })).rejects.toThrow('Area attribution is invalid');
    expect(tx.inquiry.create).not.toHaveBeenCalled();
  });
});
