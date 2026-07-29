/**
 * leadResponseAgentService — generates structured AI lead response proposals.
 *
 * Flow:
 *   1. Assemble lead context (leadContextService)
 *   2. Guard against duplicate active actions (idempotency key)
 *   3. Call OpenAI for structured proposal
 *   4. Persist AIContextSnapshot
 *   5. Create AIAction with status=PENDING and previewData=proposal
 */
import OpenAI from 'openai';
import { prisma } from 'db';
import logger from '../utils/logger.js';
import {
  fromInquiry,
  fromContactSubmission,
  type LeadContext,
} from './leadContextService.js';

const WORKFLOW_KEY = 'lead_response_v1';
const MODEL_ID = 'gpt-4o';
const PROMPT_VERSION = 'lead_response_v1';

export interface LeadResponseProposal {
  leadSummary: string;
  qualificationSignals: string[];
  recommendedStrategy: string;
  emailSubject: string;
  emailBody: string;
  suggestedTags: string[];
  suggestedStage: string;
  followUpTask: {
    title: string;
    description: string;
    dueInDays: number;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  } | null;
  missingInfo: string[];
  riskFlags: string[];
}

type SourceType = 'inquiry' | 'contact_submission';

let openai: OpenAI | undefined;
function getClient() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

// ─── Public entrypoint ────────────────────────────────────────────────────────

export async function enqueue(sourceType: SourceType, sourceId: string): Promise<void> {
  try {
    const ctx = await assembleContext(sourceType, sourceId);
    if (!ctx) return;

    const idempotencyKey = `${WORKFLOW_KEY}:${sourceType}:${sourceId}`;

    // Guard: skip if an active action already exists for this source + workflow.
    // The partial unique index on (userId, sourceType, sourceId, workflowKey)
    // WHERE status IN (PENDING, APPROVED, EXECUTING, SNOOZED) enforces this at
    // DB level too, but checking first avoids a needless AI call.
    const existing = await prisma.aIAction.findFirst({
      where: {
        userId: ctx.agentId,
        sourceType,
        sourceId,
        workflowKey: WORKFLOW_KEY,
        status: { in: ['PENDING', 'APPROVED', 'EXECUTING', 'SNOOZED'] },
      },
      select: { id: true },
    });

    if (existing) {
      logger.info(`leadResponseAgentService: active action ${existing.id} already exists for ${idempotencyKey} — skipping`);
      return;
    }

    const proposal = await generateProposal(ctx);
    await persist(ctx, sourceType, sourceId, idempotencyKey, proposal);

    logger.info(`leadResponseAgentService: created lead response action for ${idempotencyKey}`);
  } catch (err) {
    logger.error(`leadResponseAgentService: failed to enqueue ${sourceType}:${sourceId}:`, err);
  }
}

// ─── Context assembly ─────────────────────────────────────────────────────────

async function assembleContext(sourceType: SourceType, sourceId: string): Promise<LeadContext | null> {
  switch (sourceType) {
    case 'inquiry':            return fromInquiry(sourceId);
    case 'contact_submission': return fromContactSubmission(sourceId);
  }
}

// ─── AI generation ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI assistant for a licensed residential real estate agent.
Your job is to draft a professional, personalized response to an inbound lead inquiry.

COMPLIANCE GUARDRAILS — Never include any of the following:
- Assumptions about protected classes (race, religion, national origin, sex, disability, familial status)
- Steering language or neighborhood demographic claims
- Guaranteed pricing, financing certainty, or legal advice
- Claims about property availability without checking current status
- Safety, crime, or school quality claims

If the inquiry contains potentially problematic requests, flag them in riskFlags.

