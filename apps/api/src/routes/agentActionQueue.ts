import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import * as actionQueueService from '../services/actionQueueService.js';
import { executeLeadResponse } from '../services/aiDraftService.js';
import { scanForAgent } from '../services/relationshipMemoryService.js';
import { scanForAgent as scanTransactionRisk } from '../services/transactionRiskService.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

// GET /api/agent/ai/actions
// Query params: status, toolType, contactId, propertyId, transactionId, page, limit
router.get('/', async (req, res, next) => {
  try {
    const result = await actionQueueService.getQueue(req.user.id, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/agent/ai/actions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const action = await actionQueueService.getAction(req.params.id, req.user.id);
    if (!action) return res.status(404).json({ error: 'Action not found' });
    res.json(action);
  } catch (error) {
    next(error);
  }
});

// POST /api/agent/ai/actions/:id/review
// Called when the agent opens the review drawer. Records decidedAt and writes audit log.
router.post('/:id/review', async (req, res, next) => {
  try {
    const action = await actionQueueService.reviewAction(req.params.id, req.user.id);
    if (!action) return res.status(404).json({ error: 'Action not found' });
    res.json(action);
  } catch (error) {
    next(error);
  }
});

// POST /api/agent/ai/actions/:id/dismiss
// Body: { reason?: string }
router.post('/:id/dismiss', async (req, res, next) => {
  try {
    const action = await actionQueueService.dismissAction(
      req.params.id,
      req.user.id,
      req.body.reason,
    );
    if (!action) return res.status(404).json({ error: 'Action not found or already terminal' });
    res.json(action);
  } catch (error) {
    next(error);
  }
});

// POST /api/agent/ai/actions/:id/snooze
// Body: { until: ISO string }
router.post('/:id/snooze', async (req, res, next) => {
  try {
    const { until } = req.body;
    if (!until) return res.status(400).json({ error: 'until is required' });

    const until_date = new Date(until);
    if (isNaN(until_date.getTime())) {
      return res.status(400).json({ error: 'until must be a valid ISO date string' });
    }

    const action = await actionQueueService.snoozeAction(
      req.params.id,
      req.user.id,
      until_date,
    );
    if (!action) return res.status(404).json({ error: 'Action not found or already terminal' });
    res.json(action);
  } catch (error) {
    next(error);
  }
});

// POST /api/agent/ai/actions/scan-transactions
// Manually trigger a transaction risk scan for the authenticated agent.
router.post('/scan-transactions', async (req, res, next) => {
  try {
    const result = await scanTransactionRisk(req.user.id, { maxItems: 15 });
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

// POST /api/agent/ai/actions/scan-relationships
// Manually trigger a relationship memory scan for the authenticated agent.
router.post('/scan-relationships', async (req, res, next) => {
  try {
    const result = await scanForAgent(req.user.id, { maxItems: 20 });
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

// POST /api/agent/ai/actions/:id/execute
// Body: { sendEmail, emailSubject, emailBody, updateStage, updateTags,
//         createTask, taskTitle, taskDueDays, taskPriority }
router.post('/:id/execute', async (req, res, next) => {
  try {
    const {
      sendEmail,
      emailSubject,
      emailBody,
      updateStage,
      updateTags,
      createTask,
      taskTitle,
      taskDueDays,
      taskPriority,
    } = req.body;

    if (typeof sendEmail !== 'boolean') {
      return res.status(400).json({ error: 'sendEmail (boolean) is required' });
    }

    const result = await executeLeadResponse(req.params.id, req.user.id, {
      sendEmail,
      emailSubject,
      emailBody,
      updateStage: updateStage ?? null,
      updateTags: updateTags ?? null,
      createTask: createTask ?? false,
      taskTitle,
      taskDueDays,
      taskPriority,
    });

    if (!result.ok) {
      const status = result.partial ? 207 : 400;
      return res.status(status).json({ error: result.error, partial: result.partial ?? false });
    }

    res.json(result.action);
  } catch (error) {
    next(error);
  }
});

export default router;
