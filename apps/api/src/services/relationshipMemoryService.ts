/**
 * relationshipMemoryService — scans an agent's contacts for stale or
 * high-opportunity relationships and creates AIAction queue items.
 *
 * Proposals are deterministic (no AI call per contact) to keep costs low.
 * Each rule produces a human-readable reason and recommended action.
 *
 * Rules (evaluated in priority order; highest priority written first):
 *   OVERDUE_TASK         — contact has a past-due task          priority 3
 *   ACTIVE_NO_ACTIVITY   — stage=ACTIVE, no interaction ≥7d     priority 2
 *   QUALIFIED_NO_CONSULT — LEAD QUALIFIED, no consult ≥30d      priority 2
 *   STALE_LEAD           — LEAD, no interaction ≥14d            priority 1
 *   PAST_CLIENT_CHECKIN  — CLIENT, no interaction ≥90d          priority 1
 *
 * One active AIAction per contact per workflow (idempotency via sourceType +
 * sourceId + workflowKey partial unique index).
 */
import { prisma } from 'db';
import logger from '../utils/logger.js';
import { IDEMPOTENCY_BLOCK_STATUSES } from '../constants/aiActionStatuses.js';

const WORKFLOW_KEY = 'relationship_memory_v1';
const SOURCE_TYPE = 'contact';
const ACTIVE_STATUSES = IDEMPOTENCY_BLOCK_STATUSES;

const DAY = 24 * 60 * 60 * 1000;

export interface ScanResult {
  created: number;
  skipped: number;
  errors: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a full relationship memory scan for one agent.
 * Returns { created, skipped, errors }.
 */
export async function scanForAgent(
  agentId: string,
  { maxItems = 20 }: { maxItems?: number } = {},
): Promise<ScanResult> {
  const result: ScanResult = { created: 0, skipped: 0, errors: 0 };

  try {
    const member = await prisma.accountMember.findFirst({ where: { userId: agentId } });
    if (!member) return result;
    const { accountId } = member;

    const candidates = await findCandidates({ agentId, accountId }, maxItems);

    // Pre-fetch all active actions for this agent+workflow in one query
    // to avoid N+1 lookups inside the candidate loop.
    const activeRows = await prisma.aIAction.findMany({
      where: {
        userId: agentId,
        sourceType: SOURCE_TYPE,
        workflowKey: WORKFLOW_KEY,
        status: { in: [...ACTIVE_STATUSES] },
      },
      select: { sourceId: true },
    });
    const activeIds = new Set(activeRows.map((r) => r.sourceId!));

    for (const candidate of candidates) {
      try {
        const created = await maybeCreateAction(agentId, candidate, activeIds);
        if (created) result.created++;
        else result.skipped++;
      } catch (err) {
        logger.warn(`relationshipMemoryService: error processing contact ${candidate.contactId}:`, err);
        result.errors++;
      }
    }
  } catch (err) {
    logger.error(`relationshipMemoryService: scan failed for agent ${agentId}:`, err);
    result.errors++;
  }

  return result;
}

// ─── Candidate finding ────────────────────────────────────────────────────────

interface Candidate {
  contactId: string;
  contactName: string;
  rule: string;
  ruleLabel: string;
  summary: string;
  lastInteractionAt: Date | null;
  recommendedAction: string;
  suggestedTaskTitle: string | null;
  urgency: 'low' | 'medium' | 'high';
  priority: number;
}

async function findCandidates(scope: { agentId: string; accountId: string }, maxItems: number): Promise<Candidate[]> {
  const now = new Date();
  const candidates: Candidate[] = [];

  const [overdueTasks, activeNoActivity, qualifiedNoConsult, staleLeads, pastClients] =
    await Promise.all([
      findOverdueTasks(scope, now),
      findActiveNoActivity(scope.accountId, now),
      findQualifiedNoConsult(scope.accountId, now),
      findStaleLeads(scope.accountId, now),
      findPastClientCheckins(scope.accountId, now),
    ]);

  candidates.push(...overdueTasks, ...activeNoActivity, ...qualifiedNoConsult, ...staleLeads, ...pastClients);

  // De-duplicate by contactId — highest priority rule wins.
  const seen = new Map<string, Candidate>();
  for (const c of candidates) {
    const existing = seen.get(c.contactId);
    if (!existing || c.priority > existing.priority) {
      seen.set(c.contactId, c);
    }
  }

  return [...seen.values()]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxItems);
}

