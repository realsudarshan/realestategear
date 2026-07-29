import { Router } from 'express';
import { Prisma, prisma } from 'db';
import { collectionPredicateSchema } from '@realestategear/portal-config';
import { compileCollectionPredicate } from 'search/collectionPredicate';
import { getPortalConfig } from '@realestategear/portal-config';

// Temporary Agent HQ compatibility alias. IDs and records are listing
// collections; no Segment or legacy filter builder remains behind this route.
const router = Router();
async function context(userId: string) {
  const member = await prisma.accountMember.findFirst({ where: { userId }, select: { accountId: true } });
  if (!member) return null;
  const portal = await prisma.portal.findFirst({ where: { accountId: member.accountId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  return portal ? { accountId: member.accountId, portalId: portal.id } : null;
}
function dto(row: any) { return { ...row, cities: [], zipCodes: [], subdivisions: [], _count: { portals: 1 } }; }

router.get('/', async (req, res, next) => { try { const ctx = await context(req.user.id); if (!ctx) return res.status(403).json({ error: 'No portal account found' }); const rows = await prisma.listingCollection.findMany({ where: { portalId: ctx.portalId }, orderBy: { createdAt: 'desc' } }); res.json(rows.map(dto)); } catch (e) { next(e); } });
router.post('/', async (req, res, next) => { try { const ctx = await context(req.user.id); if (!ctx) return res.status(403).json({ error: 'No portal account found' }); const slug = String(req.body.slug ?? req.body.name ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); const predicate = collectionPredicateSchema.parse(req.body.predicate ?? {}); const row = await prisma.listingCollection.create({ data: { portalId: ctx.portalId, name: req.body.name, slug, predicate: predicate as Prisma.InputJsonValue } }); res.status(201).json(dto(row)); } catch (e) { next(e); } });
router.get('/listing-count', (_req, res) => res.json({ count: 0, minPrice: null, maxPrice: null }));
router.get('/suggestions', (_req, res) => res.json({ values: [] }));
router.get('/:id', async (req, res, next) => { try { const ctx = await context(req.user.id); if (!ctx) return res.status(403).json({ error: 'No portal account found' }); const row = await prisma.listingCollection.findFirst({ where: { id: req.params.id, portalId: ctx.portalId } }); if (!row) return res.status(404).json({ error: 'Not found' }); res.json(dto(row)); } catch (e) { next(e); } });
router.put('/:id', async (req, res, next) => { try { const ctx = await context(req.user.id); if (!ctx) return res.status(403).json({ error: 'No portal account found' }); const existing = await prisma.listingCollection.findFirst({ where: { id: req.params.id, portalId: ctx.portalId } }); if (!existing) return res.status(404).json({ error: 'Not found' }); const predicate = req.body.predicate === undefined ? undefined : collectionPredicateSchema.parse(req.body.predicate); const row = await prisma.listingCollection.update({ where: { id: existing.id }, data: { ...(req.body.name !== undefined ? { name: req.body.name } : {}), ...(predicate ? { predicate: predicate as Prisma.InputJsonValue } : {}) } }); res.json(dto(row)); } catch (e) { next(e); } });
router.delete('/:id', async (req, res, next) => { try { const ctx = await context(req.user.id); if (!ctx) return res.status(403).json({ error: 'No portal account found' }); const result = await prisma.listingCollection.deleteMany({ where: { id: req.params.id, portalId: ctx.portalId } }); if (!result.count) return res.status(404).json({ error: 'Not found' }); res.status(204).send(); } catch (e) { next(e); } });
router.get('/:id/listing-count', async (req, res, next) => { try { const ctx = await context(req.user.id); if (!ctx) return res.status(403).json({ error: 'No portal account found' }); const row = await prisma.listingCollection.findFirst({ where: { id: req.params.id, portalId: ctx.portalId } }); if (!row) return res.status(404).json({ error: 'Not found' }); const where = compileCollectionPredicate(row.predicate, { ...ctx, boardIds: getPortalConfig().listings.boardIds, collectionId: row.id }); res.json({ count: await prisma.property.count({ where }), minPrice: null, maxPrice: null }); } catch (e) { next(e); } });
export default router;
