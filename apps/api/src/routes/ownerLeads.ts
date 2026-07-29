import { Router } from 'express';
import type { InquirySource, InquiryStatus, Prisma } from 'db';
import { prisma } from 'db';
import logger from '../utils/logger.js';

const router = Router();
const STATUSES = ['NEW', 'READ', 'RESPONDED', 'ARCHIVED'] as const;
const SOURCES = ['PORTAL_ANONYMOUS', 'PORTAL_AUTHENTICATED'] as const;
const MAX_PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 1000;

async function ownerScope(userId: string, portalId?: string, portalSlug?: string) {
  if (portalId || portalSlug) {
    const portal = await prisma.portal.findFirst({
      where: portalId ? { id: portalId } : { slug: portalSlug },
      select: { id: true, accountId: true },
    });
    if (!portal) return null;
    const membership = await prisma.accountMember.findFirst({
      where: { userId, accountId: portal.accountId, role: 'OWNER' },
      select: { accountId: true },
    });
    return membership ? { accountId: portal.accountId, portalId: portal.id } : null;
  }

  const membership = await prisma.accountMember.findFirst({
    where: { userId, role: 'OWNER' },
    select: { accountId: true },
  });
  if (!membership) return null;

  return { accountId: membership.accountId, portalId: undefined };
}

function parseFilters(req): { status?: InquiryStatus; source?: InquirySource; error?: string } {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const source = typeof req.query.source === 'string' ? req.query.source : undefined;
  if (status && !STATUSES.includes(status as InquiryStatus)) return { error: 'Invalid status filter' };
  if (source && !SOURCES.includes(source as InquirySource)) return { error: 'Invalid source filter' };
  return { status: status as InquiryStatus | undefined, source: source as InquirySource | undefined };
}

function leadWhere(scope: { accountId: string; portalId?: string }, filters: { status?: InquiryStatus; source?: InquirySource }, search?: string): Prisma.InquiryWhereInput {
  return {
    accountId: scope.accountId,
    ...(scope.portalId ? { portalId: scope.portalId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(search
      ? {
          OR: [
            { visitorName: { contains: search, mode: 'insensitive' } },
            { visitorEmail: { contains: search, mode: 'insensitive' } },
            { message: { contains: search, mode: 'insensitive' } },
            { listing: { property: { address: { contains: search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
}

async function scopeFromRequest(req) {
  const portalId = typeof req.query.portalId === 'string' ? req.query.portalId : undefined;
  const portalSlug = typeof req.query.portalSlug === 'string'
    ? req.query.portalSlug
    : typeof req.headers['x-portal-slug'] === 'string'
      ? req.headers['x-portal-slug']
      : undefined;
  return ownerScope(req.user.id, portalId, portalSlug);
}

const leadInclude = {
  portal: { select: { id: true, name: true, slug: true } },
  listing: {
    select: {
      id: true,
      slug: true,
      listPrice: true,
      property: { select: { address: true, city: true, state: true } },
    },
  },
} satisfies Prisma.InquiryInclude;

// GET /api/owner/leads - also serves as the server-side authorization probe.
router.get('/', async (req, res, next) => {
  try {
    const scope = await scopeFromRequest(req);
    if (!scope) return res.status(403).json({ error: 'Owner membership required for this portal' });
    const filters = parseFilters(req);
    if (filters.error) return res.status(400).json({ error: filters.error });

    const take = Math.min(Math.max(Number(req.query.limit) || 25, 1), MAX_PAGE_SIZE);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 200) : '';
    const where = leadWhere(scope, filters, search);

    const [rows, grouped] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        include: leadInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      cursor
        ? Promise.resolve([])
        : prisma.inquiry.groupBy({
            by: ['status'],
            where: leadWhere(scope, { source: filters.source }, search),
            _count: { _all: true },
          }),
    ]);
    const hasMore = rows.length > take;
    const leads = hasMore ? rows.slice(0, take) : rows;
    const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<InquiryStatus, number>;
    for (const group of grouped) counts[group.status] = group._count._all;
    res.json({
      leads,
      nextCursor: hasMore ? leads[leads.length - 1].id : null,
      counts: { ...counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) },
    });
  } catch (error) {
    logger.error('Owner leads query failed:', error);
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const scope = await scopeFromRequest(req);
    if (!scope) return res.status(403).json({ error: 'Owner membership required for this portal' });
    const status = req.body?.status as InquiryStatus;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });

    const inquiry = await prisma.inquiry.findFirst({
      where: { id: req.params.id, accountId: scope.accountId, ...(scope.portalId ? { portalId: scope.portalId } : {}) },
      select: { id: true, respondedAt: true },
    });
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
    if (inquiry.respondedAt && status !== 'RESPONDED' && status !== 'ARCHIVED') {
      return res.status(409).json({ error: 'A responded inquiry may only be archived' });
    }

    const updated = await prisma.inquiry.update({
      where: { id: inquiry.id },
      data: {
        status,
        ...(status === 'RESPONDED' && !inquiry.respondedAt ? { respondedAt: new Date() } : {}),
      },
      include: leadInclude,
    });
    res.json(updated);
  } catch (error) {
    logger.error('Owner lead update failed:', error);
    next(error);
  }
});

function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

router.get('/export.csv', async (req, res, next) => {
  try {
    const scope = await scopeFromRequest(req);
    if (!scope) return res.status(403).json({ error: 'Owner membership required for this portal' });
    const filters = parseFilters(req);
    if (filters.error) return res.status(400).json({ error: filters.error });
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 200) : '';
    const leads = await prisma.inquiry.findMany({
      where: leadWhere(scope, filters, search),
      include: leadInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_EXPORT_ROWS,
    });
    const header = ['createdAt', 'status', 'source', 'name', 'email', 'phone', 'portal', 'listing', 'message'];
    const rows = leads.map((lead) => [
      lead.createdAt.toISOString(), lead.status, lead.source, lead.visitorName, lead.visitorEmail,
      lead.visitorPhone, lead.portal.name, lead.listing?.property.address, lead.message,
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send([header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'));
  } catch (error) {
    logger.error('Owner lead export failed:', error);
    next(error);
  }
});

export { csvCell };
export default router;
