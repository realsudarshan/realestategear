/**
 * Tests for leadResponseAgentService.enqueue:
 *  - Null context (bad sourceId) → no AI call, returns early
 *  - Active duplicate action exists → no AI call, returns early
 *  - Happy path: context resolved, AI proposal generated, action created
 *  - Outer catch: error swallowed (no throw propagates)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  aIAction: { findFirst: vi.fn(), create: vi.fn() },
  aIContextSnapshot: { create: vi.fn() },
}));

const mockOpenAI = vi.hoisted(() => ({
  chat: { completions: { create: vi.fn() } },
}));

const mockFromInquiry = vi.hoisted(() => vi.fn());
const mockFromContactSubmission = vi.hoisted(() => vi.fn());

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = mockOpenAI.chat;
  },
}));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../services/leadContextService.js', () => ({
  fromInquiry: mockFromInquiry,
  fromContactSubmission: mockFromContactSubmission,
}));

const { enqueue } = await import('../../../services/leadResponseAgentService.js');

const AGENT_ID = 'agent-1';

const SAMPLE_CONTEXT = {
  agentId: AGENT_ID,
  source: { type: 'inquiry', submittedAt: '2026-05-27', message: 'I want to buy a house' },
  lead: {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    contactId: 'contact-1',
    priorInteractionCount: 0,
  },
  property: null,
};

const SAMPLE_PROPOSAL = {
  leadSummary: 'Jane is looking to buy a home.',
  qualificationSignals: ['first-time buyer'],
  recommendedStrategy: 'Call within 24h',
  emailSubject: 'Thanks for reaching out!',
  emailBody: 'Hi Jane, thank you for your inquiry...',
  suggestedTags: ['buyer'],
  suggestedStage: 'CONTACTED',
  followUpTask: { title: 'Call Jane', description: '', dueInDays: 1, priority: 'HIGH' },
  missingInfo: [],
  riskFlags: [],
};

describe('enqueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.aIAction.findFirst.mockResolvedValue(null);
    mockPrisma.aIContextSnapshot.create.mockResolvedValue({ id: 'snap-1' });
    mockPrisma.aIAction.create.mockResolvedValue({ id: 'action-1' });
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(SAMPLE_PROPOSAL) } }],
    });
  });

  it('returns early (no AI call) when context cannot be assembled', async () => {
    mockFromInquiry.mockResolvedValue(null);

    await enqueue('inquiry', 'bad-id');

    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    expect(mockPrisma.aIAction.create).not.toHaveBeenCalled();
  });

  it('returns early (no AI call) when active action already exists', async () => {
    mockFromInquiry.mockResolvedValue(SAMPLE_CONTEXT);
    mockPrisma.aIAction.findFirst.mockResolvedValue({ id: 'existing-action' });

    await enqueue('inquiry', 'inquiry-1');

    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    expect(mockPrisma.aIAction.create).not.toHaveBeenCalled();
  });

  it('happy path: generates proposal and creates action with expected shape', async () => {
    mockFromInquiry.mockResolvedValue(SAMPLE_CONTEXT);

    await enqueue('inquiry', 'inquiry-1');

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledOnce();
    expect(mockPrisma.aIContextSnapshot.create).toHaveBeenCalledOnce();
    expect(mockPrisma.aIAction.create).toHaveBeenCalledOnce();

    const createCall = mockPrisma.aIAction.create.mock.calls[0][0];
    expect(createCall.data.userId).toBe(AGENT_ID);
    expect(createCall.data.toolType).toBe('LEAD_RESPONSE');
    expect(createCall.data.sourceType).toBe('inquiry');
    expect(createCall.data.sourceId).toBe('inquiry-1');
    expect(createCall.data.workflowKey).toBe('lead_response_v1');
    expect(createCall.data.status).toBe('PENDING');
    expect(createCall.data.previewData).toMatchObject({
      emailSubject: SAMPLE_PROPOSAL.emailSubject,
    });
  });

  it('swallows errors — does not throw to caller', async () => {
    mockFromInquiry.mockResolvedValue(SAMPLE_CONTEXT);
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('OpenAI rate limit'));

    // Should not throw
    await expect(enqueue('inquiry', 'inquiry-1')).resolves.toBeUndefined();
    expect(mockPrisma.aIAction.create).not.toHaveBeenCalled();
  });

  it('returning lead (priorInteractionCount > 0) gets higher priority', async () => {
    const returningCtx = {
      ...SAMPLE_CONTEXT,
      lead: { ...SAMPLE_CONTEXT.lead, priorInteractionCount: 3 },
    };
    mockFromInquiry.mockResolvedValue(returningCtx);

    await enqueue('inquiry', 'inquiry-1');

    const createCall = mockPrisma.aIAction.create.mock.calls[0][0];
    expect(createCall.data.priority).toBe(2); // returning lead gets priority 2
  });
});
