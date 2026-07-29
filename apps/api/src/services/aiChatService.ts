/**
 * aiChatService — context-aware chat orchestration with tool calling.
 *
 * Tools (all scoped server-side to agentId):
 *   list_contacts          — search/list agent's contacts
 *   list_properties        — search properties linked to agent's transactions
 *   list_tasks             — list agent's tasks
 *   list_action_queue_items — pending AIAction queue items
 *   summarize_transaction  — structured summary of one transaction
 *
 * Flow per request:
 *   1. Non-streaming tool-call loop (max 3 rounds).
 *   2. Once no more tool calls, stream the final answer via onChunk.
 *   3. Return accumulated LinkedEntity[] for the client to render as cards.
 *
 * The model is never given the agentId as an argument — all DB filters
 * are applied server-side before results reach the model.
 */
import OpenAI from 'openai';
import { prisma } from 'db';
import logger from '../utils/logger.js';

const MODEL_ID = 'gpt-4o';

export interface LinkedEntity {
  type: 'contact' | 'property' | 'task' | 'transaction' | 'action_item';
  id: string;
  label: string;
  href: string;
  meta: string[];
}

let openai: OpenAI | undefined;
function getClient() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the AI assistant for Agent HQ, a real estate CRM for licensed agents.

You have tools to look up the agent's workspace data:
- list_contacts: search or list the agent's contacts by name, stage, or type
- list_properties: search properties linked to the agent's transactions
- list_tasks: list tasks, optionally filtered by contact, transaction, or status
- list_action_queue_items: show AI-suggested actions awaiting the agent's review
- summarize_transaction: get a structured summary of one transaction by ID

When the agent asks about their data, use these tools to retrieve accurate, up-to-date information.
Return concise, actionable answers. When listing items, keep it brief — the UI will show cards.

For actions that send emails, modify records, or trigger side effects, direct the agent to the Action Queue — do not perform these directly.

