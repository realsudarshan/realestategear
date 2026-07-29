import OpenAI from 'openai';
import { prisma } from 'db';
import { getAuthorizedAccount } from './googleWorkspaceService.js';

const GMAIL_BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const CONFIDENCE_THRESHOLD = 0.65;
const MAX_MESSAGES_PER_SYNC = 50;

type MessageCategory =
  | 'OFFER'
  | 'CONTRACT'
  | 'DISCLOSURE'
  | 'INSPECTION'
  | 'LENDER'
  | 'TITLE'
  | 'GENERAL_COMMS'
  | 'NOISE';

// ─── Gmail API helpers ────────────────────────────────────────────────────────

async function gmailGet(accessToken: string, path: string) {
  const res = await fetch(`${GMAIL_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || 'Gmail API request failed';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

function parseHeaderValue(
  headers: Array<{ name: string; value: string }>,
  name: string
): string | null {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
}

type AttachmentMeta = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

function extractMessageParts(payload: any): { attachments: AttachmentMeta[] } {
  const attachments: AttachmentMeta[] = [];

  function walk(part: any) {
    if (!part) return;
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        sizeBytes: part.body.size || 0,
      });
    }
    (part.parts || []).forEach(walk);
  }

  walk(payload);
  return { attachments };
}

async function fetchMessageDetails(accessToken: string, messageId: string) {
  // format=full returns headers + payload structure (attachment metadata only, not content)
  const data = await gmailGet(accessToken, `/messages/${messageId}?format=full`);

  const headers: Array<{ name: string; value: string }> = data.payload?.headers || [];
  const fromRaw = parseHeaderValue(headers, 'from') || '';
  // Handles "Name <email>" and bare "email"
  const fromMatch = fromRaw.match(/^(?:"?([^"<]+)"?\s+)?<?([^\s<>,]+@[^\s<>,]+)>?$/);
  const dateStr = parseHeaderValue(headers, 'date');

  return {
    providerMessageId: messageId,
    providerThreadId: data.threadId || null,
    subject: parseHeaderValue(headers, 'subject'),
    snippet: data.snippet || null,
    fromEmail: fromMatch ? fromMatch[2].toLowerCase() : fromRaw.toLowerCase() || null,
    fromName: fromMatch ? (fromMatch[1]?.trim() || null) : null,
    sentAt: dateStr
      ? (() => { try { return new Date(dateStr).toISOString(); } catch { return null; } })()
      : null,
    toHeader: parseHeaderValue(headers, 'to'),
    ccHeader: parseHeaderValue(headers, 'cc'),
    attachments: extractMessageParts(data.payload).attachments,
  };
}

async function fetchAttachmentBase64(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<string | null> {
  try {
    const data = await gmailGet(accessToken, `/messages/${messageId}/attachments/${attachmentId}`);
    // Gmail returns base64url — convert to standard base64 for pdf-parse
    return data.data?.replace(/-/g, '+').replace(/_/g, '/') ?? null;
  } catch {
    return null;
  }
}

async function extractPdfText(base64Data: string): Promise<string | null> {
  try {
    const pdfParse = ((await import('pdf-parse')) as any).default;
    const buffer = Buffer.from(base64Data, 'base64');
    const result = await pdfParse(buffer);
    // Cap at 4 000 chars — enough context for the LLM without burning tokens
    return result.text?.slice(0, 4000) ?? null;
  } catch {
    return null;
  }
}

// ─── Build sync query ─────────────────────────────────────────────────────────

/**
 * Builds a Gmail search query from transaction signals (address + party emails + dates).
 * Returns empty string if there are no useful signals, in which case the caller should
 * abort the sync with a user-facing error.
 */
export async function buildSyncQuery(transaction: {
  address?: string | null;
  createdAt: Date | string;
  closingDate?: Date | string | null;
  parties?: Array<{ contact?: { email?: string | null } }>;
}): Promise<string> {
  const parts: string[] = [];

  // Address signal — strip city/state, keep street number + name for tighter match
  if (transaction.address) {
    const streetOnly = transaction.address.replace(/,.*$/, '').trim();
    if (streetOnly) parts.push(`"${streetOnly}"`);
  }

  // Party email signals
  const partyEmails: string[] = [];
  for (const party of transaction.parties || []) {
    const email = party.contact?.email?.trim();
    if (email) partyEmails.push(email.toLowerCase());
  }

  if (partyEmails.length) {
    // OR across all party emails for any direction (from/to)
    const emailParts = partyEmails.map((e) => `{from:${e} to:${e}}`).join(' ');
    parts.push(`(${emailParts})`);
  }

  // No meaningful content signals — query would be too broad
  if (!transaction.address && partyEmails.length === 0) {
    return '';
  }

  // Date range
  const after = new Date(
    new Date(transaction.createdAt).getTime() - 30 * 24 * 60 * 60 * 1000
  );
  const before = transaction.closingDate
    ? new Date(new Date(transaction.closingDate).getTime() + 7 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

  const fmt = (d: Date) =>
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

  parts.push(`after:${fmt(after)}`, `before:${fmt(before)}`);
  parts.push('-label:spam', '-label:promotions');

  return parts.join(' ');
}

// ─── Classification ───────────────────────────────────────────────────────────

const CLASSIFY_SYSTEM = `You are a real estate transaction document classifier.
Given an email subject, snippet, and attachment filenames, classify into one category.

Categories:
- OFFER: purchase offers, counter-offers, offer acceptance/rejection
- CONTRACT: purchase & sale agreements, addenda, amendments to contract
- DISCLOSURE: seller disclosures, Form 17, lead paint, AS-IS disclosures
- INSPECTION: inspection reports, repair requests, inspection responses
- LENDER: loan approval, appraisal, underwriting, mortgage commitment
- TITLE: title report, preliminary commitment, title insurance, closing disclosure, HUD-1
- GENERAL_COMMS: scheduling, coordination, check-ins unrelated to formal documents
- NOISE: marketing, newsletters, unrelated email, spam

Respond with JSON only: { "category": "OFFER", "confidence": 0.92 }`;

async function classifyMessage(
  subject: string | null,
  snippet: string | null,
  filenames: string[]
): Promise<{ category: MessageCategory; confidence: number }> {
  const openai = new OpenAI();

  const userContent = [
    `Subject: ${subject || '(none)'}`,
    `Snippet: ${(snippet || '').slice(0, 400) || '(none)'}`,
    `Attachments: ${filenames.length ? filenames.join(', ') : 'none'}`,
  ].join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: CLASSIFY_SYSTEM },
      { role: 'user', content: userContent },
    ],
    max_tokens: 60,
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    return {
      category: parsed.category as MessageCategory,
      confidence: Number(parsed.confidence) || 0,
    };
  } catch {
    return { category: 'NOISE', confidence: 0 };
  }
}

// ─── Email address extraction ─────────────────────────────────────────────────

function extractEmailAddresses(header: string | null): string[] {
  if (!header) return [];
  return [...header.matchAll(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)].map((m) =>
    m[0].toLowerCase()
  );
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Starts an async sync run for the transaction. Returns immediately with the syncRunId
 * so the client can poll status via GET /:id/sync-runs.
 */
export async function runTransactionSync(transactionId: string, agentId: string) {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      assignedAgentId: agentId,
    },
    include: {
      parties: { include: { contact: { select: { email: true } } } },
    },
  });

  if (!transaction) {
    const err = new Error('Transaction not found.');
    err.status = 404;
    throw err;
  }

  const { accessToken } = await getAuthorizedAccount(agentId);
  const query = await buildSyncQuery(transaction);

  if (!query) {
    const err = new Error(
      'Add an address or transaction party emails before syncing.'
    );
    err.status = 400;
    throw err;
  }

  const syncRun = await prisma.transactionSyncRun.create({
    data: { transactionId, status: 'RUNNING', query },
  });

  // Fire-and-forget the actual processing
  processSyncRun(syncRun.id, transactionId, transaction.accountId, accessToken, query).catch((err) => {
    console.error(`[transactionSync] run ${syncRun.id} failed:`, err);
    prisma.transactionSyncRun
      .update({
        where: { id: syncRun.id },
        data: { status: 'FAILED', error: String(err.message), completedAt: new Date() },
      })
      .catch(() => undefined);
  });

  return { syncRunId: syncRun.id };
}

async function processSyncRun(
  syncRunId: string,
  transactionId: string,
  accountId: string,
  accessToken: string,
  query: string
) {
  const searchRes = await gmailGet(
    accessToken,
    `/messages?${new URLSearchParams({ q: query, maxResults: String(MAX_MESSAGES_PER_SYNC) })}`
  );

  const messageIds: string[] = (searchRes.messages || []).map((m: any) => m.id);
  let messagesFound = 0;

  for (const messageId of messageIds) {
    try {
      await processOneMessage(accessToken, transactionId, accountId, syncRunId, messageId);
      messagesFound++;
    } catch (err) {
      console.error(`[transactionSync] message ${messageId} failed:`, err);
    }
  }

  await prisma.transactionSyncRun.update({
    where: { id: syncRunId },
    data: { status: 'COMPLETED', messagesFound, completedAt: new Date() },
  });
}

async function processOneMessage(
  accessToken: string,
  transactionId: string,
  accountId: string,
  syncRunId: string,
  providerMessageId: string
) {
  // DISMISSED messages are permanent — skip them on re-syncs
  const existing = await prisma.transactionDiscoveredMessage.findUnique({
    where: {
      transactionId_providerMessageId: { transactionId, providerMessageId },
    },
    select: { id: true, status: true },
  });
  if (existing?.status === 'DISMISSED') return;

  const details = await fetchMessageDetails(accessToken, providerMessageId);
  const filenames = details.attachments.map((a) => a.filename);

  let { category, confidence } = await classifyMessage(
    details.subject,
    details.snippet,
    filenames
  );

  // PDF fallback: download and extract text, re-classify if we can beat the threshold
  if (confidence < CONFIDENCE_THRESHOLD) {
    const pdfAttachments = details.attachments.filter(
      (a) =>
        a.mimeType === 'application/pdf' ||
        a.filename.toLowerCase().endsWith('.pdf')
    );
    for (const pdfAtt of pdfAttachments.slice(0, 2)) {
      const base64 = await fetchAttachmentBase64(accessToken, providerMessageId, pdfAtt.id);
      if (!base64) continue;
      const pdfText = await extractPdfText(base64);
      if (!pdfText) continue;
      const reclassified = await classifyMessage(
        details.subject,
        `${details.snippet || ''}\n\n[PDF]: ${pdfText.slice(0, 600)}`,
        filenames
      );
      if (reclassified.confidence > confidence) {
        category = reclassified.category;
        confidence = reclassified.confidence;
      }
    }
  }

  // Upsert the message — CONFIRMED messages keep their status
  const message = await prisma.transactionDiscoveredMessage.upsert({
    where: {
      transactionId_providerMessageId: { transactionId, providerMessageId },
    },
    create: {
      transactionId,
      syncRunId,
      providerMessageId,
      providerThreadId: details.providerThreadId,
      subject: details.subject,
      snippet: details.snippet,
      fromEmail: details.fromEmail,
      fromName: details.fromName,
      sentAt: details.sentAt ? new Date(details.sentAt) : null,
      category,
      confidence,
      status: 'PENDING',
    },
    update: {
      syncRunId,
      subject: details.subject,
      snippet: details.snippet,
      category,
      confidence,
      // Intentionally not touching status — preserves CONFIRMED state
    },
  });

  // Upsert attachments by (messageId, providerAttachmentId)
  for (const att of details.attachments) {
    await prisma.transactionDiscoveredAttachment.upsert({
      where: {
        messageId_providerAttachmentId: {
          messageId: message.id,
          providerAttachmentId: att.id,
        },
      },
      create: {
        messageId: message.id,
        providerAttachmentId: att.id,
        filename: att.filename,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
      },
      update: { filename: att.filename, mimeType: att.mimeType },
    });
  }

  // Discover contacts from participants
  const participantEmails = [
    ...extractEmailAddresses(details.fromEmail),
    ...extractEmailAddresses(details.toHeader),
    ...extractEmailAddresses(details.ccHeader),
  ];
  const uniqueEmails = [...new Set(participantEmails)];

  for (const email of uniqueEmails) {
    const matchedContact = await prisma.contact.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, accountId },
      select: { id: true },
    });

    const alreadyDiscovered = await prisma.transactionDiscoveredContact.findFirst({
      where: { messageId: message.id, email },
    });
    if (!alreadyDiscovered) {
      await prisma.transactionDiscoveredContact.create({
        data: {
          messageId: message.id,
          email,
          contactId: matchedContact?.id ?? null,
        },
      });
    }
  }
}

// ─── Confirm / Dismiss ────────────────────────────────────────────────────────

async function assertMessageAccess(messageId: string, agentId: string) {
  const message = await prisma.transactionDiscoveredMessage.findFirst({
    where: {
      id: messageId,
      transaction: { assignedAgentId: agentId },
    },
    select: { id: true, status: true },
  });
  if (!message) {
    const err = new Error('Message not found.');
    err.status = 404;
    throw err;
  }
  return message;
}

export async function confirmDiscoveredMessage(messageId: string, agentId: string) {
  await assertMessageAccess(messageId, agentId);
  await prisma.transactionDiscoveredMessage.update({
    where: { id: messageId },
    data: { status: 'CONFIRMED' },
  });
  return { id: messageId, status: 'CONFIRMED' };
}

export async function dismissDiscoveredMessage(messageId: string, agentId: string) {
  await assertMessageAccess(messageId, agentId);
  await prisma.transactionDiscoveredMessage.update({
    where: { id: messageId },
    data: { status: 'DISMISSED' },
  });
  return { id: messageId, status: 'DISMISSED' };
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export async function getDiscoveredMessages(
  transactionId: string,
  agentId: string,
  filters: { status?: string } = {}
) {
  const tx = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      assignedAgentId: agentId,
    },
    select: { id: true },
  });
  if (!tx) {
    const err = new Error('Transaction not found.');
    err.status = 404;
    throw err;
  }

  const where: any = { transactionId };
  if (filters.status) where.status = filters.status;

  return prisma.transactionDiscoveredMessage.findMany({
    where,
    orderBy: [{ category: 'asc' }, { sentAt: 'desc' }],
    include: {
      attachments: {
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          suggestedDocType: true,
          suggestedConfidence: true,
          matchedDocument: { select: { id: true, label: true, status: true } },
        },
      },
      contacts: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
}

export async function getSyncRuns(transactionId: string, agentId: string) {
  const tx = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      assignedAgentId: agentId,
    },
    select: { id: true },
  });
  if (!tx) {
    const err = new Error('Transaction not found.');
    err.status = 404;
    throw err;
  }

  return prisma.transactionSyncRun.findMany({
    where: { transactionId },
    orderBy: { startedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      status: true,
      query: true,
      messagesFound: true,
      error: true,
      startedAt: true,
      completedAt: true,
    },
  });
}
