import express from 'express';
import { ListingStatus, Prisma, prisma } from 'db';
import { sendEmail } from 'email';
import logger from '../utils/logger.js';
import { enqueue as enqueueLeadResponse } from '../services/leadResponseAgentService.js';
import { scanForAgent } from '../services/relationshipMemoryService.js';
import { scanForAgent as scanTransactionRisk } from '../services/transactionRiskService.js';
import { checkMlsStatuses } from '../services/mlsVerificationService.js';
import { IDEMPOTENCY_BLOCK_STATUSES } from '../constants/aiActionStatuses.js';
import { dispatchInquiryDeliveries } from '../services/inquiryDeliveryService.js';

const router = express.Router();

// Middleware: require CRON_SECRET in Authorization header
function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!secret || token !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// POST /api/cron/saved-search-alerts - Run saved search email alerts (call from cron)
router.post('/saved-search-alerts', requireCronSecret, async (req, res) => {
  try {
    const savedSearches = await prisma.savedSearch.findMany({
      include: {
        user: {
          select: { email: true, firstName: true },
        },
      },
    });

    let sentCount = 0;
    for (const search of savedSearches) {
      const criteria = (search.criteria || {}) as Record<string, any>;
      const listingWhere: Prisma.ListingWhereInput = { status: 'ACTIVE' };
      const where: Prisma.PropertyWhereInput = { listings: { some: listingWhere } };
      if (criteria.city) where.city = { contains: criteria.city, mode: 'insensitive' };
      if (criteria.state) where.state = { contains: criteria.state, mode: 'insensitive' };
      if (criteria.bedrooms) where.bedrooms = { gte: parseInt(criteria.bedrooms) || 0 };
      if (criteria.priceRange && Array.isArray(criteria.priceRange)) {
        const listPrice: Prisma.ListingWhereInput['listPrice'] = {};
        if (criteria.priceRange[0] > 0) listPrice.gte = criteria.priceRange[0];
        if (criteria.priceRange[1] < 5000000) listPrice.lte = criteria.priceRange[1];
        if (Object.keys(listPrice).length > 0) listingWhere.listPrice = listPrice;
      }

      if (search.lastRunAt) {
        where.createdAt = { gt: search.lastRunAt };
      }

      const newCount = await prisma.property.count({ where });
      if (newCount === 0) continue;

      const html = `
        <p>Hi ${search.user.firstName || 'there'},</p>
        <p>${newCount} new ${newCount === 1 ? 'property' : 'properties'} match your saved search "${search.name}".</p>
        <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/properties-list">View properties</a></p>
      `;

      try {
        await sendEmail({
          to: search.user.email,
          subject: `New properties match "${search.name}"`,
          html,
        });
        sentCount++;
        await prisma.savedSearch.update({
          where: { id: search.id },
          data: { lastRunAt: new Date() },
        });
      } catch (emailErr) {
        logger.warn(`Failed to send alert for saved search ${search.id}:`, emailErr.message);
      }
    }

    res.json({ ok: true, alertsSent: sentCount });
  } catch (error) {
    logger.error('Saved search alerts cron error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/cron/lead-response-recovery
// Scans for recent lead sources without an active AIAction and enqueues them.
// Idempotency key prevents duplicate actions; safe to run frequently.
router.post('/lead-response-recovery', requireCronSecret, async (req, res) => {
  try {
    const lookbackHours = parseInt(req.body?.lookbackHours ?? '48');
    const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
    let enqueued = 0;
    let skipped = 0;

    // ─── Canonical inquiries ─────────────────────────────────────────────────
    const inquiries = await prisma.inquiry.findMany({
      where: { createdAt: { gte: since }, respondedAt: null, status: { not: 'RESPONDED' } },
      select: { id: true },
    });

    const existingInquiries = new Set(
      (await prisma.aIAction.findMany({
        where: {
          sourceType: 'inquiry',
          sourceId: { in: inquiries.map((i) => i.id) },
          workflowKey: 'lead_response_v1',
          status: { in: [...IDEMPOTENCY_BLOCK_STATUSES] },
        },
        select: { sourceId: true },
      })).map((a) => a.sourceId!),
    );

    for (const { id } of inquiries) {
      if (existingInquiries.has(id)) { skipped++; continue; }
      await enqueueLeadResponse('inquiry', id).catch((err) =>
        logger.warn(`Recovery: inquiry ${id} failed:`, err.message),
      );
      enqueued++;
    }

    // ─── Contact submissions ─────────────────────────────────────────────────
    const submissions = await prisma.contactSubmission.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true },
    });

    const existingSubmission = new Set(
      (await prisma.aIAction.findMany({
        where: {
          sourceType: 'contact_submission',
          sourceId: { in: submissions.map((i) => i.id) },
          workflowKey: 'lead_response_v1',
          status: { in: [...IDEMPOTENCY_BLOCK_STATUSES] },
        },
        select: { sourceId: true },
      })).map((a) => a.sourceId!),
    );

    for (const { id } of submissions) {
      if (existingSubmission.has(id)) { skipped++; continue; }
      await enqueueLeadResponse('contact_submission', id).catch((err) =>
        logger.warn(`Recovery: contact_submission ${id} failed:`, err.message),
      );
      enqueued++;
    }

    logger.info(`lead-response-recovery: enqueued=${enqueued} skipped=${skipped}`);
    res.json({ ok: true, enqueued, skipped });
  } catch (error) {
    logger.error('Lead response recovery cron error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/cron/inquiry-deliveries - explicit, idempotent outbox dispatcher.
router.post('/inquiry-deliveries', requireCronSecret, async (req, res) => {
  try {
    const result = await dispatchInquiryDeliveries({ limit: Number(req.body?.limit) || 25 });
    res.json({ ok: true, ...result });
  } catch (error) {
    logger.error('Inquiry delivery dispatcher error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// POST /api/cron/relationship-memory-scan
// Runs the relationship memory scan for all agents (or a specific agentId).
// Body: { agentId?: string, maxItemsPerAgent?: number }
router.post('/relationship-memory-scan', requireCronSecret, async (req, res) => {
  try {
    const { agentId, maxItemsPerAgent = 20 } = req.body ?? {};

    let agents: { id: string }[];
    if (agentId) {
      agents = [{ id: agentId }];
    } else {
      agents = await prisma.user.findMany({
        where: { role: { in: ['AGENT', 'ADMIN'] } },
        select: { id: true },
      });
    }

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const agent of agents) {
      const result = await scanForAgent(agent.id, { maxItems: maxItemsPerAgent });
      totalCreated += result.created;
      totalSkipped += result.skipped;
      logger.info(`relationship-memory-scan: agent=${agent.id} created=${result.created} skipped=${result.skipped} errors=${result.errors}`);
    }

    res.json({ ok: true, agents: agents.length, created: totalCreated, skipped: totalSkipped });
  } catch (error) {
    logger.error('Relationship memory scan cron error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/cron/transaction-risk-scan
// Runs the transaction risk scan for all agents (or a specific agentId).
// Body: { agentId?: string, maxItemsPerAgent?: number }
router.post('/transaction-risk-scan', requireCronSecret, async (req, res) => {
  try {
    const { agentId, maxItemsPerAgent = 15 } = req.body ?? {};

    let agents: { id: string }[];
    if (agentId) {
      agents = [{ id: agentId }];
    } else {
      agents = await prisma.user.findMany({
        where: { role: { in: ['AGENT', 'ADMIN'] } },
        select: { id: true },
      });
    }

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const agent of agents) {
      const result = await scanTransactionRisk(agent.id, { maxItems: maxItemsPerAgent });
      totalCreated += result.created;
      totalSkipped += result.skipped;
      logger.info(`transaction-risk-scan: agent=${agent.id} created=${result.created} skipped=${result.skipped} errors=${result.errors}`);
    }

    res.json({ ok: true, agents: agents.length, created: totalCreated, skipped: totalSkipped });
  } catch (error) {
    logger.error('Transaction risk scan cron error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/cron/mls-status-check — daily re-verification of MLS membership
// status (issue #205). Detection only: flags/clears AccountMlsAccess, never
// touches a Portal. Taking a portal down is a manual admin action.
router.post('/mls-status-check', requireCronSecret, async (_req, res) => {
  try {
    const result = await checkMlsStatuses();
    res.json({ ok: true, ...result });
  } catch (error) {
    logger.error('MLS status check cron error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
