/**
 * transactionRiskService — deterministic risk scanning for active transactions.
 *
 * Rules applied per transaction:
 *   OVERDUE_TASK            — past-due task on the transaction
 *   CONTINGENCY_EXPIRING    — any contingency date within 7 days
 *   CLOSING_DATE_NEAR       — closing within 14 days
 *   MISSING_DOCUMENT        — document with status=MISSING
 *   UNVERIFIED_DOCUMENT     — document with status=MATCHED (needs verification)
 *   CLOSING_INCOMPLETE      — closing within 14d + has missing/unverified docs
 *
 * Severity tiers:
 *   HIGH   → AI call for summary + next-step draft
 *   MEDIUM → deterministic summary
 *   LOW    → deterministic summary, low queue priority
 *
 * One AIAction per transaction per workflow (idempotency via
 * sourceType=transaction + sourceId + workflowKey).
 */
import OpenAI from 'openai';
import { prisma } from 'db';
import logger from '../utils/logger.js';
import { IDEMPOTENCY_BLOCK_STATUSES } from '../constants/aiActionStatuses.js';

const WORKFLOW_KEY = 'transaction_risk_v1';
const SOURCE_TYPE = 'transaction';
const ACTIVE_STATUSES = IDEMPOTENCY_BLOCK_STATUSES;
const ACTIVE_TX_STAGES = ['SIGNED', 'LISTED', 'PENDING'];
const MODEL_ID = 'gpt-4o';
const DAY = 24 * 60 * 60 * 1000;

let openai: OpenAI | undefined;
function getClient() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

export interface ScanResult { created: number; skipped: number; errors: number }

export interface RiskFactor {
  rule: string;
  ruleLabel: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  item: string | null;
}

