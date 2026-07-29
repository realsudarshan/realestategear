import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Prisma mock ────────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  transaction: {
    findFirst: vi.fn(),
  },
  transactionSyncRun: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  transactionDiscoveredMessage: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  transactionDiscoveredAttachment: {
    upsert: vi.fn(),
  },
  transactionDiscoveredContact: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  contact: {
    findFirst: vi.fn(),
  },
}));

vi.mock('db', () => ({ prisma: mockPrisma }));

// ─── Google auth mock ───────────────────────────────────────────────────────

const mockGetAuthorizedAccount = vi.hoisted(() => vi.fn());
vi.mock('../../../services/googleWorkspaceService.js', () => ({
  getAuthorizedAccount: mockGetAuthorizedAccount,
}));

// ─── OpenAI mock ────────────────────────────────────────────────────────────

const mockOpenAICreate = vi.hoisted(() => vi.fn());
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockOpenAICreate,
      },
    },
  })),
}));

// ─── fetch mock (global) ────────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── Import after mocks ─────────────────────────────────────────────────────

const {
  buildSyncQuery,
  runTransactionSync,
  confirmDiscoveredMessage,
  dismissDiscoveredMessage,
  getDiscoveredMessages,
} = await import('../../../services/transactionSyncService.js');

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockOpenAI(category = 'CONTRACT', confidence = 0.92) {
  mockOpenAICreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ category, confidence }) } }],
  });
}

function gmailMessagesResponse(ids = ['msg-1']) {
  return { messages: ids.map((id) => ({ id })) };
}

function gmailMessageDetailResponse({
  id = 'msg-1',
  threadId = 'thread-1',
  snippet = 'Purchase agreement enclosed',
  subject = 'Purchase Agreement - 123 Main St',
  from = 'alice@example.com',
  attachments = [],
} = {}) {
  return {
    id,
    threadId,
    snippet,
    payload: {
      headers: [
        { name: 'Subject', value: subject },
        { name: 'From', value: `Alice <${from}>` },
        { name: 'To', value: 'agent@example.com' },
        { name: 'Date', value: 'Mon, 1 Jan 2024 12:00:00 +0000' },
      ],
      parts: attachments.map((a) => ({
        filename: a.filename,
        mimeType: a.mimeType || 'application/pdf',
        body: { attachmentId: a.id, size: a.size || 12000 },
      })),
    },
  };
}

// ─── buildSyncQuery ─────────────────────────────────────────────────────────

describe('buildSyncQuery', () => {
  it('includes address and party emails in the query', async () => {
    const transaction = {
      address: '123 Main St, Seattle, WA 98101',
      createdAt: new Date('2024-01-01'),
      closingDate: new Date('2024-03-01'),
      parties: [
        { contact: { email: 'buyer@example.com' } },
        { contact: { email: 'seller@example.com' } },
      ],
    };

    const query = await buildSyncQuery(transaction);

    expect(query).toContain('"123 Main St"');
    expect(query).toContain('buyer@example.com');
    expect(query).toContain('seller@example.com');
    expect(query).toContain('-label:spam');
    expect(query).toContain('-label:promotions');
  });

  it('strips city/state from address — keeps street only', async () => {
    const transaction = {
      address: '456 Oak Ave, Portland, OR 97201',
      createdAt: new Date('2024-01-01'),
      parties: [],
    };

    const query = await buildSyncQuery(transaction);

    expect(query).toContain('"456 Oak Ave"');
    expect(query).not.toContain('Portland');
  });

  it('returns empty string when there is no address and no party emails', async () => {
    const transaction = {
      address: null,
      createdAt: new Date('2024-01-01'),
      parties: [],
    };

    const query = await buildSyncQuery(transaction);

    expect(query).toBe('');
  });

  it('builds query with only party emails when address is missing', async () => {
    const transaction = {
      address: null,
      createdAt: new Date('2024-01-01'),
      parties: [{ contact: { email: 'lender@bank.com' } }],
    };

    const query = await buildSyncQuery(transaction);

    expect(query).toContain('lender@bank.com');
    expect(query).not.toBe('');
  });

  it('skips party entries with null email', async () => {
    const transaction = {
      address: '789 Pine Rd',
      createdAt: new Date('2024-01-01'),
      parties: [
        { contact: { email: null } },
        { contact: { email: 'valid@example.com' } },
      ],
    };

    const query = await buildSyncQuery(transaction);

    expect(query).toContain('valid@example.com');
    expect(query).not.toContain('null');
  });
});

// ─── runTransactionSync ─────────────────────────────────────────────────────