Guardrails:
- Do not make protected-class assumptions about neighborhoods or demographics.
- Do not claim a property is available without checking its status.
- Do not provide legal or financing guarantees.
- This is a read-only assistant — no data modifications.`;

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOL_DEFINITIONS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_contacts',
      description: "List or search the agent's contacts. Use for questions like 'show my contacts', 'which leads need follow-up', 'find buyers with no activity'.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name or keyword search' },
          type: { type: 'string', enum: ['LEAD', 'CLIENT', 'PAST_CLIENT'], description: 'Filter by contact type' },
          stage: { type: 'string', description: 'Filter by stage (e.g. ACTIVE, QUALIFIED, NEW, CONTACTED)' },
          limit: { type: 'number', description: 'Max results, default 10, max 20' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_properties',
      description: "Search properties linked to the agent's transactions. Use for questions about listings, active properties, or sold properties.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Address or city keyword' },
          status: { type: 'string', description: "Property status filter (e.g. 'Active', 'Pending', 'Sold')" },
          limit: { type: 'number', description: 'Max results, default 10, max 20' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: "List the agent's tasks. Use for questions about open tasks, overdue work, or follow-ups.",
      parameters: {
        type: 'object',
        properties: {
          contactId: { type: 'string', description: 'Filter by contact ID' },
          transactionId: { type: 'string', description: 'Filter by transaction ID' },
          status: { type: 'string', enum: ['TODO', 'IN_PROGRESS'], description: 'Task status filter (defaults to open tasks)' },
          limit: { type: 'number', description: 'Max results, default 10, max 20' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_action_queue_items',
      description: "List pending AI-suggested actions awaiting the agent's review. Use for 'what needs my attention', 'show AI suggestions', 'pending actions'.",
      parameters: {
        type: 'object',
        properties: {
          toolType: {
            type: 'string',
            enum: ['LEAD_RESPONSE', 'RELATIONSHIP_MEMORY', 'TRANSACTION_RISK'],
            description: 'Filter by action type',
          },
          limit: { type: 'number', description: 'Max results, default 10, max 20' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarize_transaction',
      description: 'Get a structured summary of a specific transaction by its ID.',
      parameters: {
        type: 'object',
        required: ['transactionId'],
        properties: {
          transactionId: { type: 'string', description: 'The transaction ID to summarize' },
        },
      },
    },
  },
];

// ─── Tool execution ───────────────────────────────────────────────────────────

async function execListContacts(
  agentId: string,
  args: { query?: string; type?: string; stage?: string; limit?: number },
): Promise<{ text: string; entities: LinkedEntity[] }> {
  const limit = Math.min(args.limit ?? 10, 20);

  const member = await prisma.accountMember.findFirst({ where: { userId: agentId } });
  if (!member) return { text: 'No contacts found matching those criteria.', entities: [] };

  const contacts = await prisma.contact.findMany({
    where: {
      accountId: member.accountId,
      ...(args.type ? { type: args.type } : {}),
      ...(args.stage ? { stage: args.stage } : {}),
      ...(args.query
        ? {
            OR: [
              { firstName: { contains: args.query, mode: 'insensitive' } },
              { lastName: { contains: args.query, mode: 'insensitive' } },
              { email: { contains: args.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      type: true,
      stage: true,
      lastInteractionAt: true,
    },
    orderBy: { lastInteractionAt: { sort: 'asc', nulls: 'first' } },
    take: limit,
  });

  const entities: LinkedEntity[] = contacts.map((c) => ({
    type: 'contact',
    id: c.id,
    label: `${c.firstName} ${c.lastName}`,
    href: `/contacts/${c.id}`,
    meta: [
      `${c.type} · ${c.stage}`,
      c.lastInteractionAt ? `Last contact ${formatAge(c.lastInteractionAt)}` : 'No recorded interactions',
    ],
  }));

  const text =
    contacts.length === 0
      ? 'No contacts found matching those criteria.'
      : contacts
          .map(
            (c) =>
              `- ${c.firstName} ${c.lastName} (${c.type}, ${c.stage}${c.lastInteractionAt ? `, last contact ${formatAge(c.lastInteractionAt)}` : ''})`,
          )
          .join('\n');

  return { text, entities };
}

async function execListProperties(
  agentId: string,
  args: { query?: string; status?: string; limit?: number },
): Promise<{ text: string; entities: LinkedEntity[] }> {
  const limit = Math.min(args.limit ?? 10, 20);

  // Scope to properties linked to the agent's transactions.
  const properties = await prisma.property.findMany({
    where: {
      transactions: { some: { assignedAgentId: agentId } },
      ...(args.status ? { listings: { some: { status: String(args.status).toUpperCase() as any } } } : {}),
      ...(args.query
        ? {
            OR: [
              { address: { contains: args.query, mode: 'insensitive' } },
              { city: { contains: args.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      address: true,
      city: true,
      state: true,
      listings: {
        orderBy: { listDate: 'desc' },
        take: 1,
        select: { listPrice: true, status: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  const entities: LinkedEntity[] = properties.map((p) => ({
    type: 'property',
    id: p.id,
    label: p.address,
    href: `/properties/${p.id}`,
    meta: [
      p.listings[0]?.status ?? 'Unknown status',
      p.city ? `${p.city}, ${p.state ?? ''}`.trim() : '',
      p.listings[0]?.listPrice ? `$${Number(p.listings[0].listPrice).toLocaleString()}` : '',
    ].filter(Boolean),
  }));

  const text =
    properties.length === 0
      ? 'No properties found matching those criteria.'
      : properties
          .map(
            (p) =>
              `- ${p.address}${p.city ? `, ${p.city}` : ''} — ${p.listings[0]?.status ?? 'Unknown'}${p.listings[0]?.listPrice ? ` · $${Number(p.listings[0].listPrice).toLocaleString()}` : ''}`,
          )
          .join('\n');

  return { text, entities };
}

async function execListTasks(
  agentId: string,
  args: { contactId?: string; transactionId?: string; status?: string; limit?: number },
): Promise<{ text: string; entities: LinkedEntity[] }> {
  const limit = Math.min(args.limit ?? 10, 20);
  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: {
      assignedToId: agentId,
      ...(args.contactId ? { contactId: args.contactId } : {}),
      ...(args.transactionId ? { transactionId: args.transactionId } : {}),
      status: args.status ? args.status : { in: ['TODO', 'IN_PROGRESS'] },
    },
    select: { id: true, title: true, status: true, priority: true, dueDate: true },
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { priority: 'desc' }],
    take: limit,
  });

  const entities: LinkedEntity[] = tasks.map((t) => ({
    type: 'task',
    id: t.id,
    label: t.title,
    href: `/tasks`,
    meta: [
      t.status,
      t.dueDate
        ? new Date(t.dueDate) < now
          ? `Overdue — was due ${formatAge(t.dueDate)}`
          : `Due ${new Date(t.dueDate).toLocaleDateString()}`
        : 'No due date',
      `${t.priority} priority`,
    ],
  }));

  const text =
    tasks.length === 0
      ? 'No open tasks found.'
      : tasks
          .map(
            (t) =>
              `- ${t.title} [${t.status}]${t.dueDate ? ` · due ${new Date(t.dueDate).toLocaleDateString()}` : ''}`,
          )
          .join('\n');

  return { text, entities };
}

async function execListActionQueueItems(
  agentId: string,
  args: { toolType?: string; limit?: number },
): Promise<{ text: string; entities: LinkedEntity[] }> {
  const limit = Math.min(args.limit ?? 10, 20);

  const actions = await prisma.aIAction.findMany({
    where: {
      userId: agentId,
      status: { in: ['PENDING', 'FAILED'] },
      ...(args.toolType ? { toolType: args.toolType } : {}),
    },
    select: { id: true, label: true, toolType: true, priority: true, suggestedAt: true },
    orderBy: [{ priority: 'desc' }, { suggestedAt: 'asc' }],
    take: limit,
  });

  const entities: LinkedEntity[] = actions.map((a) => ({
    type: 'action_item',
    id: a.id,
    label: a.label,
    href: '/',
    meta: [
      a.toolType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
      `Added ${formatAge(a.suggestedAt)}`,
      a.priority >= 3 ? 'High priority' : a.priority >= 2 ? 'Medium priority' : 'Low priority',
    ],
  }));

  const text =
    actions.length === 0
      ? 'No pending action queue items.'
      : actions.map((a) => `- ${a.label} [${a.toolType}]`).join('\n');

  return { text, entities };
}

async function execSummarizeTransaction(
  agentId: string,
  args: { transactionId: string },
): Promise<{ text: string; entities: LinkedEntity[] }> {
  const tx = await prisma.transaction.findFirst({
    where: { id: args.transactionId, assignedAgentId: agentId },
    include: {
      tasks: {
        where: { status: { in: ['TODO', 'IN_PROGRESS'] } },
        select: { title: true, dueDate: true, status: true },
        take: 5,
      },
      documents: {
        select: { label: true, status: true },
        take: 10,
      },
    },
  });

  if (!tx) {
    return { text: 'Transaction not found or not assigned to this agent.', entities: [] };
  }

  const now = new Date();
  const overdueTasks = tx.tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now);
  const missingDocs = tx.documents.filter((d) => d.status === 'MISSING');
  const closingDaysAway = tx.closingDate
    ? Math.ceil((new Date(tx.closingDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  const lines = [
    `Transaction: ${tx.address ?? tx.type} (${tx.stage})`,
    tx.closingDate
      ? `Closing: ${new Date(tx.closingDate).toLocaleDateString()}${closingDaysAway !== null && closingDaysAway >= 0 ? ` (${closingDaysAway} days away)` : ''}`
      : 'No closing date set',
    `Open tasks: ${tx.tasks.length}${overdueTasks.length > 0 ? ` — ${overdueTasks.length} overdue` : ''}`,
    missingDocs.length > 0
      ? `Missing documents: ${missingDocs.map((d) => d.label).join(', ')}`
      : 'All required documents present',
  ].filter(Boolean);

  const entities: LinkedEntity[] = [
    {
      type: 'transaction',
      id: tx.id,
      label: tx.address ?? `${tx.type} transaction`,
      href: `/transactions/${tx.id}`,
      meta: [
        tx.stage,
        tx.closingDate
          ? `Closing ${new Date(tx.closingDate).toLocaleDateString()}`
          : 'No closing date',
        `${tx.tasks.length} open task${tx.tasks.length !== 1 ? 's' : ''}`,
      ],
    },
  ];

  return { text: lines.join('\n'), entities };
}

// ─── Tool dispatch ────────────────────────────────────────────────────────────

async function executeTool(
  agentId: string,
  name: string,
  args: Record<string, any>,
): Promise<{ text: string; entities: LinkedEntity[] }> {
  switch (name) {
    case 'list_contacts': return execListContacts(agentId, args);
    case 'list_properties': return execListProperties(agentId, args);
    case 'list_tasks': return execListTasks(agentId, args);
    case 'list_action_queue_items': return execListActionQueueItems(agentId, args);
    case 'summarize_transaction': return execSummarizeTransaction(agentId, args as { transactionId: string });
    default: return { text: `Unknown tool: ${name}`, entities: [] };
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Run the tool-calling chat loop, then stream the final answer via onChunk.
 * Returns all LinkedEntity values collected from tool results.
 */
export async function chatWithTools(
  agentId: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  onChunk: (chunk: string) => void,
): Promise<LinkedEntity[]> {
  const client = getClient();
  const allEntities: LinkedEntity[] = [];
  const toolCallsMade = { value: false };

  const conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];

  // Non-streaming tool-call loop — max 3 rounds.
  for (let round = 0; round < 3; round++) {
    const response = await client.chat.completions.create({
      model: MODEL_ID,
      messages: conversationMessages,
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
    });

    const message = response.choices[0].message;
    conversationMessages.push(message);

    if (!message.tool_calls?.length) {
      // No tool calls — this message is the final answer.
      if (!toolCallsMade.value) {
        // No tools were called at all — emit content directly.
        if (typeof message.content === 'string' && message.content) {
          onChunk(message.content);
        }
        return allEntities;
      }
      // Tools were called in a previous round; fall through to streaming final call.
      break;
    }

    toolCallsMade.value = true;

    // Execute all tool calls in this round.
    for (const tc of message.tool_calls) {
      if (!('function' in tc)) continue;
      let args: Record<string, any> = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}

      let result: { text: string; entities: LinkedEntity[] } = { text: '', entities: [] };
      try {
        result = await executeTool(agentId, tc.function.name, args as any);
      } catch (err) {
        const toolName = 'function' in tc ? tc.function.name : 'unknown';
        logger.warn(`aiChatService: tool ${toolName} failed:`, err);
        result = { text: `Tool ${toolName} encountered an error.`, entities: [] };
      }

      allEntities.push(...result.entities);
      conversationMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result.text,
      });
    }
  }

  // Stream the final answer (after tool calls, or after max rounds).
  const stream = await client.chat.completions.create({
    model: MODEL_ID,
    messages: conversationMessages,
    tools: TOOL_DEFINITIONS,
    tool_choice: 'none',  // no more tool calls in the final answer
    stream: true,
    max_tokens: 1500,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) onChunk(delta);
  }

  return allEntities;
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function formatAge(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
