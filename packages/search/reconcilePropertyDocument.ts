import { prisma } from 'db';
import { buildPublicListingWhere, type PropertyVisibilityEnvironment } from './propertyVisibility.js';
import { deleteDocument, upsertDocument } from './syncService.js';
import { toPropertyDoc } from './transformers.js';

export type PropertyDocumentReconcileResult = 'upserted' | 'deleted';

/** Make one property document exactly match its newest publicly eligible listing. */
export async function reconcilePropertyDocument(
  propertyId: string,
  env: PropertyVisibilityEnvironment = process.env,
): Promise<PropertyDocumentReconcileResult> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      listings: {
        where: buildPublicListingWhere(undefined, env),
        orderBy: [{ listDate: 'desc' }, { createdAt: 'desc' }],
        take: 1,
      },
    },
  });

  const listing = property?.listings[0];
  if (!property || !listing) {
    await deleteDocument('properties', propertyId);
    return 'deleted';
  }

  await upsertDocument('properties', toPropertyDoc(property, listing));
  return 'upserted';
}
