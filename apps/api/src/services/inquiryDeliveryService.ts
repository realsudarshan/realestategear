import { prisma } from 'db';
import { sendEmail } from 'email';
import logger from '../utils/logger.js';

type DeliveryPayload = { subject: string; text: string };
type Sender = (input: { to: string; subject: string; text: string }) => Promise<{ ok?: boolean; skipped?: boolean; id?: string }>;

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

export async function dispatchInquiryDeliveries(options: {
  limit?: number;
  now?: Date;
  sender?: Sender;
} = {}) {
  const now = options.now ?? new Date();
  const staleLock = new Date(now.getTime() - 15 * 60_000);
  const sender = options.sender ?? sendEmail;
  const candidates = await prisma.inquiryDelivery.findMany({
    where: {
      OR: [
        { state: { in: ['PENDING', 'RETRY'] }, nextAttemptAt: { lte: now } },
        { state: 'PROCESSING', lockedAt: { lte: staleLock } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: Math.min(Math.max(options.limit ?? 25, 1), 100),
    select: { id: true },
  });

  const result = { delivered: 0, retried: 0, deadLettered: 0, skipped: 0 };
  for (const candidate of candidates) {
    const claimed = await prisma.inquiryDelivery.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { state: { in: ['PENDING', 'RETRY'] }, nextAttemptAt: { lte: now } },
          { state: 'PROCESSING', lockedAt: { lte: staleLock } },
        ],
      },
      data: { state: 'PROCESSING', lockedAt: now },
    });
    if (claimed.count === 0) {
      result.skipped++;
      continue;
    }

    const delivery = await prisma.inquiryDelivery.findUniqueOrThrow({ where: { id: candidate.id } });
    try {
      const payload = delivery.payload as DeliveryPayload;
      const sent = await sender({ to: delivery.recipient, subject: payload.subject, text: payload.text });
      if (sent.skipped || sent.ok === false) throw new Error('Email provider is not configured; delivery was not sent');
      await prisma.inquiryDelivery.update({
        where: { id: delivery.id },
        data: {
          state: 'DELIVERED',
          attempts: { increment: 1 },
          deliveredAt: new Date(),
          providerId: sent.id ?? null,
          lockedAt: null,
          lastError: null,
        },
      });
      result.delivered++;
    } catch (error) {
      const attempts = delivery.attempts + 1;
      const dead = attempts >= delivery.maxAttempts;
      await prisma.inquiryDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts,
          state: dead ? 'DEAD_LETTER' : 'RETRY',
          nextAttemptAt: dead
            ? delivery.nextAttemptAt
            : new Date(now.getTime() + RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)]),
          deadLetteredAt: dead ? new Date() : null,
          lockedAt: null,
          lastError: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
        },
      });
      if (dead) result.deadLettered++;
      else result.retried++;
      logger.warn(`Inquiry delivery ${delivery.id} failed (attempt ${attempts}/${delivery.maxAttempts})`);
    }
  }
  return result;
}