// Rule 1: overdue task ─────────────────────────────────────────────────────────

async function findOverdueTasks(scope: { agentId: string; accountId: string }, now: Date): Promise<Candidate[]> {
  const tasks = await prisma.task.findMany({
    where: {
      assignedToId: scope.agentId,
      status: { in: ['TODO', 'IN_PROGRESS'] },
      dueDate: { lt: now },
      contactId: { not: null },
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, lastInteractionAt: true } },
    },
    orderBy: { dueDate: 'asc' },
    take: 30,
  });

  return tasks
    .filter((t) => t.contact)
    .map((t) => ({
      contactId: t.contact!.id,
      contactName: `${t.contact!.firstName} ${t.contact!.lastName}`,
      rule: 'OVERDUE_TASK',
      ruleLabel: 'Overdue task',
      summary: `Task "${t.title}" was due ${formatAge(t.dueDate!)} and is still open.`,
      lastInteractionAt: t.contact!.lastInteractionAt,
      recommendedAction: `Complete or reschedule: "${t.title}"`,
      suggestedTaskTitle: null,
      urgency: 'high' as const,
      priority: 3,
    }));
}

// Rule 2: active contact, no recent activity ───────────────────────────────────

async function findActiveNoActivity(accountId: string, now: Date): Promise<Candidate[]> {
  const cutoff = new Date(now.getTime() - 7 * DAY);

  const contacts = await prisma.contact.findMany({
    where: {
      accountId,
      stage: 'ACTIVE',
      OR: [
        { lastInteractionAt: { lt: cutoff } },
        { lastInteractionAt: null },
      ],
    },
    select: { id: true, firstName: true, lastName: true, lastInteractionAt: true, type: true },
    take: 20,
  });

  return contacts.map((c) => {
    const daysSince = c.lastInteractionAt
      ? Math.floor((now.getTime() - c.lastInteractionAt.getTime()) / DAY)
      : null;
    return {
      contactId: c.id,
      contactName: `${c.firstName} ${c.lastName}`,
      rule: 'ACTIVE_NO_ACTIVITY',
      ruleLabel: 'No recent activity',
      summary: daysSince !== null
        ? `Active ${c.type.toLowerCase()}, no interaction in ${daysSince} days.`
        : `Active ${c.type.toLowerCase()} with no recorded interactions.`,
      lastInteractionAt: c.lastInteractionAt,
      recommendedAction: 'Check in and confirm next steps.',
      suggestedTaskTitle: `Check in with ${c.firstName} ${c.lastName}`,
      urgency: 'medium' as const,
      priority: 2,
    };
  });
}

// Rule 3: qualified lead, no consult ──────────────────────────────────────────

async function findQualifiedNoConsult(accountId: string, now: Date): Promise<Candidate[]> {
  const cutoff = new Date(now.getTime() - 30 * DAY);

  const contacts = await prisma.contact.findMany({
    where: {
      accountId,
      type: 'LEAD',
      stage: 'QUALIFIED',
      OR: [
        { lastConsultAt: { lt: cutoff } },
        { lastConsultAt: null },
      ],
    },
    select: { id: true, firstName: true, lastName: true, lastInteractionAt: true, lastConsultAt: true },
    take: 20,
  });

  return contacts.map((c) => ({
    contactId: c.id,
    contactName: `${c.firstName} ${c.lastName}`,
    rule: 'QUALIFIED_NO_CONSULT',
    ruleLabel: 'Qualified — no consult',
    summary: c.lastConsultAt
      ? `Qualified lead, last consult ${formatAge(c.lastConsultAt)} — time to reconnect.`
      : 'Qualified lead with no consultation recorded.',
    lastInteractionAt: c.lastInteractionAt,
    recommendedAction: 'Schedule a buyer or seller consultation.',
    suggestedTaskTitle: `Schedule consult — ${c.firstName} ${c.lastName}`,
    urgency: 'medium' as const,
    priority: 2,
  }));
}

// Rule 4: stale lead ───────────────────────────────────────────────────────────