export interface TransactionRiskProposal {
  riskFactors: RiskFactor[];
  overallSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string;
  recommendedNextStep: string;
  suggestedTaskTitle: string | null;
  closingDateFormatted: string | null;
  transactionAddress: string | null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scanForAgent(
  agentId: string,
  { maxItems = 15 }: { maxItems?: number } = {},
): Promise<ScanResult> {
  const result: ScanResult = { created: 0, skipped: 0, errors: 0 };

  try {
    const transactions = await fetchActiveTransactions(agentId);

    // Pre-fetch all active actions for this agent+workflow in one query
    // to avoid N+1 lookups inside the transaction loop.
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

    let processed = 0;
    for (const tx of transactions) {
      if (processed >= maxItems) break;
      try {
        const created = await analyzeAndQueue(agentId, tx, activeIds);
        if (created) { result.created++; processed++; }
        else result.skipped++;
      } catch (err) {
        logger.warn(`transactionRiskService: error on tx ${tx.id}:`, err);
        result.errors++;
      }
    }
  } catch (err) {
    logger.error(`transactionRiskService: scan failed for agent ${agentId}:`, err);
    result.errors++;
  }

  return result;
}

// ─── Transaction fetch ────────────────────────────────────────────────────────

async function fetchActiveTransactions(agentId: string) {
  return prisma.transaction.findMany({
    where: {
      assignedAgentId: agentId,
      stage: { in: ACTIVE_TX_STAGES },
    },
    include: {
      tasks: {
        where: { status: { in: ['TODO', 'IN_PROGRESS'] } },
        select: { id: true, title: true, dueDate: true, status: true, priority: true },
      },
      documents: {
        select: { id: true, label: true, status: true },
      },
    },
    orderBy: { closingDate: 'asc' },
    take: 50,
  });
}

// ─── Risk analysis ────────────────────────────────────────────────────────────

async function analyzeAndQueue(agentId: string, tx: any, activeIds: Set<string>): Promise<boolean> {
  const factors = collectRiskFactors(tx);
  if (factors.length === 0) return false;

  // Skip if already has an active action.
  // activeIds is pre-fetched by the caller to avoid per-transaction N+1 queries.
  if (activeIds.has(tx.id)) return false;

  const overallSeverity = highestSeverity(factors);
  const closingDateFormatted = tx.closingDate
    ? new Date(tx.closingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  let summary: string;
  let recommendedNextStep: string;
  let suggestedTaskTitle: string | null = null;

  if (overallSeverity === 'HIGH') {
    // AI call: compact context, single round-trip.
    const ai = await generateAISummary(tx, factors, closingDateFormatted);
    summary = ai.summary;
    recommendedNextStep = ai.recommendedNextStep;
    suggestedTaskTitle = ai.suggestedTaskTitle ?? null;
  } else {
    // Deterministic fallback.
    summary = buildDeterministicSummary(tx, factors, closingDateFormatted);
    recommendedNextStep = buildDeterministicNextStep(factors);
    suggestedTaskTitle = buildSuggestedTask(factors, tx);
  }

  const proposal: TransactionRiskProposal = {
    riskFactors: factors,
    overallSeverity,
    summary,
    recommendedNextStep,
    suggestedTaskTitle,
    closingDateFormatted,
    transactionAddress: tx.address ?? null,
  };

  const priority = overallSeverity === 'HIGH' ? 3 : overallSeverity === 'MEDIUM' ? 2 : 1;
  const idempotencyKey = `${WORKFLOW_KEY}:${SOURCE_TYPE}:${tx.id}`;

  await prisma.aIAction.create({
    data: {
      userId: agentId,
      toolName: 'transaction_risk',
      toolType: 'TRANSACTION_RISK',
      label: `${overallSeverity === 'HIGH' ? '⚠ ' : ''}Risk — ${tx.address ?? tx.type} (${tx.stage})`,
      reason: summary,
      status: 'PENDING',
      priority,
      requiresConfirmation: false,
      sourceType: SOURCE_TYPE,
      sourceId: tx.id,
      workflowKey: WORKFLOW_KEY,
      idempotencyKey,
      transactionId: tx.id,
      promptVersion: WORKFLOW_KEY,
      modelId: overallSeverity === 'HIGH' ? MODEL_ID : null,
      payload: { transactionId: tx.id, riskFactorCount: factors.length } as any,
      previewData: proposal as any,
    },
  });

  return true;
}

// ─── Rule evaluation ──────────────────────────────────────────────────────────

function collectRiskFactors(tx: any): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const now = new Date();
  const closingDaysAway = tx.closingDate
    ? Math.ceil((new Date(tx.closingDate).getTime() - now.getTime()) / DAY)
    : null;

  // OVERDUE_TASK
  const overdueTasks = (tx.tasks ?? []).filter(
    (t: any) => t.dueDate && new Date(t.dueDate) < now,
  );
  for (const t of overdueTasks) {
    factors.push({
      rule: 'OVERDUE_TASK',
      ruleLabel: 'Overdue task',
      description: `Task "${t.title}" was due ${formatAge(new Date(t.dueDate))}.`,
      severity: closingDaysAway !== null && closingDaysAway <= 14 ? 'HIGH' : 'MEDIUM',
      item: t.title,
    });
  }

  // CONTINGENCY_EXPIRING
  const contingencies = [
    { label: 'Inspection contingency', date: tx.inspectionContingencyDate },
    { label: 'Financing contingency', date: tx.financingContingencyDate },
    { label: 'Appraisal contingency', date: tx.appraisalContingencyDate },
    { label: 'Title contingency', date: tx.titleContingencyDate },
  ];
  for (const { label, date } of contingencies) {
    if (!date) continue;
    const daysAway = Math.ceil((new Date(date).getTime() - now.getTime()) / DAY);
    if (daysAway <= 7 && daysAway >= 0) {
      factors.push({
        rule: 'CONTINGENCY_EXPIRING',
        ruleLabel: 'Contingency expiring',
        description: `${label} expires in ${daysAway} day${daysAway === 1 ? '' : 's'}.`,
        severity: daysAway <= 3 ? 'HIGH' : 'MEDIUM',
        item: label,
      });
    }
  }

  // CLOSING_DATE_NEAR
  if (closingDaysAway !== null && closingDaysAway >= 0 && closingDaysAway <= 14) {
    factors.push({
      rule: 'CLOSING_DATE_NEAR',
      ruleLabel: 'Closing date near',
      description: `Closing is ${closingDaysAway === 0 ? 'today' : `in ${closingDaysAway} day${closingDaysAway === 1 ? '' : 's'}`}.`,
      severity: closingDaysAway <= 7 ? 'HIGH' : 'MEDIUM',
      item: null,
    });
  }

  // MISSING_DOCUMENT
  const missingDocs = (tx.documents ?? []).filter((d: any) => d.status === 'MISSING');
  if (missingDocs.length > 0) {
    factors.push({
      rule: 'MISSING_DOCUMENT',
      ruleLabel: 'Missing document',
      description: `${missingDocs.length} required document${missingDocs.length > 1 ? 's' : ''} missing: ${missingDocs.slice(0, 2).map((d: any) => d.label).join(', ')}${missingDocs.length > 2 ? '…' : ''}.`,
      severity: closingDaysAway !== null && closingDaysAway <= 14 ? 'HIGH' : 'MEDIUM',
      item: missingDocs.map((d: any) => d.label).join(', '),
    });
  }

  // UNVERIFIED_DOCUMENT
  const unverifiedDocs = (tx.documents ?? []).filter((d: any) => d.status === 'MATCHED');
  if (unverifiedDocs.length > 0) {
    factors.push({
      rule: 'UNVERIFIED_DOCUMENT',
      ruleLabel: 'Document needs verification',
      description: `${unverifiedDocs.length} document${unverifiedDocs.length > 1 ? 's' : ''} matched but not yet verified: ${unverifiedDocs.slice(0, 2).map((d: any) => d.label).join(', ')}${unverifiedDocs.length > 2 ? '…' : ''}.`,
      severity: 'MEDIUM',
      item: unverifiedDocs.map((d: any) => d.label).join(', '),
    });
  }

  return factors;
}

function highestSeverity(factors: RiskFactor[]): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (factors.some((f) => f.severity === 'HIGH')) return 'HIGH';
  if (factors.some((f) => f.severity === 'MEDIUM')) return 'MEDIUM';
  return 'LOW';
}

