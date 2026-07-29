/**
 * aiDraftService — executes an approved lead response action.
 *
 * Execution order (per plan):
 *   1. Revalidate action is current and executable.
 *   2. Acquire execution lease.
 *   3. If email selected: send via Resend first.
 *   4. If email succeeds: apply selected CRM changes in a DB transaction.
 *   5. Mark action SENT (email) or EXECUTED (no email). Write audit.
 *
 * Failure handling:
 *   - Email failure → mark FAILED, do not apply "responded" CRM changes.
 *   - Email success + internal mutation failure → mark FAILED with
 *     partial-execution metadata (do NOT unsend). Surface for repair.
 */
import { Prisma, prisma } from 'db';
import { sendEmail } from 'email';
import logger from '../utils/logger.js';

const LEASE_MS = 90_000; // 90s execution window
const LOCKED_BY = 'agent-hq-api';

export interface ExecuteOptions {
  sendEmail: boolean;
  emailSubject?: string;
  emailBody?: string;
  updateStage?: string | null;
  updateTags?: string[] | null;
  createTask?: boolean;
  taskTitle?: string;
  taskDueDays?: number;
  taskPriority?: string;
}

export interface ExecuteResult {
  ok: boolean;
  action?: Record<string, unknown>;
  error?: string;
  partial?: boolean; // email sent but internal mutation failed
}

// ─── Main execute ─────────────────────────────────────────────────────────────

export async function executeLeadResponse(
  actionId: string,
  agentId: string,
  opts: ExecuteOptions,
): Promise<ExecuteResult> {
  // 1. Revalidate.
  const action = await prisma.aIAction.findFirst({
    where: { id: actionId, userId: agentId },
  });

  if (!action) return { ok: false, error: 'Action not found' };

  if (!['PENDING', 'APPROVED', 'FAILED'].includes(action.status)) {
    return { ok: false, error: `Action is ${action.status} — cannot execute` };
  }

  // Guard: already locked by another process.
  if (action.lockedUntil && action.lockedUntil > new Date()) {
    return { ok: false, error: 'Action is currently being processed' };
  }

  // Check source hasn't already been responded to.
  const alreadySent = await checkAlreadyResponded(action);
  if (alreadySent) {
    await prisma.aIAction.update({
      where: { id: actionId },
      data: { status: 'EXPIRED', lastError: 'Source already responded to by another path' },
    });
    return { ok: false, error: 'Source has already been responded to' };
  }

  // 2. Acquire lease.
  const lease = await prisma.aIAction.updateMany({
    where: {
      id: actionId,
      userId: agentId,
      status: { in: ['PENDING', 'APPROVED', 'FAILED'] },
      OR: [
        { lockedUntil: null },
        { lockedUntil: { lte: new Date() } },
      ],
    },
    data: {
      status: 'EXECUTING',
      lockedBy: LOCKED_BY,
      lockedUntil: new Date(Date.now() + LEASE_MS),
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  if (lease.count !== 1) {
    return { ok: false, error: 'Action is currently being processed' };
  }

  const [agent, agentMember] = await Promise.all([
    prisma.user.findUnique({
      where: { id: agentId },
      select: { email: true, firstName: true, lastName: true },
    }),
    prisma.accountMember.findFirst({ where: { userId: agentId } }),
  ]);

  let resendMessageId: string | undefined;

  // 3. Send email first (if selected).
  if (opts.sendEmail) {
    const recipientEmail = extractRecipientEmail(action);
    if (!recipientEmail) {
      await markFailed(actionId, 'No recipient email found on action');
      return { ok: false, error: 'No recipient email on action' };
    }

    try {
      const result = await sendEmail({
        to: recipientEmail,
        subject: opts.emailSubject ?? 'Response to your inquiry',
        html: toHtml(opts.emailBody ?? ''),
        text: opts.emailBody ?? '',
        replyTo: agent?.email,
      } as any);
      resendMessageId = result.id;
    } catch (err) {
      logger.error(`aiDraftService: email send failed for action ${actionId}:`, err);
      await markFailed(actionId, classifyEmailError(err), { resendError: String(err) });
      return { ok: false, error: 'Email send failed' };
    }
  }

  // 4. Apply internal CRM changes in a transaction.
  let partialError: Error | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      const payload = action.payload as Record<string, any>;
      const sourceType: string | null = action.sourceType;
      const sourceId: string | null = action.sourceId;

      // Update inquiry status when email was sent.
      if (opts.sendEmail && sourceType && sourceId) {
        await markSourceResponded(tx, sourceType, sourceId);
      }

      // Log contact interaction.
      if (action.contactId && opts.sendEmail) {
        await tx.contactInteraction.create({
          data: {
            contactId: action.contactId,
            type: 'EMAIL',
            subject: opts.emailSubject ?? 'Lead response',
            body: opts.emailBody ?? '',
          },
        });
      }

      // Update contact stage.
      if (action.contactId && opts.updateStage) {
        await tx.contact.update({
          where: { id: action.contactId },
          data: { stage: opts.updateStage },
        });
      }

      // Update contact tags.
      if (action.contactId && opts.updateTags && opts.updateTags.length > 0) {
        await tx.contact.update({
          where: { id: action.contactId },
          data: { tags: opts.updateTags },
        });
      }

      // Create follow-up task.
      if (opts.createTask && opts.taskTitle && action.contactId && agentMember) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (opts.taskDueDays ?? 3));
        await tx.task.create({
          data: {
            title: opts.taskTitle,
            accountId: agentMember.accountId,
            assignedToId: agentId,
            contactId: action.contactId,
            dueDate,
            priority: opts.taskPriority ?? 'MEDIUM',
            status: 'TODO',
          },
        });
      }
    });
  } catch (err) {
    partialError = err as Error;
    logger.error(`aiDraftService: CRM transaction failed for action ${actionId}:`, err);
  }

  // 5. Mark action terminal and write audit.
  if (partialError) {
    // Email was sent but internal mutation failed — do not retry the send.
    const newStatus = 'FAILED';
    await prisma.aIAction.update({
      where: { id: actionId },
      data: {
        status: newStatus,
        lastError: `CRM update failed after ${opts.sendEmail ? 'successful email send' : 'no-email execute'}: ${partialError.message}`,
        lockedBy: null,
        lockedUntil: null,
      },
    });
    await writeAuditLog(agentId, 'action_execution_partial', actionId, {
      resendMessageId,
      error: partialError.message,
      partial: true,
    });
    return { ok: false, partial: true, error: 'Email sent but CRM update failed — check action queue' };
  }

  const finalStatus = opts.sendEmail ? 'SENT' : 'EXECUTED';
  const updated = await prisma.aIAction.update({
    where: { id: actionId },
    data: {
      status: finalStatus,
      executedAt: new Date(),
      decidedAt: action.decidedAt ?? new Date(),
      lockedBy: null,
      lockedUntil: null,
      lastError: null,
    },
  });

  await writeAuditLog(agentId, 'action_executed', actionId, {
    finalStatus,
    resendMessageId,
    sendEmail: opts.sendEmail,
    updateStage: opts.updateStage ?? null,
    createTask: opts.createTask ?? false,
  });

  return { ok: true, action: updated };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function checkAlreadyResponded(action: any): Promise<boolean> {
  if (!action.sourceType || !action.sourceId) return false;

  if (action.sourceType === 'inquiry') {
    const inq = await prisma.inquiry.findUnique({
      where: { id: action.sourceId },
      select: { status: true, respondedAt: true },
    });
    return inq?.status === 'RESPONDED' || Boolean(inq?.respondedAt);
  }

  return false;
}

