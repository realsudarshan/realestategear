/**
 * Tests for the pure / deterministic logic in transactionRiskService:
 *  - collectRiskFactors (pure, but exported only via analyzeAndQueue — tested via scanForAgent mock pattern)
 *  - buildDeterministicSummary / buildDeterministicNextStep / buildSuggestedTask
 *  - highestSeverity
 *  - scanForAgent error handling and created/skipped counting
 *
 * The module is tested by importing it fresh after hoisting mocks so we can
 * exercise the internal pure helpers via the public scanForAgent function.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  transaction: { findMany: vi.fn() },
  aIAction: { findMany: vi.fn(), create: vi.fn() },
}));
const mockOpenAI = vi.hoisted(() => ({
  chat: { completions: { create: vi.fn() } },
}));

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = mockOpenAI.chat;
  },
}));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { scanForAgent } = await import('../../../services/transactionRiskService.js');

const AGENT_ID = 'agent-1';
const NOW = new Date();

// Helper: build a minimal transaction object
function makeTx(overrides: Record<string, any> = {}) {
  return {
    id: 'tx-1',
    address: '100 Oak Ave',
    type: 'PURCHASE',
    stage: 'PENDING',
    closingDate: null,
    inspectionContingencyDate: null,
    financingContingencyDate: null,
    appraisalContingencyDate: null,
    titleContingencyDate: null,
    tasks: [],
    documents: [],
    ...overrides,
  };
}

describe('scanForAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Pre-fetch returns [] by default (no existing active actions)
    mockPrisma.aIAction.findMany.mockResolvedValue([]);
  });

  it('returns { created:0, skipped:0, errors:0 } when no active transactions', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    const result = await scanForAgent(AGENT_ID);
    expect(result).toEqual({ created: 0, skipped: 0, errors: 0 });
  });

  it('returns errors:1 when fetchActiveTransactions throws', async () => {
    mockPrisma.transaction.findMany.mockRejectedValue(new Error('DB down'));
    const result = await scanForAgent(AGENT_ID);
    expect(result.errors).toBe(1);
  });

  it('skips transactions with no risk factors', async () => {
    // A clean transaction: no overdue tasks, no contingencies, no missing docs, no close date
    mockPrisma.transaction.findMany.mockResolvedValue([makeTx()]);

    const result = await scanForAgent(AGENT_ID);

    expect(result).toEqual({ created: 0, skipped: 1, errors: 0 });
    expect(mockPrisma.aIAction.create).not.toHaveBeenCalled();
  });

  it('skips when an active AIAction already exists for the transaction', async () => {
    const overdueDue = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
    const tx = makeTx({ tasks: [{ id: 't1', title: 'Sign docs', dueDate: overdueDue, status: 'TODO' }] });
    mockPrisma.transaction.findMany.mockResolvedValue([tx]);
    // Pre-fetch returns the transaction's sourceId — signals an active action exists.
    mockPrisma.aIAction.findMany.mockResolvedValue([{ sourceId: 'tx-1' }]);

    const result = await scanForAgent(AGENT_ID);

    expect(result).toEqual({ created: 0, skipped: 1, errors: 0 });
    expect(mockPrisma.aIAction.create).not.toHaveBeenCalled();
  });

  it('creates an action for MEDIUM severity (overdue task, no closing date)', async () => {
    const overdueDue = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000);
    const tx = makeTx({ tasks: [{ id: 't1', title: 'Order appraisal', dueDate: overdueDue, status: 'TODO' }] });
    mockPrisma.transaction.findMany.mockResolvedValue([tx]);
mockPrisma.aIAction.create.mockResolvedValue({});

    const result = await scanForAgent(AGENT_ID);

    expect(result).toEqual({ created: 1, skipped: 0, errors: 0 });
    const createArg = mockPrisma.aIAction.create.mock.calls[0][0].data;
    expect(createArg.toolType).toBe('TRANSACTION_RISK');
    expect(createArg.status).toBe('PENDING');
  });

  it('creates a HIGH severity action when closing is within 14d and has overdue task', async () => {
    const overdueDue = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000);
    const closingDate = new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days away
    const tx = makeTx({
      closingDate,
      tasks: [{ id: 't1', title: 'Final walkthrough', dueDate: overdueDue, status: 'TODO' }],
    });
    mockPrisma.transaction.findMany.mockResolvedValue([tx]);
// For HIGH severity, the service calls OpenAI — return deterministic fallback via error
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('OpenAI down'));
    mockPrisma.aIAction.create.mockResolvedValue({});

    const result = await scanForAgent(AGENT_ID);

    expect(result.created).toBe(1);
    const createArg = mockPrisma.aIAction.create.mock.calls[0][0].data;
    // HIGH priority maps to priority=3
    expect(createArg.priority).toBe(3);
  });

  it('detects CONTINGENCY_EXPIRING for a contingency within 7 days', async () => {
    const soonDate = new Date(NOW.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 days away → MEDIUM
    const tx = makeTx({ inspectionContingencyDate: soonDate });
    mockPrisma.transaction.findMany.mockResolvedValue([tx]);
mockPrisma.aIAction.create.mockResolvedValue({});

    const result = await scanForAgent(AGENT_ID);

    expect(result.created).toBe(1);
    const preview = mockPrisma.aIAction.create.mock.calls[0][0].data.previewData;
    const hasContingencyFactor = preview.riskFactors.some(
      (f: any) => f.rule === 'CONTINGENCY_EXPIRING',
    );
    expect(hasContingencyFactor).toBe(true);
  });

  it('detects MISSING_DOCUMENT factor', async () => {
    const tx = makeTx({
      documents: [
        { id: 'd1', label: 'Purchase Agreement', status: 'MISSING' },
        { id: 'd2', label: 'Disclosure', status: 'PRESENT' },
      ],
    });
    mockPrisma.transaction.findMany.mockResolvedValue([tx]);
mockPrisma.aIAction.create.mockResolvedValue({});

    await scanForAgent(AGENT_ID);

    const preview = mockPrisma.aIAction.create.mock.calls[0][0].data.previewData;
    const missingFactor = preview.riskFactors.find((f: any) => f.rule === 'MISSING_DOCUMENT');
    expect(missingFactor).toBeDefined();
    expect(missingFactor.description).toContain('Purchase Agreement');
  });

  it('respects maxItems cap', async () => {
    // Create 5 risky transactions
    const overdueDate = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    const txs = Array.from({ length: 5 }, (_, i) =>
      makeTx({ id: `tx-${i}`, tasks: [{ id: `t${i}`, title: 'Task', dueDate: overdueDate, status: 'TODO' }] }),
    );
    mockPrisma.transaction.findMany.mockResolvedValue(txs);
mockPrisma.aIAction.create.mockResolvedValue({});

    const result = await scanForAgent(AGENT_ID, { maxItems: 3 });

    expect(result.created).toBe(3);
  });
});
