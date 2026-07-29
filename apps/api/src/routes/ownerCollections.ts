import { Router } from 'express';
import { Prisma, prisma } from 'db';
import { classifierExpressionSchema, collectionPredicateSchema, getPortalConfig } from '@realestategear/portal-config';
import { compileCollectionPredicate } from 'search/collectionPredicate';

const router = Router();
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function owner(userId: string) {
  return prisma.accountMember.findFirst({ where: { userId, role: 'OWNER' }, select: { accountId: true } });
}
async function ownerPortal(userId: string, portalId: string) {
  const member = await owner(userId); if (!member) return null;
  return prisma.portal.findFirst({ where: { id: portalId, accountId: member.accountId }, select: { id: true, accountId: true, slug: true } });
}
async function ownerCollection(userId: string, id: string) {
  const member = await owner(userId); if (!member) return null;
  return prisma.listingCollection.findFirst({ where: { id, portal: { accountId: member.accountId } }, include: { portal: { select: { id: true, accountId: true, slug: true, isActive: true, suspendedAt: true } } } });
}
function bad(res, error: unknown) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid request' }); }

router.get('/areas', async (req, res, next) => { try {
  const member = await owner(req.user.id); if (!member) return res.status(403).json({ error: 'Owner membership required' });
  res.json(await prisma.geographicArea.findMany({
    where: { accountId: member.accountId },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { memberships: { where: { decision: 'POSITIVE' } } } } },
  }));
} catch (e) { next(e); } });

router.post('/areas', async (req, res, next) => { try {
  const member = await owner(req.user.id); if (!member) return res.status(403).json({ error: 'Owner membership required' });
  const configured = getPortalConfig().classification.initialAreas.find((area) => area.slug === req.body.configSlug);
  if (!configured) return res.status(400).json({ error: 'Area must be selected from configured initial areas' });
  classifierExpressionSchema.parse(configured.definition);
  const area = await prisma.geographicArea.create({ data: { accountId: member.accountId, slug: configured.slug, name: configured.name, description: configured.description, definition: configured.definition as Prisma.InputJsonValue } });
  res.status(201).json(area);
} catch (e) { if (e?.code === 'P2002') return res.status(409).json({ error: 'Area slug already exists' }); next(e); } });

router.get('/areas/:id', async (req, res, next) => { try {
  const member = await owner(req.user.id); if (!member) return res.status(403).json({ error: 'Owner membership required' });
  const area = await prisma.geographicArea.findFirst({ where: { id: req.params.id, accountId: member.accountId } });
  if (!area) return res.status(404).json({ error: 'Area not found' }); res.json(area);
} catch (e) { next(e); } });

router.patch('/areas/:id', async (req, res, next) => { try {
  const member = await owner(req.user.id); if (!member) return res.status(403).json({ error: 'Owner membership required' });
  const area = await prisma.geographicArea.findFirst({ where: { id: req.params.id, accountId: member.accountId } }); if (!area) return res.status(404).json({ error: 'Area not found' });
  const data = { ...(typeof req.body.name === 'string' ? { name: req.body.name.trim() } : {}), ...(typeof req.body.description === 'string' || req.body.description === null ? { description: req.body.description } : {}), ...(typeof req.body.isPublished === 'boolean' ? { isPublished: req.body.isPublished } : {}), ...(Number.isInteger(req.body.position) ? { position: req.body.position } : {}) };
  res.json(await prisma.geographicArea.update({ where: { id: area.id }, data }));
} catch (e) { next(e); } });
router.delete('/areas/:id', async (req, res, next) => { try { const member = await owner(req.user.id); if (!member) return res.status(403).json({ error: 'Owner membership required' }); const result = await prisma.geographicArea.deleteMany({ where: { id: req.params.id, accountId: member.accountId } }); if (!result.count) return res.status(404).json({ error: 'Area not found' }); res.status(204).send(); } catch (e) { next(e); } });

router.get('/collections', async (req, res, next) => { try {
  const portalId = String(req.query.portalId ?? ''); const portal = await ownerPortal(req.user.id, portalId); if (!portal) return res.status(403).json({ error: 'Owner portal access required' });
  res.json(await prisma.listingCollection.findMany({ where: { portalId }, orderBy: [{ position: 'asc' }, { name: 'asc' }], include: { _count: { select: { overrides: true } } } }));
} catch (e) { next(e); } });

async function validatePredicateForAccount(value: unknown, accountId: string) {
  const predicate = collectionPredicateSchema.parse(value);
  const allowedTags = new Set(getPortalConfig().classification.definitions.map((d) => d.slug));
  if ([...(predicate.tagsAny ?? []), ...(predicate.tagsAll ?? []), ...(predicate.tagsExclude ?? [])].some((tag) => !allowedTags.has(tag))) throw new Error('Predicate references an unconfigured tag');
  if (predicate.areaSlugs?.length) { const count = await prisma.geographicArea.count({ where: { accountId, slug: { in: predicate.areaSlugs } } }); if (count !== new Set(predicate.areaSlugs).size) throw new Error('Predicate references an unknown area'); }
  return predicate;
}

