/**
 * contactActivityDenormService — refreshes denormalized activity fields on a
 * Contact after interactions or tasks change.
 *
 * Fields maintained:
 *   lastInteractionAt — most recent ContactInteraction.occurredAt
 *   lastConsultAt     — most recent CONSULT interaction
 *   lastEventAt       — most recent MEETING or TOUR interaction
 *   nextTaskDueAt     — earliest TODO/IN_PROGRESS task dueDate
 *
 * Call refresh() fire-and-forget after any of the above change.
 */
import { prisma } from 'db';
import logger from '../utils/logger.js';

const CONSULT_TYPES: string[] = ['CONSULT'];
const EVENT_TYPES: string[] = ['MEETING', 'TOUR'];

export async function refresh(contactId: string): Promise<void> {
  try {
    const [lastInteraction, lastConsult, lastEvent, nextTask] = await Promise.all([
      prisma.contactInteraction.findFirst({
        where: { contactId },
        orderBy: { occurredAt: 'desc' },
        select: { occurredAt: true },
      }),
      prisma.contactInteraction.findFirst({
        where: { contactId, type: { in: CONSULT_TYPES } },
        orderBy: { occurredAt: 'desc' },
        select: { occurredAt: true },
      }),
      prisma.contactInteraction.findFirst({
        where: { contactId, type: { in: EVENT_TYPES } },
        orderBy: { occurredAt: 'desc' },
        select: { occurredAt: true },
      }),
      prisma.task.findFirst({
        where: {
          contactId,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          dueDate: { not: null },
        },
        orderBy: { dueDate: 'asc' },
        select: { dueDate: true },
      }),
    ]);

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        lastInteractionAt: lastInteraction?.occurredAt ?? null,
        lastConsultAt: lastConsult?.occurredAt ?? null,
        lastEventAt: lastEvent?.occurredAt ?? null,
        nextTaskDueAt: nextTask?.dueDate ?? null,
      },
    });
  } catch (err) {
    logger.warn(`contactActivityDenormService: refresh failed for contact ${contactId}:`, { error: err });
  }
}
