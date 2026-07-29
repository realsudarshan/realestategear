import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { Prisma, prisma } from 'db';
import { generateMarketingCopy } from '../services/aiService.js';

const router = Router();

router.use(requireRole(['AGENT', 'ADMIN']));

router.get('/', async (req, res, next) => {
  try {
    const { page = '1', limit = '20', status, type } = req.query as Record<string, string | undefined>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: Prisma.CampaignWhereInput = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.campaign.count({ where }),
    ]);

    res.json({ campaigns, pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) } });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, type, status, content, targetAudience, scheduledAt } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
    const campaign = await prisma.campaign.create({
      data: {
        name, type,
        status: status || 'DRAFT',
        content: content || {},
        targetAudience: targetAudience || {},
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });
    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(campaign);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Campaign not found' });
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.campaign.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Campaign not found' });
    next(error);
  }
});

router.post('/:id/generate-content', async (req, res, next) => {
  try {
    const { contentType, context } = req.body;
    if (!contentType) return res.status(400).json({ error: 'contentType is required' });

    const content = await generateMarketingCopy(contentType, context || {});
    res.json({ content });
  } catch (error) {
    next(error);
  }
});

export default router;
