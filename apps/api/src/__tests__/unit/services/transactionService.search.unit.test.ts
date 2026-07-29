import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  accountMember: {
    findFirst: vi.fn(),
  },
  transaction: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
}));

const transactionServicePath = new URL('../../../services/transactionService.js', import.meta.url).href;

vi.mock('db', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../services/transactionDocumentService.js', () => ({
  ensureTransactionDocumentsForTransaction: vi.fn(),
}));

vi.mock('../../../search/index.js', () => ({
  upsertDocument: vi.fn(),
  deleteDocument: vi.fn(),
  toTransactionDoc: vi.fn((t) => t),
}));

const { getTransactions, getTransactionById } = await import(transactionServicePath);

describe('transactionService.getTransactions — search filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.accountMember.findFirst.mockResolvedValue({ accountId: 'acct-1', userId: 'user-1' });
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    mockPrisma.transaction.count.mockResolvedValue(0);
  });

  it('does not add an OR clause when search is absent', async () => {
    await getTransactions('user-1', { page: 1, limit: 10 });
    const whereArg = mockPrisma.transaction.findMany.mock.calls[0][0].where;
    expect(whereArg).toEqual({ accountId: 'acct-1' });
    expect(whereArg.OR).toBeUndefined();
  });

  it('ignores search strings shorter than 2 characters', async () => {
    await getTransactions('user-1', { search: 'a' });
    const whereArg = mockPrisma.transaction.findMany.mock.calls[0][0].where;
    expect(whereArg.OR).toBeUndefined();
  });

  it('ignores whitespace-only search strings', async () => {
    await getTransactions('user-1', { search: '   ' });
    const whereArg = mockPrisma.transaction.findMany.mock.calls[0][0].where;
    expect(whereArg.OR).toBeUndefined();
  });

  it('builds an OR clause matching Transaction.address, property address/city, and party contact names', async () => {
    await getTransactions('user-1', { search: 'Charlie' });
    const whereArg = mockPrisma.transaction.findMany.mock.calls[0][0].where;
    expect(whereArg.accountId).toBe('acct-1');
    expect(whereArg.OR).toBeDefined();
    expect(whereArg.OR).toHaveLength(4);

    const [directAddress, propAddress, propCity, partiesMatch] = whereArg.OR;
    expect(directAddress).toEqual({ address: { contains: 'Charlie', mode: 'insensitive' } });
    expect(propAddress).toEqual({ property: { address: { contains: 'Charlie', mode: 'insensitive' } } });
    expect(propCity).toEqual({ property: { city: { contains: 'Charlie', mode: 'insensitive' } } });
    expect(partiesMatch).toEqual({
      parties: {
        some: {
          contact: {
            OR: [
              { firstName: { contains: 'Charlie', mode: 'insensitive' } },
              { lastName: { contains: 'Charlie', mode: 'insensitive' } },
            ],
          },
        },
      },
    });
  });

  it('trims surrounding whitespace from the search query', async () => {
    await getTransactions('user-1', { search: '  Smith  ' });
    const whereArg = mockPrisma.transaction.findMany.mock.calls[0][0].where;
    expect(whereArg.OR[0].address.contains).toBe('Smith');
    expect(whereArg.OR[1].property.address.contains).toBe('Smith');
  });

  it('uses Prisma case-insensitive mode for every contains filter', async () => {
    await getTransactions('user-1', { search: 'oak' });
    const whereArg = mockPrisma.transaction.findMany.mock.calls[0][0].where;
    expect(whereArg.OR[0].address.mode).toBe('insensitive');
    expect(whereArg.OR[1].property.address.mode).toBe('insensitive');
    expect(whereArg.OR[2].property.city.mode).toBe('insensitive');
    expect(whereArg.OR[3].parties.some.contact.OR[0].firstName.mode).toBe('insensitive');
    expect(whereArg.OR[3].parties.some.contact.OR[1].lastName.mode).toBe('insensitive');
  });

  it('combines search with existing stage and type filters', async () => {
    await getTransactions('user-1', { search: 'oak', stage: 'PENDING', type: 'PURCHASE' });
    const whereArg = mockPrisma.transaction.findMany.mock.calls[0][0].where;
    expect(whereArg).toMatchObject({
      accountId: 'acct-1',
      stage: 'PENDING',
      type: 'PURCHASE',
    });
    expect(whereArg.OR).toBeDefined();
  });
});

describe('transactionService.getTransactionById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.transaction.findUnique.mockResolvedValue(null);
  });

  it('includes the latest property listing for Agent HQ property links', async () => {
    await getTransactionById('txn-1');

    expect(mockPrisma.transaction.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'txn-1' },
        include: expect.objectContaining({
          property: {
            select: expect.objectContaining({
              id: true,
              address: true,
              city: true,
              state: true,
              listings: {
                select: { id: true, status: true, listDate: true, createdAt: true },
                orderBy: [{ listDate: 'desc' }, { createdAt: 'desc' }],
                take: 1,
              },
            }),
          },
        }),
      })
    );
  });
});
