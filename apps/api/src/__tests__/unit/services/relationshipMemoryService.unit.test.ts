/**
 * Tests for relationshipMemoryService.scanForAgent:
 *  - Empty candidate list → 0/0/0
 *  - OVERDUE_TASK rule fires and creates action
 *  - ACTIVE_NO_ACTIVITY rule fires
 *  - STALE_LEAD rule fires
 *  - PAST_CLIENT_CHECKIN rule fires
 *  - De-duplication: higher-priority rule wins for same contactId
 *  - maybeCreateAction idempotency: existing active action → skipped
 *  - Per-contact error increments errors count
 *  - Outer scan error increments errors count
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  accountMember: { findFirst: vi.fn() },
  task: { findMany: vi.fn() },
  contact: { findMany: vi.fn() },
  aIAction: { findMany: vi.fn(), create: vi.fn() },
}));

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { scanForAgent } = await import('../../../services/relationshipMemoryService.js');

const AGENT_ID = 'agent-1';
const NOW = new Date();
const PAST = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

function makeContact(overrides: Record<string, any> = {}) {
  return {
    id: 'contact-1',
    firstName: 'Jane',
    lastName: 'Smith',
    lastInteractionAt: null,
    lastConsultAt: null,
    type: 'LEAD',
    stage: 'ACTIVE',
    ...overrides,
  };
}

function makeTask(overrides: Record<string, any> = {}) {
  return {
    id: 'task-1',
    title: 'Call Jane',
    dueDate: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    contact: makeContact(),
    ...overrides,
  };
}

// All rules return no results (default empty state)
function mockAllRulesEmpty() {
  mockPrisma.task.findMany.mockResolvedValue([]);
  mockPrisma.contact.findMany.mockResolvedValue([]);
}

describe('scanForAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllRulesEmpty();
    mockPrisma.accountMember.findFirst.mockResolvedValue({ accountId: 'acc-1' });
    // Pre-fetch returns [] by default (no existing active actions)
    mockPrisma.aIAction.findMany.mockResolvedValue([]);
    mockPrisma.aIAction.create.mockResolvedValue({ id: 'action-1' });
  });

  it('returns { created:0, skipped:0, errors:0 } when all rules return no candidates', async () => {
    const result = await scanForAgent(AGENT_ID);
    expect(result).toEqual({ created: 0, skipped: 0, errors: 0 });
  });

  it('returns empty result when agent has no account membership', async () => {
    mockPrisma.accountMember.findFirst.mockResolvedValue(null);
    const result = await scanForAgent(AGENT_ID);
    expect(result).toEqual({ created: 0, skipped: 0, errors: 0 });
    expect(mockPrisma.task.findMany).not.toHaveBeenCalled();
  });

  it('OVERDUE_TASK rule: creates action when overdue task exists', async () => {
    mockPrisma.task.findMany.mockResolvedValue([makeTask()]);

    const result = await scanForAgent(AGENT_ID);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockPrisma.aIAction.create).toHaveBeenCalledOnce();
    const createCall = mockPrisma.aIAction.create.mock.calls[0][0];
    expect(createCall.data.toolType).toBe('RELATIONSHIP_MEMORY');
    expect(createCall.data.payload.rule).toBe('OVERDUE_TASK');
    expect(createCall.data.priority).toBe(3); // OVERDUE_TASK is highest priority
  });

  it('ACTIVE_NO_ACTIVITY rule: creates action when active contact has no recent interaction', async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.contact.findMany
      .mockResolvedValueOnce([makeContact({ id: 'c-1', stage: 'ACTIVE', lastInteractionAt: PAST })])
      .mockResolvedValue([]);

    const result = await scanForAgent(AGENT_ID);
    expect(result.created).toBe(1);
    const createCall = mockPrisma.aIAction.create.mock.calls[0][0];
    expect(createCall.data.payload.rule).toBe('ACTIVE_NO_ACTIVITY');
    expect(createCall.data.priority).toBe(2);
  });

  it('STALE_LEAD rule: creates action for lead with no interaction in 14+ days', async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.contact.findMany
      .mockResolvedValueOnce([]) // ACTIVE_NO_ACTIVITY
      .mockResolvedValueOnce([]) // QUALIFIED_NO_CONSULT
      .mockResolvedValueOnce([makeContact({ id: 'c-1', type: 'LEAD', stage: 'NEW', lastInteractionAt: PAST })])
      .mockResolvedValue([]);

    const result = await scanForAgent(AGENT_ID);
    expect(result.created).toBe(1);
    const createCall = mockPrisma.aIAction.create.mock.calls[0][0];
    expect(createCall.data.payload.rule).toBe('STALE_LEAD');
  });

  it('PAST_CLIENT_CHECKIN rule: creates action for client with no interaction in 90+ days', async () => {
    const oldDate = new Date(NOW.getTime() - 100 * 24 * 60 * 60 * 1000);
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.contact.findMany
      .mockResolvedValueOnce([]) // ACTIVE_NO_ACTIVITY
      .mockResolvedValueOnce([]) // QUALIFIED_NO_CONSULT
      .mockResolvedValueOnce([]) // STALE_LEAD
      .mockResolvedValueOnce([makeContact({ id: 'c-1', type: 'CLIENT', lastInteractionAt: oldDate })]);

    const result = await scanForAgent(AGENT_ID);
    expect(result.created).toBe(1);
    const createCall = mockPrisma.aIAction.create.mock.calls[0][0];
    expect(createCall.data.payload.rule).toBe('PAST_CLIENT_CHECKIN');
  });

  it('de-duplication: higher-priority rule wins when same contactId appears in multiple rules', async () => {
    const contact = makeContact({ id: 'contact-shared' });
    // OVERDUE_TASK (priority 3) and STALE_LEAD (priority 1) for same contact
    mockPrisma.task.findMany.mockResolvedValue([
      makeTask({ contact }),
    ]);
    mockPrisma.contact.findMany
      .mockResolvedValueOnce([]) // ACTIVE_NO_ACTIVITY
      .mockResolvedValueOnce([]) // QUALIFIED_NO_CONSULT
      .mockResolvedValueOnce([contact]) // STALE_LEAD — same contact
      .mockResolvedValue([]);

    const result = await scanForAgent(AGENT_ID);
    // Should create only 1 action (higher-priority wins)
    expect(result.created).toBe(1);
    expect(mockPrisma.aIAction.create).toHaveBeenCalledOnce();
    const createCall = mockPrisma.aIAction.create.mock.calls[0][0];
    expect(createCall.data.payload.rule).toBe('OVERDUE_TASK'); // priority 3 wins over priority 1
  });

  it('maybeCreateAction idempotency: skips when active action already exists', async () => {
    mockPrisma.task.findMany.mockResolvedValue([makeTask()]);
    // Pre-fetch returns the candidate's contactId — signals an active action exists.
    mockPrisma.aIAction.findMany.mockResolvedValue([{ sourceId: 'contact-1' }]);

    const result = await scanForAgent(AGENT_ID);
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
    expect(mockPrisma.aIAction.create).not.toHaveBeenCalled();
  });

  it('per-contact error: increments errors and continues processing remaining candidates', async () => {
    const c1 = makeContact({ id: 'c-1' });
    const c2 = makeContact({ id: 'c-2', firstName: 'Bob', lastName: 'Jones' });
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.contact.findMany
      .mockResolvedValueOnce([c1, c2]) // ACTIVE_NO_ACTIVITY
      .mockResolvedValue([]);

    // Throw on the first create call (c-1) to simulate a per-contact DB error.
    let callCount = 0;
    mockPrisma.aIAction.create.mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error('DB connection timeout');
      return { id: 'action-2' };
    });

    const result = await scanForAgent(AGENT_ID);
    expect(result.errors).toBe(1);
    expect(result.created).toBe(1); // second contact succeeds
  });

  it('outer scan error: increments errors:1 and returns early when findCandidates throws', async () => {
    mockPrisma.task.findMany.mockRejectedValue(new Error('DB down'));

    const result = await scanForAgent(AGENT_ID);
    expect(result).toEqual({ created: 0, skipped: 0, errors: 1 });
  });

  it('respects maxItems cap', async () => {
    // Create 5 contacts all matching ACTIVE_NO_ACTIVITY
    const contacts = Array.from({ length: 5 }, (_, i) =>
      makeContact({ id: `c-${i}`, firstName: 'Contact', lastName: String(i) }),
    );
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.contact.findMany
      .mockResolvedValueOnce(contacts)
      .mockResolvedValue([]);

    const result = await scanForAgent(AGENT_ID, { maxItems: 2 });
    // Only 2 actions created despite 5 candidates
    expect(mockPrisma.aIAction.create).toHaveBeenCalledTimes(2);
    expect(result.created).toBe(2);
  });
});
