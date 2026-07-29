import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import * as marketReportService from '../services/marketReportService.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

router.get('/', async (req, res, next) => {
  try {
    const result = await marketReportService.getReports(req.user.id, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const report = await marketReportService.getReportById(req.params.id, req.user.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.post('/generate', async (req, res, next) => {
  try {
    const { propertyId } = req.body;
    if (!propertyId) return res.status(400).json({ error: 'propertyId is required' });
    const report = await marketReportService.generateReport(req.user.id, propertyId);
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, subjectPropertyAddress, subjectPropertyData, comparables, aiAnalysis, status } = req.body;
    if (!title || !subjectPropertyAddress) {
      return res.status(400).json({ error: 'title and subjectPropertyAddress are required' });
    }
    const report = await marketReportService.createReport(req.user.id, {
      title, subjectPropertyAddress, subjectPropertyData, comparables, aiAnalysis, status,
    });
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const report = await marketReportService.updateReport(req.params.id, req.user.id, req.body);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await marketReportService.deleteReport(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Report not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