describe('runTransactionSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAuthorizedAccount.mockResolvedValue({ accessToken: 'tok-abc' });

    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      address: '123 Main St',
      createdAt: new Date('2024-01-01'),
      closingDate: new Date('2024-03-01'),
      parties: [{ contact: { email: 'buyer@example.com' } }],
    });

    mockPrisma.transactionSyncRun.create.mockResolvedValue({ id: 'run-1' });
    mockPrisma.transactionSyncRun.update.mockResolvedValue({});

    // Gmail search returns one message
    mockFetch.mockImplementation((url) => {
      if (url.includes('/messages?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(gmailMessagesResponse(['msg-1'])),
        });
      }
      if (url.includes('/messages/msg-1')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(gmailMessageDetailResponse()),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    mockOpenAI('CONTRACT', 0.91);

    mockPrisma.transactionDiscoveredMessage.findUnique.mockResolvedValue(null);
    mockPrisma.transactionDiscoveredMessage.upsert.mockResolvedValue({ id: 'dm-1' });
    mockPrisma.transactionDiscoveredContact.findFirst.mockResolvedValue(null);
    mockPrisma.contact.findFirst.mockResolvedValue(null);
    mockPrisma.transactionDiscoveredContact.create.mockResolvedValue({});
  });

  it('returns syncRunId immediately (202 pattern)', async () => {
    const result = await runTransactionSync('tx-1', 'agent-1');
    expect(result).toEqual({ syncRunId: 'run-1' });
  });

  it('creates a RUNNING sync run with the built query', async () => {
    await runTransactionSync('tx-1', 'agent-1');
    expect(mockPrisma.transactionSyncRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionId: 'tx-1',
          status: 'RUNNING',
          query: expect.stringContaining('123 Main St'),
        }),
      })
    );
  });

  it('throws 404 when transaction not found / not owned by agent', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue(null);
    await expect(runTransactionSync('tx-missing', 'agent-1')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('throws 400 when transaction has no signals for a query', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-blank',
      address: null,
      createdAt: new Date(),
      closingDate: null,
      parties: [],
    });
    await expect(runTransactionSync('tx-blank', 'agent-1')).rejects.toMatchObject({
      status: 400,
    });
  });
});

// ─── Upsert idempotency ─────────────────────────────────────────────────────

describe('DISMISSED message idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAuthorizedAccount.mockResolvedValue({ accessToken: 'tok-abc' });
    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      address: '123 Main St',
      createdAt: new Date('2024-01-01'),
      closingDate: new Date('2024-03-01'),
      parties: [],
    });
    mockPrisma.transactionSyncRun.create.mockResolvedValue({ id: 'run-1' });
    mockPrisma.transactionSyncRun.update.mockResolvedValue({});

    mockFetch.mockImplementation((url) => {
      if (url.includes('/messages?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(gmailMessagesResponse(['msg-dismissed'])),
        });
      }
      if (url.includes('/messages/msg-dismissed')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(gmailMessageDetailResponse({ id: 'msg-dismissed' })),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    mockOpenAI('GENERAL_COMMS', 0.8);

    // The message is already DISMISSED
    mockPrisma.transactionDiscoveredMessage.findUnique.mockResolvedValue({
      id: 'dm-old',
      status: 'DISMISSED',
    });
  });

  it('does not upsert a DISMISSED message on re-sync', async () => {
    await runTransactionSync('tx-1', 'agent-1');

    // Give the async processSyncRun a tick to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockPrisma.transactionDiscoveredMessage.upsert).not.toHaveBeenCalled();
  });
});

// ─── confirm / dismiss ──────────────────────────────────────────────────────

describe('confirmDiscoveredMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.transactionDiscoveredMessage.findFirst.mockResolvedValue({
      id: 'dm-1',
      status: 'PENDING',
    });
    mockPrisma.transactionDiscoveredMessage.update.mockResolvedValue({});
  });

  it('sets status to CONFIRMED', async () => {
    const result = await confirmDiscoveredMessage('dm-1', 'agent-1');
    expect(result).toEqual({ id: 'dm-1', status: 'CONFIRMED' });
    expect(mockPrisma.transactionDiscoveredMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dm-1' },
        data: { status: 'CONFIRMED' },
      })
    );
  });

  it('throws 404 when message not found or belongs to another agent', async () => {
    mockPrisma.transactionDiscoveredMessage.findFirst.mockResolvedValue(null);
    await expect(confirmDiscoveredMessage('dm-missing', 'agent-1')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('dismissDiscoveredMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.transactionDiscoveredMessage.findFirst.mockResolvedValue({
      id: 'dm-1',
      status: 'PENDING',
    });
    mockPrisma.transactionDiscoveredMessage.update.mockResolvedValue({});
  });

  it('sets status to DISMISSED', async () => {
    const result = await dismissDiscoveredMessage('dm-1', 'agent-1');
    expect(result).toEqual({ id: 'dm-1', status: 'DISMISSED' });
    expect(mockPrisma.transactionDiscoveredMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'DISMISSED' },
      })
    );
  });
});

// ─── getDiscoveredMessages ──────────────────────────────────────────────────

describe('getDiscoveredMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.transaction.findFirst.mockResolvedValue({ id: 'tx-1' });
    mockPrisma.transactionDiscoveredMessage.findMany.mockResolvedValue([
      { id: 'dm-1', status: 'PENDING', category: 'CONTRACT', attachments: [], contacts: [] },
      { id: 'dm-2', status: 'CONFIRMED', category: 'OFFER', attachments: [], contacts: [] },
    ]);
  });

  it('returns messages for the transaction', async () => {
    const messages = await getDiscoveredMessages('tx-1', 'agent-1');
    expect(messages).toHaveLength(2);
  });

  it('passes status filter through to the query', async () => {
    await getDiscoveredMessages('tx-1', 'agent-1', { status: 'PENDING' });
    expect(mockPrisma.transactionDiscoveredMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { transactionId: 'tx-1', status: 'PENDING' },
      })
    );
  });

  it('throws 404 when transaction not found', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue(null);
    await expect(getDiscoveredMessages('tx-missing', 'agent-1')).rejects.toMatchObject({
      status: 404,
    });
  });
});
