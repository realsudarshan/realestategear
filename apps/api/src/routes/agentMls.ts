import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { prisma } from 'db';
import { verifyAndLinkMlsAccess } from '../services/mlsVerificationService.js';
import { resolveMlsBoardName } from '../utils/mlsBoardName.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

// GET /api/agent/mls/status — current MLS access for the authenticated account
router.get('/status', async (req, res, next) => {
  try {
    if (!req.user?.accountId) return res.status(401).json({ error: 'Unauthorized' });

    const access = await prisma.accountMlsAccess.findFirst({
      where: { accountId: req.user.accountId },
      orderBy: { verifiedAt: 'desc' },
    });
    if (!access) return res.json({ verified: false });
    res.json({
      verified: true,
      mlsBoardId: access.mlsBoardId,
      mlsBoardName: resolveMlsBoardName(access.mlsBoardId),
      membershipId: access.membershipId,
      verifiedAt: access.verifiedAt,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/mls/verify — submit an MLS id for verification
router.post('/verify', async (req, res, next) => {
  try {
    if (!req.user?.accountId) return res.status(401).json({ error: 'Unauthorized' });

    const { mlsId } = req.body;
    if (!mlsId || typeof mlsId !== 'string' || mlsId.length > 64) {
      return res.status(400).json({ error: 'mlsId is required and must be 64 characters or fewer.' });
    }
    const result = await verifyAndLinkMlsAccess(req.user.accountId, mlsId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
