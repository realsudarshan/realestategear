import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  portal: {
    findUnique: vi.fn(),
  },
  portalDomain: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const mockResolveTxt = vi.hoisted(() => vi.fn());

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('node:dns/promises', () => ({ resolveTxt: mockResolveTxt }));

const {
  createDomain,
  listDomainsForPortal,
  removeDomain,
  setCanonicalDomain,
  verificationTxtRecordName,
  verifyDomain,
} = await import('../../../services/portalDomainService.js');

describe('portalDomainService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('createDomain', () => {
    beforeEach(() => {
      mockPrisma.portal.findUnique.mockResolvedValue({ id: 'p1' });
    });

    it('rejects an invalid hostname', async () => {
      await expect(createDomain('p1', 'not a domain')).rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.portalDomain.create).not.toHaveBeenCalled();
    });

    it('creates a pending domain', async () => {
      mockPrisma.portalDomain.create.mockResolvedValue({ id: 'd1', hostname: 'example.com' });

      const domain = await createDomain('p1', 'Example.com');
      expect(domain).toEqual({ id: 'd1', hostname: 'example.com' });
      expect(mockPrisma.portalDomain.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ portalId: 'p1', hostname: 'example.com', kind: 'APEX' }),
      });
    });

    it('classifies a www hostname', async () => {
      mockPrisma.portalDomain.create.mockResolvedValue({ id: 'd1' });
      await createDomain('p1', 'www.example.com');
      expect(mockPrisma.portalDomain.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ kind: 'WWW' }),
      });
    });

    it('returns 409 on a duplicate hostname', async () => {
      mockPrisma.portalDomain.create.mockRejectedValue({ code: 'P2002' });
      await expect(createDomain('p1', 'example.com')).rejects.toMatchObject({ statusCode: 409 });
    });

    it('returns 404 when the portal does not exist', async () => {
      mockPrisma.portal.findUnique.mockResolvedValue(null);
      await expect(createDomain('missing', 'example.com')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('verifyDomain', () => {
    it('activates the domain when the TXT record matches', async () => {
      mockPrisma.portalDomain.findFirst.mockResolvedValue({
        id: 'd1',
        portalId: 'p1',
        hostname: 'example.com',
        status: 'PENDING',
        verificationToken: 'abc123',
      });
      mockResolveTxt.mockResolvedValue([['abc123']]);
      mockPrisma.portalDomain.update.mockResolvedValue({ id: 'd1', status: 'ACTIVE' });

      const result = await verifyDomain('p1', 'd1');
      expect(mockResolveTxt).toHaveBeenCalledWith(verificationTxtRecordName('example.com'));
      expect(mockPrisma.portalDomain.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      });
      expect(result).toEqual({ id: 'd1', status: 'ACTIVE' });
    });

    it('rejects when the TXT record is missing', async () => {
      mockPrisma.portalDomain.findFirst.mockResolvedValue({
        id: 'd1',
        portalId: 'p1',
        hostname: 'example.com',
        status: 'PENDING',
        verificationToken: 'abc123',
      });
      mockResolveTxt.mockResolvedValue([['some-other-value']]);

      await expect(verifyDomain('p1', 'd1')).rejects.toMatchObject({ statusCode: 422 });
      expect(mockPrisma.portalDomain.update).not.toHaveBeenCalled();
    });

    it('treats a DNS lookup failure (NXDOMAIN) as unverified, not a server error', async () => {
      mockPrisma.portalDomain.findFirst.mockResolvedValue({
        id: 'd1',
        portalId: 'p1',
        hostname: 'example.com',
        status: 'PENDING',
        verificationToken: 'abc123',
      });
      mockResolveTxt.mockRejectedValue(Object.assign(new Error('NXDOMAIN'), { code: 'ENOTFOUND' }));

      await expect(verifyDomain('p1', 'd1')).rejects.toMatchObject({ statusCode: 422 });
    });

    it('is idempotent for an already-active domain', async () => {
      const active = { id: 'd1', portalId: 'p1', status: 'ACTIVE' };
      mockPrisma.portalDomain.findFirst.mockResolvedValue(active);

      const result = await verifyDomain('p1', 'd1');
      expect(result).toBe(active);
      expect(mockResolveTxt).not.toHaveBeenCalled();
    });

    it('rejects verifying a removed domain', async () => {
      mockPrisma.portalDomain.findFirst.mockResolvedValue({ id: 'd1', portalId: 'p1', status: 'REMOVED' });
      await expect(verifyDomain('p1', 'd1')).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('setCanonicalDomain', () => {
    it('requires the domain to be active first', async () => {
      mockPrisma.portalDomain.findFirst.mockResolvedValue({ id: 'd1', portalId: 'p1', status: 'PENDING' });
      await expect(setCanonicalDomain('p1', 'd1')).rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('unsets other canonical domains and sets this one in a single transaction', async () => {
      mockPrisma.portalDomain.findFirst.mockResolvedValue({ id: 'd1', portalId: 'p1', status: 'ACTIVE' });
      mockPrisma.$transaction.mockResolvedValue([{ count: 1 }, { id: 'd1', canonical: true }]);

      const result = await setCanonicalDomain('p1', 'd1');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: 'd1', canonical: true });
    });
  });

  describe('removeDomain', () => {
    it('deletes the domain row', async () => {
      mockPrisma.portalDomain.findFirst.mockResolvedValue({ id: 'd1', portalId: 'p1' });
      await removeDomain('p1', 'd1');
      expect(mockPrisma.portalDomain.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
    });

    it('404s for a domain that does not belong to the portal', async () => {
      mockPrisma.portalDomain.findFirst.mockResolvedValue(null);
      await expect(removeDomain('p1', 'd1')).rejects.toMatchObject({ statusCode: 404 });
      expect(mockPrisma.portalDomain.delete).not.toHaveBeenCalled();
    });
  });

  describe('listDomainsForPortal', () => {
    it('lists domains ordered by creation', async () => {
      mockPrisma.portalDomain.findMany.mockResolvedValue([{ id: 'd1' }]);
      const result = await listDomainsForPortal('p1');
      expect(mockPrisma.portalDomain.findMany).toHaveBeenCalledWith({
        where: { portalId: 'p1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual([{ id: 'd1' }]);
    });
  });
});
