import { Router } from 'express';
import type { InquiryStatus, Prisma } from 'db';
import { prisma } from 'db';
import { requireRole } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = Router();
const STATUSES = ['NEW', 'READ', 'RESPONDED', 'ARCHIVED'] as const;
router.use(requireRole(['AGENT', 'ADMIN']));

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    if (status && !STATUSES.includes(status as InquiryStatus)) return res.status(400).json({ error: 'Invalid status' });
    const member = await prisma.accountMember.findFirst({ where: { userId: req.user.id }, select: { accountId: true } });
    if (!member) return res.json({ inquiries: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const where: Prisma.InquiryWhereInput = {
      accountId: member.accountId,
      ...(status ? { status: status as InquiryStatus } : {}),
      ...(search.length >= 2 ? { OR: [
        { visitorName: { contains: search, mode: 'insensitive' } },
        { visitorEmail: { contains: search, mode: 'insensitive' } },
        { listing: { property: { address: { contains: search, mode: 'insensitive' } } } },
      ] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        include: { listing: { include: { property: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.inquiry.count({ where }),
    ]);
    const inquiries = rows.map((row) => ({
      ...row,
      user: {
        id: row.userId,
        firstName: row.visitorName.split(/\s+/)[0] ?? '',
        lastName: row.visitorName.split(/\s+/).slice(1).join(' '),
        email: row.visitorEmail,
      },
      property: row.listing ? {
        id: row.listing.property.id,
        address: row.listing.property.address,
        city: row.listing.property.city,
        state: row.listing.property.state,
        price: row.listing.listPrice,
        imageUrl: row.listing.imageUrl,
        slug: row.listing.slug,
      } : null,
    }));
    res.json({ inquiries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    logger.error('Error fetching agent inquiries:', { error });
    next(error);
  }
});

router.put('/:id/respond', async (req, res, next) => {
  try {
    const agentResponse = typeof req.body?.agentResponse === 'string' ? req.body.agentResponse.trim() : '';
    if (!agentResponse) return res.status(400).json({ error: 'agentResponse is required' });
    const member = await prisma.accountMember.findFirst({ where: { userId: req.user.id }, select: { accountId: true } });
    if (!member) return res.status(403).json({ error: 'Account membership required' });
    const changed = await prisma.inquiry.updateMany({
      where: { id: req.params.id, accountId: member.accountId },
      data: { agentResponse, status: 'RESPONDED', respondedAt: new Date() },
    });
    if (changed.count === 0) return res.status(404).json({ error: 'Inquiry not found' });
    const updated = await prisma.inquiry.findFirst({ where: { id: req.params.id, accountId: member.accountId } });
    res.json(updated);
  } catch (error) {
    logger.error('Error responding to inquiry:', { error });
    next(error);
  }
});

export default router;
