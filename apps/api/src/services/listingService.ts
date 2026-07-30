import { prisma } from 'db';
import { deleteDocument, isTypesenseConfigured, reconcilePropertyDocument } from '../search/index.js';
import logger from '../utils/logger.js';

// Refresh the Typesense `properties` doc for a property when its listing
// state changes. The doc carries the property's status + price denormalized
// from its most-recent active Listing; without this re-upsert, Listing
// changes leave the doc stale.
//
// Idempotent: safe to call multiple times. Errors are logged but don't fail
// the caller — Typesense should be best-effort relative to the DB write.
async function refreshPropertyDoc(propertyId: string): Promise<void> {
  if (!isTypesenseConfigured()) return;
  try {
    await reconcilePropertyDocument(propertyId);
  } catch (err) {
    logger.error(`refreshPropertyDoc failed for ${propertyId}:`, err);
  }
}

/**
 * Create a Listing and re-upsert its parent property's Typesense doc.
 *
 * Use this instead of `prisma.listing.create` directly anywhere the
 * resulting Listing should be searchable / filterable via the properties
 * collection. MLS ingestion in apps/mls-service is the primary intended
 * caller — every new MLS listing needs the doc refreshed so the segment
 * filter `status:=Active` finds it.
 */
export async function createListing(data: Parameters<typeof prisma.listing.create>[0]['data']) {
  const listing = await prisma.listing.create({ data });
  await refreshPropertyDoc(listing.propertyId);
  return listing;
}

/**
 * Update a Listing and re-upsert its parent property's Typesense doc.
 *
 * Reads `propertyId` from the updated row to handle the (rare) case where
 * the update changes propertyId — both old and new property docs would
 * need refreshing in that case, but propertyId changes are not a normal
 * flow so we just refresh the post-update parent here.
 */
export async function updateListing(
  where: Parameters<typeof prisma.listing.update>[0]['where'],
  data: Parameters<typeof prisma.listing.update>[0]['data'],
) {
  const previous = await prisma.listing.findUnique({ where, select: { propertyId: true } });
  if (previous && isTypesenseConfigured()) await deleteDocument('properties', previous.propertyId);
  const listing = await prisma.listing.update({ where, data });
  await Promise.all(
    [...new Set([previous?.propertyId, listing.propertyId].filter((id): id is string => Boolean(id)))]
      .map(refreshPropertyDoc),
  );
  return listing;
}

/**
 * Delete a Listing and re-upsert its parent property's Typesense doc.
 *
 * Listings deleted in isolation usually means a previously-Active listing
 * is being removed — the property's most-recent-active-listing pointer
 * now resolves to either an older listing or nothing. Either way the doc
 * needs refreshing.
 */
export async function deleteListing(
  where: Parameters<typeof prisma.listing.delete>[0]['where'],
) {
  const previous = await prisma.listing.findUnique({ where, select: { propertyId: true } });
  if (previous && isTypesenseConfigured()) await deleteDocument('properties', previous.propertyId);
  const listing = await prisma.listing.delete({ where });
  await refreshPropertyDoc(listing.propertyId);
  return listing;
}
