import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import * as reportsService from '../services/reportsService.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

router.get('/summary', async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const data = await reportsService.getReportSummary(req.user.id, req.user.role, req.query);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/trend', async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const data = await reportsService.getReportTrend(req.user.id, req.user.role, req.query);
    res.json({ points: data });
  } catch (error) {
    next(error);
  }
});

router.get('/forecast', async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const data = await reportsService.getReportForecast(req.user.id, req.user.role, req.query);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