async function findStaleLeads(accountId: string, now: Date): Promise<Candidate[]> {
  const cutoff = new Date(now.getTime() - 14 * DAY);

  const contacts = await prisma.contact.findMany({
    where: {
      accountId,
      type: 'LEAD',
      stage: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] },
      OR: [
        { lastInteractionAt: { lt: cutoff } },
        { lastInteractionAt: null },
      ],
    },
    select: { id: true, firstName: true, lastName: true, stage: true, lastInteractionAt: true },
    orderBy: { lastInteractionAt: 'asc' },
    take: 30,
  });

  return contacts.map((c) => {
    const daysSince = c.lastInteractionAt
      ? Math.floor((now.getTime() - c.lastInteractionAt.getTime()) / DAY)
      : null;
    return {
      contactId: c.id,
      contactName: `${c.firstName} ${c.lastName}`,
      rule: 'STALE_LEAD',
      ruleLabel: 'Stale lead',
      summary: daysSince !== null
        ? `Lead in ${c.stage} stage, no contact in ${daysSince} days.`
        : `Lead in ${c.stage} stage with no recorded interactions.`,
      lastInteractionAt: c.lastInteractionAt,
      recommendedAction: 'Reach out to re-engage or qualify.',
      suggestedTaskTitle: `Follow up with ${c.firstName} ${c.lastName}`,
      urgency: 'low' as const,
      priority: 1,
    };
  });
}

// Rule 5: past client check-in ────────────────────────────────────────────────

async function findPastClientCheckins(accountId: string, now: Date): Promise<Candidate[]> {
  const cutoff = new Date(now.getTime() - 90 * DAY);

  const contacts = await prisma.contact.findMany({
    where: {
      accountId,
      type: 'CLIENT',
      OR: [
        { lastInteractionAt: { lt: cutoff } },
        { lastInteractionAt: null },
      ],
    },
    select: { id: true, firstName: true, lastName: true, lastInteractionAt: true },
    orderBy: { lastInteractionAt: 'asc' },
    take: 20,
  });

  return contacts.map((c) => {
    const daysSince = c.lastInteractionAt
      ? Math.floor((now.getTime() - c.lastInteractionAt.getTime()) / DAY)
      : null;
    return {
      contactId: c.id,
      contactName: `${c.firstName} ${c.lastName}`,
      rule: 'PAST_CLIENT_CHECKIN',
      ruleLabel: 'Past client — time to reconnect',
      summary: daysSince !== null
        ? `Past client, no contact in ${daysSince} days. Good time for a check-in.`
        : 'Past client with no recorded interactions.',
      lastInteractionAt: c.lastInteractionAt,
      recommendedAction: 'Send a personal check-in message.',
      suggestedTaskTitle: `Check in with ${c.firstName} ${c.lastName}`,
      urgency: 'low' as const,
      priority: 1,
    };
  });
}

// ─── Action creation ──────────────────────────────────────────────────────────

async function maybeCreateAction(
  agentId: string,
  candidate: Candidate,
  activeIds: Set<string>,
): Promise<boolean> {
  // Skip if there's already an active action for this contact + workflow.
  // activeIds is pre-fetched by the caller to avoid per-candidate N+1 queries.
  if (activeIds.has(candidate.contactId)) return false;

  const idempotencyKey = `${WORKFLOW_KEY}:${SOURCE_TYPE}:${candidate.contactId}`;

  await prisma.aIAction.create({
    data: {
      userId: agentId,
      toolName: 'relationship_memory',
      toolType: 'RELATIONSHIP_MEMORY',
      label: `${candidate.ruleLabel} — ${candidate.contactName}`,
      reason: candidate.summary,
      status: 'PENDING',
      priority: candidate.priority,
      requiresConfirmation: false, // review-only; no external side effects to gate
      sourceType: SOURCE_TYPE,
      sourceId: candidate.contactId,
      workflowKey: WORKFLOW_KEY,
      idempotencyKey,
      contactId: candidate.contactId,
      promptVersion: WORKFLOW_KEY,
      payload: {
        rule: candidate.rule,
        contactName: candidate.contactName,
        lastInteractionAt: candidate.lastInteractionAt?.toISOString() ?? null,
      } as any,
      previewData: {
        rule: candidate.rule,
        ruleLabel: candidate.ruleLabel,
        summary: candidate.summary,
        lastInteractionAt: candidate.lastInteractionAt?.toISOString() ?? null,
        recommendedAction: candidate.recommendedAction,
        suggestedTaskTitle: candidate.suggestedTaskTitle,
        urgency: candidate.urgency,
      } as any,
    },
  });

  return true;
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function formatAge(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / DAY);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
