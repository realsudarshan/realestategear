import { AIActionStatus, Prisma, prisma } from 'db';
import { QUEUE_DISPLAY_STATUSES } from '../constants/aiActionStatuses.js';

const ACTIVE_STATUSES: AIActionStatus[] = [...QUEUE_DISPLAY_STATUSES];

const ACTION_INCLUDE = {
  contact: { select: { id: true, firstName: true, lastName: true, stage: true, email: true } },
  property: { select: { id: true, address: true, city: true, state: true } },
  transaction: { select: { id: true, address: true, stage: true, type: true } },
} as const;

export async function getQueue(userId: string, filters: Record<string, string> = {}) {
  const {
    status,
    toolType,
    contactId,
    propertyId,
    transactionId,
    page = '1',
    limit = '25',
  } = filters;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);
  const now = new Date();

  const where: Prisma.AIActionWhereInput = { userId };

  if (status) {
    where.status = status as AIActionStatus;
  } else {
    // Default: active queue — pending items and failed items for review;
    // exclude snoozed items whose snooze window hasn't expired yet.
    where.OR = [
      { status: 'PENDING' },
      { status: 'FAILED' },
      { status: 'SNOOZED', snoozedUntil: { lte: now } },
    ];
  }

  if (toolType) where.toolType = toolType;
  if (contactId) where.contactId = contactId;
  if (propertyId) where.propertyId = propertyId;
  if (transactionId) where.transactionId = transactionId;

  const [actions, total] = await Promise.all([
    prisma.aIAction.findMany({
      where,
      skip,
      take,
      orderBy: [{ priority: 'desc' }, { suggestedAt: 'asc' }],
      include: ACTION_INCLUDE,
    }),
    prisma.aIAction.count({ where }),
  ]);

  return {
    actions,
    pagination: {
      page: parseInt(page),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
}

export async function getAction(id: string, userId: string) {
  return prisma.aIAction.findFirst({
    where: { id, userId },
    include: ACTION_INCLUDE,
  });
}

export async function reviewAction(id: string, userId: string) {
  const action = await prisma.aIAction.findFirst({ where: { id, userId } });
  if (!action) return null;

  // Record the review timestamp (idempotent — only set if not already set).
  const updated = await prisma.aIAction.update({
    where: { id },
    data: { decidedAt: action.decidedAt ?? new Date() },
    include: ACTION_INCLUDE,
  });

  await writeAuditLog(userId, 'action_reviewed', id, {
    previousStatus: action.status,
    toolType: action.toolType,
  });

  return updated;
}

export async function dismissAction(id: string, userId: string, reason?: string) {
  const action = await prisma.aIAction.findFirst({ where: { id, userId } });
  if (!action) return null;

  // Cannot dismiss a terminal action.
  if (['EXECUTED', 'SENT', 'DISMISSED', 'EXPIRED'].includes(action.status)) return null;

  const updated = await prisma.aIAction.update({
    where: { id },
    data: {
      status: 'DISMISSED',
      decidedAt: new Date(),
    },
    include: ACTION_INCLUDE,
  });

  await writeAuditLog(userId, 'action_dismissed', id, {
    previousStatus: action.status,
    toolType: action.toolType,
    reason: reason ?? null,
  });

  return updated;
}

export async function snoozeAction(id: string, userId: string, until: Date) {
  const action = await prisma.aIAction.findFirst({ where: { id, userId } });
  if (!action) return null;

  if (['EXECUTED', 'SENT', 'DISMISSED', 'EXPIRED'].includes(action.status)) return null;

  const updated = await prisma.aIAction.update({
    where: { id },
    data: {
      status: 'SNOOZED',
      snoozedUntil: until,
    },
    include: ACTION_INCLUDE,
  });

  await writeAuditLog(userId, 'action_snoozed', id, {
    previousStatus: action.status,
    toolType: action.toolType,
    snoozedUntil: until.toISOString(),
  });

  return updated;
}

// ─── Audit log helper ─────────────────────────────────────────────────────────

async function writeAuditLog(
  userId: string,
  eventType: string,
  actionId: string,
  eventData: Prisma.InputJsonValue,
) {
  await prisma.aIAuditLog.create({
    data: {
      userId,
      eventType,
      eventCategory: 'ACTION_QUEUE',
      actionId,
      eventData,
      occurredAt: new Date(),
    },
  });
}