router.post('/collections', async (req, res, next) => { try {
  const portal = await ownerPortal(req.user.id, req.body.portalId); if (!portal) return res.status(403).json({ error: 'Owner portal access required' });
  if (!SLUG.test(req.body.slug ?? '')) return bad(res, new Error('A stable lowercase slug is required'));
  const predicate = await validatePredicateForAccount(req.body.predicate, portal.accountId);
  const row = await prisma.listingCollection.create({ data: { portalId: portal.id, slug: req.body.slug, name: String(req.body.name ?? '').trim(), description: req.body.description ?? null, predicate: predicate as Prisma.InputJsonValue } }); res.status(201).json(row);
} catch (e) { if (e?.code === 'P2002') return res.status(409).json({ error: 'Collection slug already exists' }); if (e?.name === 'ZodError' || e instanceof Error && e.message.startsWith('Predicate')) return bad(res, e); next(e); } });

router.get('/collections/:id', async (req, res, next) => { try { const row = await ownerCollection(req.user.id, req.params.id); if (!row) return res.status(404).json({ error: 'Collection not found' }); res.json(row); } catch (e) { next(e); } });
router.patch('/collections/:id', async (req, res, next) => { try {
  const row = await ownerCollection(req.user.id, req.params.id); if (!row) return res.status(404).json({ error: 'Collection not found' });
  const predicate = req.body.predicate === undefined ? undefined : await validatePredicateForAccount(req.body.predicate, row.portal.accountId);
  const data = { ...(typeof req.body.name === 'string' ? { name: req.body.name.trim() } : {}), ...(typeof req.body.description === 'string' || req.body.description === null ? { description: req.body.description } : {}), ...(predicate ? { predicate: predicate as Prisma.InputJsonValue } : {}), ...(typeof req.body.isPublished === 'boolean' ? { isPublished: req.body.isPublished } : {}), ...(Number.isInteger(req.body.position) ? { position: req.body.position } : {}) };
  res.json(await prisma.listingCollection.update({ where: { id: row.id }, data }));
} catch (e) { if (e?.name === 'ZodError') return bad(res, e); next(e); } });
router.delete('/collections/:id', async (req, res, next) => { try { const row = await ownerCollection(req.user.id, req.params.id); if (!row) return res.status(404).json({ error: 'Collection not found' }); await prisma.listingCollection.delete({ where: { id: row.id } }); res.status(204).send(); } catch (e) { next(e); } });

router.post('/collections/:id/preview', async (req, res, next) => { try {
  const row = await ownerCollection(req.user.id, req.params.id); if (!row) return res.status(404).json({ error: 'Collection not found' });
  if (!row.portal.isActive || row.portal.suspendedAt || !getPortalConfig().compliance.idxApproved) return res.json({ count: 0, examples: [], gated: true });
  const predicate = req.body?.predicate === undefined ? row.predicate : await validatePredicateForAccount(req.body.predicate, row.portal.accountId);
  const boardIds = getPortalConfig().listings.boardIds; const where = compileCollectionPredicate(predicate, { accountId: row.portal.accountId, portalId: row.portal.id, boardIds, collectionId: row.id });
  const [count, examples] = await Promise.all([prisma.property.count({ where }), prisma.property.findMany({ where, take: 8, select: { id: true, address: true, city: true, state: true } })]);
  res.json({ count, examples: examples.map((example) => ({ ...example, whyMatched: 'Matched collection predicate and all authoritative listing gates.' })) });
} catch (e) { if (e?.name === 'ZodError') return bad(res, e); next(e); } });

router.put('/collections/:id/overrides/:propertyId', async (req, res, next) => { try {
  const row = await ownerCollection(req.user.id, req.params.id); if (!row) return res.status(404).json({ error: 'Collection not found' });
  if (!['INCLUDE', 'EXCLUDE'].includes(req.body.decision)) return bad(res, new Error('decision must be INCLUDE or EXCLUDE'));
  const property = await prisma.property.findUnique({ where: { id: req.params.propertyId }, select: { id: true } }); if (!property) return res.status(404).json({ error: 'Property not found' });
  res.json(await prisma.collectionManualOverride.upsert({ where: { collectionId_propertyId: { collectionId: row.id, propertyId: property.id } }, create: { collectionId: row.id, propertyId: property.id, decision: req.body.decision, reason: req.body.reason, createdById: req.user.id }, update: { decision: req.body.decision, reason: req.body.reason, createdById: req.user.id } }));
} catch (e) { next(e); } });
router.delete('/collections/:id/overrides/:propertyId', async (req, res, next) => { try { const row = await ownerCollection(req.user.id, req.params.id); if (!row) return res.status(404).json({ error: 'Collection not found' }); await prisma.collectionManualOverride.deleteMany({ where: { collectionId: row.id, propertyId: req.params.propertyId } }); res.status(204).send(); } catch (e) { next(e); } });

router.get('/classification-coverage', async (req, res, next) => { try { const member = await owner(req.user.id); if (!member) return res.status(403).json({ error: 'Owner membership required' }); const config = getPortalConfig().classification; const grouped = await prisma.propertyClassification.groupBy({ by: ['tagSlug', 'decision'], where: { accountId: member.accountId }, _count: true }); res.json({ providerMappings: Object.keys(config.providerAttributeMappings), availableAreas: config.initialAreas.map(({ slug, name }) => ({ slug, name })), availableTags: config.definitions.map(({ slug, label }) => ({ slug, label })), coverage: grouped }); } catch (e) { next(e); } });
export default router;