async function markSourceResponded(tx: any, sourceType: string, sourceId: string): Promise<void> {
  if (sourceType === 'inquiry') {
    await tx.inquiry.update({
      where: { id: sourceId },
      data: { status: 'RESPONDED', respondedAt: new Date() },
    });
  }
  // ContactSubmission has no status field — no update needed.
}

function extractRecipientEmail(action: any): string | null {
  const payload = action.payload as Record<string, any>;
  return payload?.leadContext?.lead?.email ?? null;
}

function toHtml(text: string): string {
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}

function classifyEmailError(err: unknown): string {
  const msg = String(err).toLowerCase();
  if (msg.includes('invalid') && msg.includes('email')) return 'Invalid recipient address';
  if (msg.includes('429') || msg.includes('rate')) return 'Provider rate limit';
  if (msg.includes('5') && msg.includes('0')) return 'Provider server error';
  return `Send failed: ${String(err).slice(0, 200)}`;
}

async function markFailed(
  actionId: string,
  reason: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await prisma.aIAction.update({
    where: { id: actionId },
    data: {
      status: 'FAILED',
      lastError: reason,
      lockedBy: null,
      lockedUntil: null,
    },
  });
  await prisma.aIAuditLog.create({
    data: {
      userId: (await prisma.aIAction.findUnique({ where: { id: actionId }, select: { userId: true } }))!.userId,
      eventType: 'action_execution_failed',
      eventCategory: 'ACTION_QUEUE',
      actionId,
      eventData: { reason, ...extra },
    },
  });
}

async function writeAuditLog(
  userId: string,
  eventType: string,
  actionId: string,
  eventData: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.aIAuditLog.create({
    data: {
      userId,
      eventType,
      eventCategory: 'ACTION_QUEUE',
      actionId,
      eventData,
    },
  });
}