OUTPUT FORMAT — Respond ONLY with a valid JSON object matching this schema exactly:
{
  "leadSummary": "string — 1-2 sentence summary of the lead and their intent",
  "qualificationSignals": ["string", ...],
  "recommendedStrategy": "string — brief recommended response approach",
  "emailSubject": "string",
  "emailBody": "string — professional email body, plain text, 3-5 short paragraphs",
  "suggestedTags": ["string", ...],
  "suggestedStage": "NEW | CONTACTED | QUALIFIED | ACTIVE",
  "followUpTask": {
    "title": "string",
    "description": "string",
    "dueInDays": number,
    "priority": "LOW | MEDIUM | HIGH"
  } or null,
  "missingInfo": ["string", ...],
  "riskFlags": ["string", ...]
}`;

async function generateProposal(ctx: LeadContext): Promise<LeadResponseProposal> {
  const userPrompt = buildPrompt(ctx);

  const completion = await getClient().chat.completions.create({
    model: MODEL_ID,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 1500,
    temperature: 0.4,
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  return JSON.parse(raw) as LeadResponseProposal;
}

function buildPrompt(ctx: LeadContext): string {
  const lines: string[] = [];

  lines.push('=== INBOUND LEAD INQUIRY ===');
  lines.push(`Source: ${ctx.source.type.replace('_', ' ')}`);
  lines.push(`Received: ${ctx.source.submittedAt}`);
  if (ctx.source.inquiryType) lines.push(`Inquiry type: ${ctx.source.inquiryType}`);
  if (ctx.source.contactPreference) lines.push(`Contact preference: ${ctx.source.contactPreference}`);
  lines.push(`Message:\n${ctx.source.message}`);

  lines.push('\n=== LEAD INFORMATION ===');
  lines.push(`Name: ${ctx.lead.firstName} ${ctx.lead.lastName}`);
  lines.push(`Email: ${ctx.lead.email}`);
  if (ctx.lead.phone) lines.push(`Phone: ${ctx.lead.phone}`);
  if (ctx.lead.stage) lines.push(`Current CRM stage: ${ctx.lead.stage}`);
  if (ctx.lead.tags?.length) lines.push(`CRM tags: ${ctx.lead.tags.join(', ')}`);
  lines.push(`Prior interactions: ${ctx.lead.priorInteractionCount}`);
  if (ctx.lead.priorInteractionCount > 0) lines.push('(This is a returning lead — acknowledge continuity)');

  if (ctx.property) {
    lines.push('\n=== PROPERTY OF INTEREST ===');
    lines.push(`${ctx.property.address}, ${ctx.property.city}, ${ctx.property.state}`);
    if (ctx.property.price) lines.push(`Price: $${parseInt(ctx.property.price).toLocaleString()}`);
    if (ctx.property.bedrooms) lines.push(`Beds: ${ctx.property.bedrooms}`);
    if (ctx.property.bathrooms) lines.push(`Baths: ${ctx.property.bathrooms}`);
    if (ctx.property.squareFeet) lines.push(`Sq ft: ${ctx.property.squareFeet.toLocaleString()}`);
    if (ctx.property.status) lines.push(`Status: ${ctx.property.status}`);
    if (ctx.property.propertyType) lines.push(`Type: ${ctx.property.propertyType}`);
  }

  lines.push('\nDraft a professional response email from the agent to this lead.');

  return lines.join('\n');
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function persist(
  ctx: LeadContext,
  sourceType: SourceType,
  sourceId: string,
  idempotencyKey: string,
  proposal: LeadResponseProposal,
): Promise<void> {
  const agentId = ctx.agentId;

  // Snapshot the full context used for generation.
  const snapshot = await prisma.aIContextSnapshot.create({
    data: {
      contextType: 'lead_response',
      entityId: sourceId,
      contextData: ctx as any,
      retrievedItems: proposal as any,
    },
  });

  // Create the action. The partial unique index will reject a duplicate if a
  // concurrent enqueue call somehow slipped through the check above.
  await prisma.aIAction.create({
    data: {
      userId: agentId,
      toolName: 'lead_response',
      toolType: 'LEAD_RESPONSE',
      label: `Lead response — ${ctx.lead.firstName} ${ctx.lead.lastName}`,
      reason: proposal.leadSummary,
      status: 'PENDING',
      priority: ctx.lead.priorInteractionCount > 0 ? 2 : 1,
      requiresConfirmation: true,
      sourceType,
      sourceId,
      workflowKey: WORKFLOW_KEY,
      idempotencyKey,
      contactId: ctx.lead.contactId ?? undefined,
      modelId: MODEL_ID,
      promptVersion: PROMPT_VERSION,
      payload: {
        sourceType,
        sourceId,
        leadContext: ctx,
        promptVersion: PROMPT_VERSION,
        modelId: MODEL_ID,
        snapshotId: snapshot.id,
      } as any,
      previewData: proposal as any,
    },
  });
}
