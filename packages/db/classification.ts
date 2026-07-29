import { classificationConfigHash, evaluateClassifier, getPortalConfig, type PortalClassificationConfig } from '@realestategear/portal-config';
import { prisma, type Prisma } from './index.js';

type Source = 'INGESTION' | 'RECLASSIFICATION';
type PropertyInput = { id: string; city: string; zipCode: string; subdivision: string | null; latitude: number | null; longitude: number | null; normalizedAttributes: Prisma.JsonValue };

export function normalizeProviderAttributes(providerId: string, raw: Record<string, unknown>, config = getPortalConfig().classification) {
  const mappings = config.providerAttributeMappings[providerId] ?? {};
  return Object.fromEntries(Object.entries(mappings).map(([canonical, fields]) => [canonical, fields.map((field) => raw[field]).find((value) => value != null)]).filter(([, value]) => value != null));
}

async function classifyForAccount(property: PropertyInput, accountId: string, config: PortalClassificationConfig, source: Source) {
  const hash = classificationConfigHash(config);
  const input = { city: property.city, zipCode: property.zipCode, subdivision: property.subdivision, latitude: property.latitude, longitude: property.longitude, attributes: (property.normalizedAttributes ?? {}) as Record<string, unknown> };
  for (const initial of config.initialAreas) {
    await prisma.geographicArea.upsert({ where: { accountId_slug: { accountId, slug: initial.slug } }, create: { accountId, slug: initial.slug, name: initial.name, description: initial.description, definition: initial.definition as Prisma.InputJsonValue }, update: { name: initial.name, description: initial.description, definition: initial.definition as Prisma.InputJsonValue } });
  }
  const areas = await prisma.geographicArea.findMany({ where: { accountId } });
  for (const area of areas) {
    const result = evaluateClassifier(area.definition as never, input);
    const existing = await prisma.propertyAreaMembership.findUnique({ where: { areaId_propertyId: { areaId: area.id, propertyId: property.id } }, select: { manualOverride: true } });
    if (existing?.manualOverride) continue;
    await prisma.propertyAreaMembership.upsert({ where: { areaId_propertyId: { areaId: area.id, propertyId: property.id } }, create: { areaId: area.id, propertyId: property.id, decision: result.matched ? 'POSITIVE' : 'NEGATIVE', source, confidence: 1, evidence: result.evidence as Prisma.InputJsonValue, classifierVersion: config.version, configHash: hash }, update: { decision: result.matched ? 'POSITIVE' : 'NEGATIVE', source, confidence: 1, evidence: result.evidence as Prisma.InputJsonValue, classifierVersion: config.version, configHash: hash } });
  }
  for (const definition of config.definitions) {
    const result = evaluateClassifier(definition.classifier, input);
    const key = { accountId_propertyId_tagSlug: { accountId, propertyId: property.id, tagSlug: definition.slug } };
    const existing = await prisma.propertyClassification.findUnique({ where: key, select: { manualOverride: true } });
    if (existing?.manualOverride) continue;
    await prisma.propertyClassification.upsert({ where: key, create: { accountId, propertyId: property.id, tagSlug: definition.slug, decision: result.matched ? 'POSITIVE' : 'NEGATIVE', source, confidence: definition.confidence ?? 1, evidence: result.evidence as Prisma.InputJsonValue, classifierVersion: config.version, configHash: hash }, update: { decision: result.matched ? 'POSITIVE' : 'NEGATIVE', source, confidence: definition.confidence ?? 1, evidence: result.evidence as Prisma.InputJsonValue, classifierVersion: config.version, configHash: hash } });
  }
}

export async function classifyIngestedProperty(propertyId: string, providerId: string, raw: Record<string, unknown>) {
  const portalConfig = getPortalConfig(); const config = portalConfig.classification;
  const normalized = normalizeProviderAttributes(providerId, raw, config);
  const property = await prisma.property.update({ where: { id: propertyId }, data: { normalizedAttributes: normalized as Prisma.InputJsonValue } });
  const portals = await prisma.portal.findMany({ where: { slug: portalConfig.slug }, select: { id: true, accountId: true } });
  for (const portal of portals) {
    if (config.initialCollections.length) await prisma.listingCollection.createMany({ data: config.initialCollections.map((item, position) => ({ portalId: portal.id, slug: item.slug, name: item.name, description: item.description, predicate: item.predicate as Prisma.InputJsonValue, position })), skipDuplicates: true });
    await classifyForAccount(property, portal.accountId, config, 'INGESTION');
  }
}

export async function runClassification(options: { accountId: string; mode: 'CHECK' | 'DIFF' | 'APPLY'; batchSize?: number; cursor?: string }) {
  const config = getPortalConfig().classification; const hash = classificationConfigHash(config);
  const run = await prisma.classificationRun.create({ data: { accountId: options.accountId, mode: options.mode, configHash: hash, classifierVersion: config.version, cursor: options.cursor } });
  let cursor = options.cursor; let processed = 0; let changed = 0; const diff: Array<{ propertyId: string; stale: boolean }> = [];
  try {
    while (true) {
      const rows = await prisma.property.findMany({ orderBy: { id: 'asc' }, take: options.batchSize ?? 250, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      if (!rows.length) break;
      for (const property of rows) {
        const existing = await prisma.propertyClassification.findMany({ where: { accountId: options.accountId, propertyId: property.id }, select: { tagSlug: true, configHash: true, classifierVersion: true, manualOverride: true } });
        const stale = config.definitions.some((definition) => { const row = existing.find((item) => item.tagSlug === definition.slug); return !row || (!row.manualOverride && (row.configHash !== hash || row.classifierVersion !== config.version)); });
        if (stale) changed++; if (options.mode === 'DIFF' && stale) diff.push({ propertyId: property.id, stale });
        if (options.mode === 'APPLY') await classifyForAccount(property, options.accountId, config, 'RECLASSIFICATION');
        processed++; cursor = property.id;
      }
      await prisma.classificationRun.update({ where: { id: run.id }, data: { cursor, processed, changed } });
    }
    return prisma.classificationRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', completedAt: new Date(), cursor, processed, changed, diff: options.mode === 'DIFF' ? diff as Prisma.InputJsonValue : undefined } });
  } catch (error) {
    await prisma.classificationRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: error instanceof Error ? error.message : String(error), cursor, processed, changed, completedAt: new Date() } }); throw error;
  }
}
