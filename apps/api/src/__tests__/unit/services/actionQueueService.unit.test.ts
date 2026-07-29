import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  aIAction: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  aIAuditLog: { create: vi.fn() },
}));

vi.mock('db', () => ({ prisma: mockPrisma }));

const {
  getQueue,
  getAction,
  reviewAction,
  dismissAction,
  snoozeAction,
} = await import('../../../services/actionQueueService.js');

const AGENT_ID = 'agent-1';
const ACTION_ID = 'action-1';

const baseAction = {
  id: ACTION_ID,
  userId: AGENT_ID,
  status: 'PENDING',
  toolType: 'LEAD_RESPONSE',
  decidedAt: null,
};

describe('ACTION_INCLUDE — property select regression', () => {
  it('does not select status or mlsId on property (those fields belong to Listing)', async () => {
    mockPrisma.aIAction.findMany.mockResolvedValue([]);
    mockPrisma.aIAction.count.mockResolvedValue(0);

    await getQueue(AGENT_ID, {});

    const includeArg = mockPrisma.aIAction.findMany.mock.calls[0][0].include;
    const propertySelect = includeArg?.property?.select ?? {};
    expect(propertySelect).not.toHaveProperty('status');
    expect(propertySelect).not.toHaveProperty('mlsId');
  });
});

describe('getQueue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses PENDING+FAILED+SNOOZED-expired default when no status filter given', async () => {
    mockPrisma.aIAction.findMany.mockResolvedValue([]);
    mockPrisma.aIAction.count.mockResolvedValue(0);

    await getQueue(AGENT_ID, {});

    const whereArg = mockPrisma.aIAction.findMany.mock.calls[0][0].where;
    expect(whereArg.OR).toBeDefined();
    expect(whereArg.status).toBeUndefined();
  });

  it('applies explicit status filter when provided', async () => {
    mockPrisma.aIAction.findMany.mockResolvedValue([]);
    mockPrisma.aIAction.count.mockResolvedValue(0);

    await getQueue(AGENT_ID, { status: 'DISMISSED' });

    const whereArg = mockPrisma.aIAction.findMany.mock.calls[0][0].where;
    expect(whereArg.status).toBe('DISMISSED');
    expect(whereArg.OR).toBeUndefined();
  });

  it('returns correct pagination shape', async () => {
    mockPrisma.aIAction.findMany.mockResolvedValue([{ id: 'a' }]);
    mockPrisma.aIAction.count.mockResolvedValue(30);

    const result = await getQueue(AGENT_ID, { page: '2', limit: '10' });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 30,
      totalPages: 3,
    });
    expect(mockPrisma.aIAction.findMany.mock.calls[0][0].skip).toBe(10);
  });

  it('applies contactId filter when provided', async () => {
    mockPrisma.aIAction.findMany.mockResolvedValue([]);
    mockPrisma.aIAction.count.mockResolvedValue(0);

    await getQueue(AGENT_ID, { contactId: 'c-123' });

    const where = mockPrisma.aIAction.findMany.mock.calls[0][0].where;
    expect(where.contactId).toBe('c-123');
  });
});

describe('getAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns action when found', async () => {
    mockPrisma.aIAction.findFirst.mockResolvedValue(baseAction);
    const result = await getAction(ACTION_ID, AGENT_ID);
    expect(result).toEqual(baseAction);
    expect(mockPrisma.aIAction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ACTION_ID, userId: AGENT_ID } }),
    );
  });

  it('returns null when not found', async () => {
    mockPrisma.aIAction.findFirst.mockResolvedValue(null);
    const result = await getAction('nope', AGENT_ID);
    expect(result).toBeNull();
  });
});

describe('reviewAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when action not found', async () => {
    mockPrisma.aIAction.findFirst.mockResolvedValue(null);
    const result = await reviewAction(ACTION_ID, AGENT_ID);
    expect(result).toBeNull();
  });

  it('sets decidedAt only if not already set (idempotent)', async () => {
    const alreadyDecided = { ...baseAction, decidedAt: new Date('2026-01-01') };
    mockPrisma.aIAction.findFirst.mockResolvedValue(alreadyDecided);
    mockPrisma.aIAction.update.mockResolvedValue(alreadyDecided);
    mockPrisma.aIAuditLog.create.mockResolvedValue({});

    await reviewAction(ACTION_ID, AGENT_ID);

    const data = mockPrisma.aIAction.update.mock.calls[0][0].data;
    expect(data.decidedAt).toEqual(alreadyDecided.decidedAt);
  });

  it('writes audit log with eventType action_reviewed', async () => {
    mockPrisma.aIAction.findFirst.mockResolvedValue(baseAction);
    mockPrisma.aIAction.update.mockResolvedValue(baseAction);
    mockPrisma.aIAuditLog.create.mockResolvedValue({});

    await reviewAction(ACTION_ID, AGENT_ID);

    expect(mockPrisma.aIAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'action_reviewed' }),
      }),
    );
  });
});

describe('dismissAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when action not found', async () => {
    mockPrisma.aIAction.findFirst.mockResolvedValue(null);
    expect(await dismissAction(ACTION_ID, AGENT_ID)).toBeNull();
  });

  it.each(['EXECUTED', 'SENT', 'DISMISSED', 'EXPIRED'])(
    'returns null when status is terminal (%s)',
    async (status) => {
      mockPrisma.aIAction.findFirst.mockResolvedValue({ ...baseAction, status });
      expect(await dismissAction(ACTION_ID, AGENT_ID)).toBeNull();
      expect(mockPrisma.aIAction.update).not.toHaveBeenCalled();
    },
  );

  it('updates status to DISMISSED for a PENDING action', async () => {
    mockPrisma.aIAction.findFirst.mockResolvedValue(baseAction);
    mockPrisma.aIAction.update.mockResolvedValue({ ...baseAction, status: 'DISMISSED' });
    mockPrisma.aIAuditLog.create.mockResolvedValue({});

    const result = await dismissAction(ACTION_ID, AGENT_ID, 'Not relevant');

    expect(mockPrisma.aIAction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DISMISSED' }) }),
    );
    expect(mockPrisma.aIAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'action_dismissed' }),
      }),
    );
  });
});

describe('snoozeAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when action not found', async () => {
    mockPrisma.aIAction.findFirst.mockResolvedValue(null);
    expect(await snoozeAction(ACTION_ID, AGENT_ID, new Date())).toBeNull();
  });

  it.each(['EXECUTED', 'SENT', 'DISMISSED', 'EXPIRED'])(
    'returns null when status is terminal (%s)',
    async (status) => {
      mockPrisma.aIAction.findFirst.mockResolvedValue({ ...baseAction, status });
      expect(await snoozeAction(ACTION_ID, AGENT_ID, new Date())).toBeNull();
    },
  );

  it('updates status to SNOOZED with the given until date', async () => {
    const until = new Date('2026-06-01T12:00:00Z');
    mockPrisma.aIAction.findFirst.mockResolvedValue(baseAction);
    mockPrisma.aIAction.update.mockResolvedValue({ ...baseAction, status: 'SNOOZED', snoozedUntil: until });
    mockPrisma.aIAuditLog.create.mockResolvedValue({});

    await snoozeAction(ACTION_ID, AGENT_ID, until);

    expect(mockPrisma.aIAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SNOOZED', snoozedUntil: until }),
      }),
    );
  });
});
