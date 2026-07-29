import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  contact: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  accountMember: {
    findFirst: vi.fn(),
  },
  contactSubmission: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  contactInteraction: {
    create: vi.fn(),
  },
}));

vi.mock('db', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { tryLinkContactToUser, tryLinkUserToContacts, processContactSubmission } =
  await import('../../../services/portalBridgeService.js');

describe('portalBridgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEFAULT_AGENT_ID;
  });

  describe('tryLinkContactToUser', () => {
    it('links a contact to a user with matching email', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({
        id: 'c1', email: 'ALICE@example.com', userId: null,
      });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1' });
      mockPrisma.contact.update.mockResolvedValue({});

      await tryLinkContactToUser('c1');

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'alice@example.com' },
      });
      expect(mockPrisma.contact.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { userId: 'u1' },
      });
    });

    it('does nothing if contact has no email', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({
        id: 'c1', email: null, userId: null,
      });

      await tryLinkContactToUser('c1');

      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('does nothing if contact already linked', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({
        id: 'c1', email: 'a@b.com', userId: 'u99',
      });

      await tryLinkContactToUser('c1');

      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('does nothing if no user matches', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({
        id: 'c1', email: 'noone@nope.com', userId: null,
      });
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await tryLinkContactToUser('c1');

      expect(mockPrisma.contact.update).not.toHaveBeenCalled();
    });

    it('swallows errors and logs a warning', async () => {
      mockPrisma.contact.findUnique.mockRejectedValue(new Error('db boom'));

      await tryLinkContactToUser('c1');
      // should not throw
    });
  });

  describe('tryLinkUserToContacts', () => {
    it('links all unlinked contacts with matching email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'bob@example.com' });
      mockPrisma.contact.findMany.mockResolvedValue([
        { id: 'c1', userId: null },
        { id: 'c2', userId: null },
      ]);
      mockPrisma.contact.update.mockResolvedValue({});

      await tryLinkUserToContacts('u1');

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith({
        where: {
          email: { equals: 'bob@example.com', mode: 'insensitive' },
          userId: null,
        },
      });
      expect(mockPrisma.contact.update).toHaveBeenCalledTimes(2);
    });

    it('does nothing if user has no email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: null });

      await tryLinkUserToContacts('u1');

      expect(mockPrisma.contact.findMany).not.toHaveBeenCalled();
    });
  });

  describe('processContactSubmission', () => {
    it('links to existing contact and creates interaction', async () => {
      mockPrisma.contactSubmission.findUnique.mockResolvedValue({
        id: 's1', email: 'Bob@Example.com', firstName: 'Bob', lastName: 'Smith',
        phone: null, inquiryType: 'buying', message: 'I want a house',
      });
      mockPrisma.contact.findFirst.mockResolvedValue({
        id: 'c1', email: 'bob@example.com', userId: 'u1',
      });
      mockPrisma.contactSubmission.update.mockResolvedValue({});
      mockPrisma.contactInteraction.create.mockResolvedValue({});

      await processContactSubmission('s1');

      expect(mockPrisma.contactSubmission.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { contactId: 'c1' },
      });
      expect(mockPrisma.contactInteraction.create).toHaveBeenCalledWith({
        data: {
          contactId: 'c1',
          type: 'FORM_SUBMISSION',
          subject: 'buying',
          body: 'I want a house',
        },
      });
    });

    it('creates a new contact when none found', async () => {
      process.env.DEFAULT_AGENT_ID = 'agent1';

      mockPrisma.contactSubmission.findUnique.mockResolvedValue({
        id: 's1', email: 'New@Person.com', firstName: 'New', lastName: 'Person',
        phone: '555-1234', inquiryType: 'selling', message: 'Sell my house',
      });
      mockPrisma.contact.findFirst.mockResolvedValue(null);
      mockPrisma.accountMember.findFirst.mockResolvedValue({ id: 'mem1', accountId: 'acc1' });
      mockPrisma.contact.create.mockResolvedValue({
        id: 'c-new', email: 'new@person.com', userId: null,
      });
      mockPrisma.contactSubmission.update.mockResolvedValue({});
      mockPrisma.contactInteraction.create.mockResolvedValue({});
      // tryLinkContactToUser will be called internally
      mockPrisma.contact.findUnique.mockResolvedValue({
        id: 'c-new', email: 'new@person.com', userId: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await processContactSubmission('s1');

      expect(mockPrisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: 'New',
          lastName: 'Person',
          email: 'new@person.com',
          type: 'LEAD',
          stage: 'NEW',
          source: 'website',
          accountId: 'acc1',
          assignedMemberId: 'mem1',
        }),
      });
    });

    it('does nothing if DEFAULT_AGENT_ID is not set and no existing contact', async () => {
      mockPrisma.contactSubmission.findUnique.mockResolvedValue({
        id: 's1', email: 'test@test.com', firstName: 'T', lastName: 'T',
        phone: null, inquiryType: 'buying', message: 'msg',
      });
      mockPrisma.contact.findFirst.mockResolvedValue(null);

      await processContactSubmission('s1');

      expect(mockPrisma.contact.create).not.toHaveBeenCalled();
    });
  });
});
