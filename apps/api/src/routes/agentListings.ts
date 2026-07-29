import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { getAgentListingDetail, getListingDiscovery, searchAgentListings } from '../services/agentListingService.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

router.get('/discovery', async (req, res, next) => {
  try {
    const result = await getListingDiscovery(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) return res.json({ listings: [] });

    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 12;
    const listings = await searchAgentListings(req.user, q, Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 12);
    res.json({ listings });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await getAgentListingDetail(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
