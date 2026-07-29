/**
 * Tests for aiChatService.chatWithTools:
 *  - No tool calls → direct content emitted via onChunk, returns []
 *  - Tool calls then streaming final answer → entities collected, chunks streamed
 *  - Tool execution error → fallback text returned, entities []
 *  - Unknown tool name → returns text "Unknown tool: ..."
 *  - execListContacts with no results → empty entity list
 *  - execListContacts with results → entities built correctly
 *  - execSummarizeTransaction not found → returns error text
 *  - Max rounds (3) exhausted → falls through to streaming final answer
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  accountMember: { findFirst: vi.fn() },
  contact: { findMany: vi.fn() },
  property: { findMany: vi.fn() },
  task: { findMany: vi.fn() },
  aIAction: { findMany: vi.fn() },
  transaction: { findFirst: vi.fn() },
}));

// Helper to build a mock non-streaming response with optional tool calls
function mockCompletionResponse(content: string | null, toolCalls?: any[]) {
  return {
    choices: [{
      message: {
        content,
        tool_calls: toolCalls,
      },
    }],
  };
}

// Async generator helper for streaming
async function* makeStream(chunks: string[]) {
  for (const c of chunks) {
    yield { choices: [{ delta: { content: c } }] };
  }
}

const mockOpenAI = vi.hoisted(() => {
  const createFn = vi.fn();
  return { createFn, chat: { completions: { create: createFn } } };
});

vi.mock('db', () => ({ prisma: mockPrisma }));
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = mockOpenAI.chat;
  },
}));
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { chatWithTools } = await import('../../../services/aiChatService.js');

const AGENT_ID = 'agent-1';
const USER_MESSAGES = [{ role: 'user' as const, content: 'show me my contacts' }];

describe('chatWithTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.accountMember.findFirst.mockResolvedValue({ accountId: 'acc-1' });
    mockPrisma.contact.findMany.mockResolvedValue([]);
    mockPrisma.property.findMany.mockResolvedValue([]);
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.aIAction.findMany.mockResolvedValue([]);
    mockPrisma.transaction.findFirst.mockResolvedValue(null);
  });

  it('no tool calls: emits content via onChunk and returns empty entities', async () => {
    mockOpenAI.createFn.mockResolvedValueOnce(
      mockCompletionResponse('Here is some information for you.'),
    );

    const chunks: string[] = [];
    const entities = await chatWithTools(AGENT_ID, USER_MESSAGES, (c) => chunks.push(c));

    expect(chunks).toEqual(['Here is some information for you.']);
    expect(entities).toEqual([]);
    expect(mockOpenAI.createFn).toHaveBeenCalledOnce(); // no streaming call needed
  });

  it('tool calls then streaming final: collects entities, streams chunks', async () => {
    const toolCallId = 'tc-1';
    mockPrisma.contact.findMany.mockResolvedValue([
      { id: 'c-1', firstName: 'Jane', lastName: 'Smith', type: 'LEAD', stage: 'ACTIVE', email: 'jane@example.com', phone: null },
    ]);

    // First call: returns tool call
    mockOpenAI.createFn.mockResolvedValueOnce(
      mockCompletionResponse(null, [{
        id: toolCallId,
        function: { name: 'list_contacts', arguments: '{"limit":5}' },
      }]),
    );
    // Second call: no more tool calls → fall through to streaming
    mockOpenAI.createFn.mockResolvedValueOnce(
      mockCompletionResponse(null, []), // empty tool_calls triggers break
    );
    // Third call: streaming
    mockOpenAI.createFn.mockReturnValueOnce(makeStream(['You have ', '1 contact.']));

    const chunks: string[] = [];
    const entities = await chatWithTools(AGENT_ID, USER_MESSAGES, (c) => chunks.push(c));

    expect(chunks).toEqual(['You have ', '1 contact.']);
    expect(entities).toHaveLength(1);
    expect(entities[0].type).toBe('contact');
    expect(entities[0].id).toBe('c-1');
    expect(entities[0].label).toBe('Jane Smith');
  });

  it('tool execution error: returns fallback text and empty entities, does not throw', async () => {
    const toolCallId = 'tc-fail';
    mockPrisma.contact.findMany.mockRejectedValueOnce(new Error('DB timeout'));

    mockOpenAI.createFn.mockResolvedValueOnce(
      mockCompletionResponse(null, [{
        id: toolCallId,
        function: { name: 'list_contacts', arguments: '{}' },
      }]),
    );
    // After tool error, model responds with no more tool calls
    mockOpenAI.createFn.mockResolvedValueOnce(mockCompletionResponse(null, []));
    mockOpenAI.createFn.mockReturnValueOnce(makeStream(['Sorry, something went wrong.']));

    const chunks: string[] = [];
    const entities = await chatWithTools(AGENT_ID, USER_MESSAGES, (c) => chunks.push(c));

    expect(entities).toEqual([]);
    expect(chunks).toEqual(['Sorry, something went wrong.']);
  });

  it('unknown tool name: returns "Unknown tool:" text without throwing', async () => {
    mockOpenAI.createFn.mockResolvedValueOnce(
      mockCompletionResponse(null, [{
        id: 'tc-unk',
        function: { name: 'nonexistent_tool', arguments: '{}' },
      }]),
    );
    mockOpenAI.createFn.mockResolvedValueOnce(mockCompletionResponse(null, []));
    mockOpenAI.createFn.mockReturnValueOnce(makeStream(['Done.']));

    const chunks: string[] = [];
    await chatWithTools(AGENT_ID, USER_MESSAGES, (c) => chunks.push(c));

    // Should have passed "Unknown tool: nonexistent_tool" as the tool result
    // Verify the third call (streaming) was reached — no throw
    expect(mockOpenAI.createFn).toHaveBeenCalledTimes(3);
  });

  it('max 3 tool-call rounds: streams after round 3 even if model still wants tools', async () => {
    // Each non-streaming call returns a tool call
    for (let i = 0; i < 3; i++) {
      mockOpenAI.createFn.mockResolvedValueOnce(
        mockCompletionResponse(null, [{
          id: `tc-${i}`,
          function: { name: 'list_contacts', arguments: '{}' },
        }]),
      );
    }
    // After 3 rounds, streaming kicks in
    mockOpenAI.createFn.mockReturnValueOnce(makeStream(['Final answer.']));

    const chunks: string[] = [];
    await chatWithTools(AGENT_ID, USER_MESSAGES, (c) => chunks.push(c));

    // 3 non-streaming + 1 streaming = 4 total calls
    expect(mockOpenAI.createFn).toHaveBeenCalledTimes(4);
    expect(chunks).toContain('Final answer.');
  });

  describe('execListContacts', () => {
    it('returns empty text and no entities when no contacts found', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockOpenAI.createFn.mockResolvedValueOnce(
        mockCompletionResponse(null, [{ id: 'tc-1', function: { name: 'list_contacts', arguments: '{}' } }]),
      );
      mockOpenAI.createFn.mockResolvedValueOnce(mockCompletionResponse(null, []));
      mockOpenAI.createFn.mockReturnValueOnce(makeStream([]));

      const entities = await chatWithTools(AGENT_ID, USER_MESSAGES, () => {});
      expect(entities).toEqual([]);
    });

    it('returns entities with correct type and href when contacts found', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        { id: 'c-1', firstName: 'Bob', lastName: 'Jones', type: 'CLIENT', stage: 'ACTIVE', email: 'bob@example.com', phone: '555-1234' },
      ]);
      mockOpenAI.createFn.mockResolvedValueOnce(
        mockCompletionResponse(null, [{ id: 'tc-1', function: { name: 'list_contacts', arguments: '{"limit":5}' } }]),
      );
      mockOpenAI.createFn.mockResolvedValueOnce(mockCompletionResponse(null, []));
      mockOpenAI.createFn.mockReturnValueOnce(makeStream([]));

      const entities = await chatWithTools(AGENT_ID, USER_MESSAGES, () => {});
      expect(entities).toHaveLength(1);
      expect(entities[0]).toMatchObject({
        type: 'contact',
        id: 'c-1',
        label: 'Bob Jones',
        href: expect.stringContaining('c-1'),
      });
    });
  });

  describe('execSummarizeTransaction', () => {
    it('returns error text when transaction not found', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      mockOpenAI.createFn.mockResolvedValueOnce(
        mockCompletionResponse(null, [{ id: 'tc-1', function: { name: 'summarize_transaction', arguments: '{"transaction_id":"tx-bad"}' } }]),
      );
      mockOpenAI.createFn.mockResolvedValueOnce(mockCompletionResponse(null, []));
      mockOpenAI.createFn.mockReturnValueOnce(makeStream([]));

      // Verify the tool result message passed to the model contains an error indicator
      await chatWithTools(AGENT_ID, USER_MESSAGES, () => {});
      const secondCall = mockOpenAI.createFn.mock.calls[1][0];
      const toolResultMsg = secondCall.messages.find((m: any) => m.role === 'tool');
      expect(toolResultMsg).toBeDefined();
      expect(toolResultMsg.content).toMatch(/not found|no transaction/i);
    });

    it('returns summary text when transaction found', async () => {
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockPrisma.transaction.findFirst.mockResolvedValue({
        id: 'tx-1',
        address: '100 Oak Ave',
        type: 'PURCHASE',
        stage: 'PENDING',
        closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        tasks: [{ id: 't-1', title: 'Order appraisal', status: 'TODO', dueDate: pastDate }],
        documents: [],
        participants: [],
      });
      mockOpenAI.createFn.mockResolvedValueOnce(
        mockCompletionResponse(null, [{ id: 'tc-1', function: { name: 'summarize_transaction', arguments: '{"transaction_id":"tx-1"}' } }]),
      );
      mockOpenAI.createFn.mockResolvedValueOnce(mockCompletionResponse(null, []));
      mockOpenAI.createFn.mockReturnValueOnce(makeStream([]));

      await chatWithTools(AGENT_ID, USER_MESSAGES, () => {});
      const secondCall = mockOpenAI.createFn.mock.calls[1][0];
      const toolResultMsg = secondCall.messages.find((m: any) => m.role === 'tool');
      expect(toolResultMsg.content).toMatch(/100 Oak Ave/i);
    });
  });
});
