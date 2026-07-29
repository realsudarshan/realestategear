import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import * as transactionService from '../services/transactionService.js';
import {
  createTransactionFromMilestones,
  getSetupTemplate,
  previewTransactionMilestonePlan,
} from '../services/transactionCreationFlowService.js';
import * as transactionDocumentService from '../services/transactionDocumentService.js';
import {
  runTransactionSync,
  getDiscoveredMessages,
  getSyncRuns,
  confirmDiscoveredMessage,
  dismissDiscoveredMessage,
} from '../services/transactionSyncService.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

router.get('/', async (req, res, next) => {
  try {
    const result = await transactionService.getTransactions(req.user.id, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/pipeline', async (req, res, next) => {
  try {
    const grouped = await transactionService.getTransactionsByStage(req.user.id, req.query);
    res.json(grouped);
  } catch (error) {
    next(error);
  }
});

router.get('/setup-template', async (req, res, next) => {
  try {
    const template = await getSetupTemplate();
    res.json(template);
  } catch (error) {
    next(error);
  }
});

router.post('/preview', async (req, res, next) => {
  try {
    const result = await previewTransactionMilestonePlan(req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/create-from-milestones', async (req, res, next) => {
  try {
    const created = await createTransactionFromMilestones(req.user.id, req.body || {});
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/documents', async (req, res, next) => {
  try {
    const documents = await transactionDocumentService.listTransactionDocuments(
      req.user.id,
      req.params.id
    );
    res.json({ documents });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.get('/:id/attachments', async (req, res, next) => {
  try {
    const result = await transactionDocumentService.listTransactionAttachments(
      req.user.id,
      req.params.id
    );
    res.json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.post('/:id/documents', async (req, res, next) => {
  try {
    const doc = await transactionDocumentService.addCustomDocument(
      req.user.id,
      req.params.id,
      req.body || {}
    );
    res.status(201).json(doc);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.patch('/:id/documents/:docId/match', async (req, res, next) => {
  try {
    const { attachmentId } = req.body || {};
    if (!attachmentId) return res.status(400).json({ error: 'attachmentId is required' });
    const doc = await transactionDocumentService.matchDocumentToAttachment(
      req.user.id,
      req.params.id,
      req.params.docId,
      attachmentId
    );
    res.json(doc);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.patch('/:id/documents/:docId/unmatch', async (req, res, next) => {
  try {
    const doc = await transactionDocumentService.unmatchDocument(
      req.user.id,
      req.params.id,
      req.params.docId
    );
    res.json(doc);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.patch('/:id/documents/:docId/verify', async (req, res, next) => {
  try {
    const doc = await transactionDocumentService.verifyDocument(
      req.user.id,
      req.params.id,
      req.params.docId
    );
    res.json(doc);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.post('/:id/documents/:docId/copy-to-drive', async (req, res, next) => {
  try {
    const doc = await transactionDocumentService.copyMatchedDocumentToDrive(
      req.user.id,
      req.params.id,
      req.params.docId
    );
    res.json(doc);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.delete('/:id/documents/:docId', async (req, res, next) => {
  try {
    const result = await transactionDocumentService.deleteCustomDocument(
      req.user.id,
      req.params.id,
      req.params.docId
    );
    res.json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const tx = await transactionService.getTransactionById(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json(tx);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { type, stage, address, mlsId, listPrice, salePrice, commissionRate, closingDate, notes, propertyId, parties } = req.body;
    if (!type) return res.status(400).json({ error: 'Transaction type is required' });
    const tx = await transactionService.createTransaction(req.user.id, {
      type, stage, address, mlsId, listPrice, salePrice, commissionRate,
      closingDate: closingDate ? new Date(closingDate) : null,
      notes, propertyId, parties,
    });
    res.status(201).json(tx);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const tx = await transactionService.updateTransaction(req.params.id, req.body);
    res.json(tx);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Transaction not found' });
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await transactionService.deleteTransaction(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Transaction not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/:id/parties', async (req, res, next) => {
  try {
    const { contactId, role } = req.body;
    if (!contactId || !role) return res.status(400).json({ error: 'contactId and role required' });
    const party = await transactionService.addParty(req.params.id, contactId, role);
    res.status(201).json(party);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/parties', async (req, res, next) => {
  try {
    const { contactId, role } = req.body;
    const removed = await transactionService.removeParty(req.params.id, contactId, role);
    if (!removed) return res.status(404).json({ error: 'Party not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ─── Gmail Sync Routes ────────────────────────────────────────────────

// POST /:id/sync — trigger a new search-based sync run (async, returns syncRunId)
router.post('/:id/sync', async (req, res, next) => {
  try {
    const result = await runTransactionSync(req.params.id, req.user.id);
    res.status(202).json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// GET /:id/sync-runs — last 10 sync run records for status polling
router.get('/:id/sync-runs', async (req, res, next) => {
  try {
    const runs = await getSyncRuns(req.params.id, req.user.id);
    res.json({ runs });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// GET /:id/discovered-messages — inbox messages (filterable by status)
router.get('/:id/discovered-messages', async (req, res, next) => {
  try {
    const { status } = req.query;
    const messages = await getDiscoveredMessages(
      req.params.id,
      req.user.id,
      { status: typeof status === 'string' ? status : undefined }
    );
    res.json({ messages });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// POST /:id/discovered-messages/:msgId/confirm
router.post('/:id/discovered-messages/:msgId/confirm', async (req, res, next) => {
  try {
    const result = await confirmDiscoveredMessage(req.params.msgId, req.user.id);
    res.json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// POST /:id/discovered-messages/:msgId/dismiss
router.post('/:id/discovered-messages/:msgId/dismiss', async (req, res, next) => {
  try {
    const result = await dismissDiscoveredMessage(req.params.msgId, req.user.id);
    res.json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

export default router;