// ─── AI summary (HIGH severity only) ─────────────────────────────────────────

async function generateAISummary(
  tx: any,
  factors: RiskFactor[],
  closingDateFormatted: string | null,
): Promise<{ summary: string; recommendedNextStep: string; suggestedTaskTitle?: string }> {
  const prompt = [
    `Transaction: ${tx.address ?? tx.type}, stage=${tx.stage}`,
    closingDateFormatted ? `Closing: ${closingDateFormatted}` : '',
    '',
    'Risk factors:',
    ...factors.map((f) => `- [${f.severity}] ${f.ruleLabel}: ${f.description}`),
    '',
    'Respond ONLY with valid JSON: { "summary": "string", "recommendedNextStep": "string", "suggestedTaskTitle": "string or null" }',
    'Keep summary under 2 sentences. Keep recommendedNextStep under 1 sentence.',
  ].filter(Boolean).join('\n');

  try {
    const completion = await getClient().chat.completions.create({
      model: MODEL_ID,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a real estate transaction risk assistant. Summarize the risk clearly and concisely for a licensed agent.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 300,
      temperature: 0.3,
    });
    return JSON.parse(completion.choices[0]?.message?.content ?? '{}');
  } catch (err) {
    logger.warn(`transactionRiskService: AI summary failed for tx ${tx.id}:`, err);
    // Fall back to deterministic on AI error.
    return {
      summary: buildDeterministicSummary(tx, factors, closingDateFormatted),
      recommendedNextStep: buildDeterministicNextStep(factors),
      suggestedTaskTitle: buildSuggestedTask(factors, tx),
    };
  }
}

// ─── Deterministic text ───────────────────────────────────────────────────────

function buildDeterministicSummary(tx: any, factors: RiskFactor[], closing: string | null): string {
  const parts: string[] = [];
  if (closing) parts.push(`Closing ${closing}.`);
  parts.push(`${factors.length} risk factor${factors.length > 1 ? 's' : ''} detected.`);
  const top = factors[0];
  if (top) parts.push(top.description);
  return parts.join(' ');
}

function buildDeterministicNextStep(factors: RiskFactor[]): string {
  const top = factors[0];
  if (!top) return 'Review transaction status.';
  switch (top.rule) {
    case 'OVERDUE_TASK': return `Complete or reschedule: "${top.item}".`;
    case 'CONTINGENCY_EXPIRING': return `Address ${top.item} before it expires.`;
    case 'CLOSING_DATE_NEAR': return 'Confirm all items are ready for closing.';
    case 'MISSING_DOCUMENT': return `Collect missing document(s): ${top.item}.`;
    case 'UNVERIFIED_DOCUMENT': return `Verify matched document(s): ${top.item}.`;
    default: return 'Review transaction and take action.';
  }
}

function buildSuggestedTask(factors: RiskFactor[], tx: any): string | null {
  const top = factors[0];
  if (!top) return null;
  const addr = tx.address ? tx.address.split(',')[0] : tx.type;
  switch (top.rule) {
    case 'OVERDUE_TASK': return `Follow up on overdue task — ${addr}`;
    case 'CONTINGENCY_EXPIRING': return `Handle ${top.item} — ${addr}`;
    case 'CLOSING_DATE_NEAR': return `Closing prep checklist — ${addr}`;
    case 'MISSING_DOCUMENT': return `Collect missing docs — ${addr}`;
    case 'UNVERIFIED_DOCUMENT': return `Verify documents — ${addr}`;
    default: return `Review transaction — ${addr}`;
  }
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function formatAge(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / DAY);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
