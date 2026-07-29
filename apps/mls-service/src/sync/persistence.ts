import { prisma, Prisma, generatePropertySlug, generateUniquePropertySlug } from 'db';
import { classifyIngestedProperty } from 'db/classification';
import { upsertDocument, deleteDocument, toPropertyDoc } from 'search';
import type { ResoPropertyRecord } from '../connectors/reso/types.js';
import { stripPrefix } from '../connectors/reso/prefix.js';
import {
  assembleAddress,
  toRawData,
  isIdxDisplayable,
  normalizePropertyType,
  normalizeStatus,
  normalizeSubdivision,
} from './mappers.js';
import { str, num, int, dateOf } from './coerce.js';
import { syncPropertyMedia } from './media.js';
import { isStorageConfigured } from '../storage/s3.js';
import logger from '../utils/logger.js';

const PROPERTIES_COLLECTION = 'properties';

export interface MlsPersistenceConfig {
  providerId?: string;
  /** Stored on Listing.mlsBoardId — the compliance/DB board identity. */
  mlsBoardId: string;
  /** Vendor board prefix to strip from display ids (D17). */
  prefix?: string;
  /** Static bearer token — enables photo download (User-Agent auth, D7). Omit to skip media
   *  (always omitted for OAuth2 vendors; see config/mls.ts). */
  accessToken?: string;
  /** Compliance gate (T15/D19): must be true for any listing to be indexed publicly. */
  publicDisplayEnabled?: boolean;
  /** Vendor's "viewable"/delete flag field name, e.g. MLS Grid's "MlgCanView".
   *  Omit if the vendor has no such flag — removal then relies purely on StandardStatus. */
  viewableFlagField?: string;
}

export type ProcessOutcome = 'created' | 'updated' | 'removed' | 'skipped';
export interface ProcessResult {
  outcome: ProcessOutcome;
  listingKey: string | null;
  /** Non-fatal media-sync failure (the DB write still committed). */
  mediaFailed?: boolean;
  /** Non-fatal Typesense upsert/delete failure. */
  indexFailed?: boolean;
}

// ── data builders (pure) ─────────────────────────────────────────────────────
/** Physical-property columns from a RESO Property record. */
function buildPropertyData(record: ResoPropertyRecord) {
  return {
    address: assembleAddress(record),
    city: str(record.City) ?? '',
    state: str(record.StateOrProvince) ?? '',
    zipCode: str(record.PostalCode) ?? '',
    latitude: num(record.Latitude) ?? null,
    longitude: num(record.Longitude) ?? null,
    propertyType: normalizePropertyType(record.PropertySubType ?? record.PropertyType) ?? null,
    bedrooms: int(record.BedroomsTotal) ?? null,
    bathrooms: num(record.BathroomsTotalInteger) ?? null,
    squareFeet: int(record.LivingArea) ?? null,
    lotSize: num(record.LotSizeAcres) ?? null,
    yearBuilt: int(record.YearBuilt) ?? null,
    subdivision: normalizeSubdivision(record.SubdivisionName) ?? null,
  };
}

/** Listing (market-event) columns. `mlsId` is de-prefixed for display (D17). */
function buildListingData(record: ResoPropertyRecord, config: MlsPersistenceConfig) {
  const { status, recognized } = normalizeStatus(record.StandardStatus);
  if (!recognized) {
    logger.warn('[mls] unrecognized StandardStatus — defaulting to non-visible', {
      listingKey: record.ListingKey,
      standardStatus: record.StandardStatus,
    });
  }
  const rawListingId = str(record.ListingId);
  return {
    mlsId: rawListingId ? stripPrefix(rawListingId, config.prefix) : null,
    listPrice: num(record.ListPrice) ?? null,
    status,
    listDate: dateOf(record.ListingContractDate) ?? null,
    description: str(record.PublicRemarks) ?? null,
    listingAgentName: str(record.ListAgentFullName) ?? null,
    listingAgentEmail: str(record.ListAgentEmail) ?? null,
    listingAgentPhone: str(record.ListAgentDirectPhone) ?? null,
    brokerageName: str(record.ListOfficeName) ?? null,
    brokeragePhone: str(record.ListOfficePhone) ?? null,
    // Denormalized from Property for search performance.
    bedrooms: int(record.BedroomsTotal) ?? null,
    bathrooms: num(record.BathroomsTotalInteger) ?? null,
    squareFeet: int(record.LivingArea) ?? null,
    rawData: JSON.stringify(toRawData(record)),
    idxDisplayable: isIdxDisplayable(record),
  };
}

// ── property resolution (D11 + Codex #11 multi-unit guard) ───────────────────
type Tx = Prisma.TransactionClient;

/**
 * Resolve (and keep current) the physical Property for a record, returning its id.
 * Anchors on parcelId for single-unit records (relisting-safe). For multi-unit
 * records (a UnitNumber shares one parcel) it falls back to listing-anchoring so
 * distinct units don't collapse into one Property.
 */
async function resolvePropertyId(
  tx: Tx,
  record: ResoPropertyRecord,
  propertyData: ReturnType<typeof buildPropertyData>,
  existingPropertyId: string | undefined,
): Promise<string> {
  const parcelId = str(record.ParcelNumber);
  const hasUnit = str(record.UnitNumber) !== undefined;

  if (parcelId && !hasUnit) {
    const property = await tx.property.upsert({
      where: { parcelId },
      create: { parcelId, ...propertyData },
      update: propertyData,
    });
    return property.id;
  }

  if (existingPropertyId) {
    await tx.property.update({ where: { id: existingPropertyId }, data: propertyData });
    return existingPropertyId;
  }

  const created = await tx.property.create({ data: propertyData });
  return created.id;
}

/**
 * P2002's `meta.target` field list lives in different places depending on
 * whether Prisma is running through a driver adapter (this project uses
 * @prisma/adapter-pg): classic mode reports `meta.target`, while adapter-pg
 * nests it under `meta.driverAdapterError.cause.constraint.fields`.
 */
export function slugConflictFields(err: Prisma.PrismaClientKnownRequestError): string[] {
  const target = err.meta?.target;
  if (Array.isArray(target)) return target as string[];
  const cause = (err.meta as { driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } } | undefined)
    ?.driverAdapterError?.cause?.constraint?.fields;
  return Array.isArray(cause) ? (cause as string[]) : [];
}

async function uniqueSlug(tx: Tx, address: string, city: string, state: string): Promise<string> {
  const base = generatePropertySlug({ address, city, state });
  const existing = await tx.listing.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  return generateUniquePropertySlug(
    { address, city, state },
    existing.map((e) => e.slug).filter((s): s is string => s !== null),
  );
}

// ── upsert (D12 transaction) ─────────────────────────────────────────────────
async function upsertPropertyAndListing(
  record: ResoPropertyRecord,
  config: MlsPersistenceConfig,
): Promise<ProcessResult> {
  const listingKey = str(record.ListingKey);
  if (!listingKey) {
    logger.warn('[mls] property record missing ListingKey — skipping');
    return { outcome: 'skipped', listingKey: null };
  }

  const propertyData = buildPropertyData(record);
  const listingData = buildListingData(record, config);

  const runTransaction = () =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.listing.findUnique({
        where: { listingKey },
        select: { id: true, propertyId: true },
      });
      const propertyId = await resolvePropertyId(tx, record, propertyData, existing?.propertyId);

      if (existing) {
        const listing = await tx.listing.update({
          where: { listingKey },
          data: { ...listingData, propertyId },
        });
        const property = await tx.property.findUniqueOrThrow({ where: { id: propertyId } });
        return { property, listing, created: false };
      }

      const slug = await uniqueSlug(tx, propertyData.address, propertyData.city, propertyData.state);
      const listing = await tx.listing.create({
        data: {
          propertyId,
          source: 'MLS',
          mlsBoardId: config.mlsBoardId,
          listingKey,
          slug,
          ...listingData,
        },
      });
      const property = await tx.property.findUniqueOrThrow({ where: { id: propertyId } });
      return { property, listing, created: true };
    });

  // Property + Listing writes are atomic; Typesense indexing happens after commit
  // (external system, can't roll back) — decision D12.
  //
  // uniqueSlug() checks in-flight siblings via findMany, which can't see another
  // concurrently-processed record's slug until that record's transaction commits.
  // Two records for the same address processed in the same batch can therefore
  // compute the identical slug and race on the create. Retry a few times so a
  // later attempt sees the earlier record's now-committed slug and disambiguates.
  //
  // Worst case is a "tournament": each retry wave resolves exactly one winner
  // (Postgres serializes concurrent inserts of the same unique value — the
  // losers all fail together, then race again on the next candidate slug), so
  // the last straggler in a fully-contended batch needs up to CONCURRENCY - 1
  // attempts. Matches runSync.ts's per-page chunk size (CONCURRENCY = 8) so a
  // same-address burst filling an entire chunk still resolves inline instead
  // of dead-lettering stragglers that the next dead-letter sweep would recover
  // anyway, just later.
  const MAX_SLUG_ATTEMPTS = 8;
  let result: Awaited<ReturnType<typeof runTransaction>> | undefined;
  for (let attempt = 1; !result; attempt++) {
    try {
      result = await runTransaction();
    } catch (err) {
      const isSlugConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && slugConflictFields(err).includes('slug');
      if (!isSlugConflict || attempt >= MAX_SLUG_ATTEMPTS) throw err;
      logger.warn('[mls] slug conflict on upsert, retrying', { listingKey, attempt });
    }
  }
  const { property, listing, created } = result;

  try {
    await classifyIngestedProperty(property.id, config.providerId ?? 'mls', toRawData(record));
  } catch (err) {
    // The canonical MLS write is durable even if a config or classifier is bad.
    // This is visible and recoverable with the explicit apply command.
    logger.error('[mls] classification failed (DB write committed)', { listingKey, err });
  }

  // Public display gate (D19 + T15 kill-switch): surface a listing publicly (photos +
  // search index) only when public display is enabled AND the listing isn't IDX-opted-
  // out. Otherwise it stays in the DB (agent's own records) but is kept out of the index.
  const publiclyVisible = config.publicDisplayEnabled === true && listing.idxDisplayable;
  let mediaFailed = false;
  let indexFailed = false;
  if (publiclyVisible) {
    // Photos: download + re-host after commit (slow, external). Only when storage and
    // a token are configured; a media failure must not roll back the listing. Mutate
    // listing.imageUrl in-memory so the search doc below reflects the new primary photo.
    if (config.accessToken && isStorageConfigured()) {
      try {
        const media = await syncPropertyMedia(record, property.id, listingKey, {
          mlsBoardId: config.mlsBoardId,
          accessToken: config.accessToken,
        });
        if (media.changed && media.imageUrl && media.imageUrl !== listing.imageUrl) {
          await prisma.listing.update({ where: { listingKey }, data: { imageUrl: media.imageUrl } });
          listing.imageUrl = media.imageUrl;
        }
      } catch (err) {
        mediaFailed = true;
        logger.error('[mls] media sync failed (DB write committed)', { listingKey, err });
      }
    }

    // Index after commit; a search failure must not roll back good DB data.
    try {
      await upsertDocument(PROPERTIES_COLLECTION, toPropertyDoc(property, listing));
    } catch (err) {
      indexFailed = true;
      logger.error('[mls] Typesense upsert failed (DB write committed)', { listingKey, err });
    }
  } else {
    // Not publicly visible — ensure it's absent from the public search index.
    try {
      await deleteDocument(PROPERTIES_COLLECTION, property.id);
    } catch (err) {
      indexFailed = true;
      logger.error('[mls] Typesense delete (non-displayable) failed', { listingKey, err });
    }
    logger.info('[mls] listing not publicly indexed', {
      listingKey,
      reason: config.publicDisplayEnabled !== true ? 'public-display-disabled' : 'idx-opt-out',
    });
  }

  return { outcome: created ? 'created' : 'updated', listingKey, mediaFailed, indexFailed };
}

// ── removal (D5: MlgCanView=false) ───────────────────────────────────────────
async function removeListing(record: ResoPropertyRecord): Promise<ProcessResult> {
  const listingKey = str(record.ListingKey);
  if (!listingKey) return { outcome: 'skipped', listingKey: null };

  const listing = await prisma.listing.findUnique({
    where: { listingKey },
    select: { propertyId: true },
  });
  if (!listing) {
    // Never had it (or already gone) — nothing to remove.
    return { outcome: 'skipped', listingKey };
  }

  await prisma.listing.update({ where: { listingKey }, data: { status: 'WITHDRAWN' } });

  // Drop the property's search doc only if no OTHER active listing keeps it live.
  const otherActive = await prisma.listing.count({
    where: { propertyId: listing.propertyId, status: 'ACTIVE', listingKey: { not: listingKey } },
  });
  if (otherActive === 0) {
    try {
      await deleteDocument(PROPERTIES_COLLECTION, listing.propertyId);
    } catch (err) {
      logger.error('[mls] Typesense delete failed', { listingKey, err });
    }
  }

  return { outcome: 'removed', listingKey };
}

/**
 * Process one RESO Property record: branch on the vendor's viewable/delete
 * flag (D5), when one is configured (`config.viewableFlagField` — e.g. MLS
 * Grid's "MlgCanView"). `false` means the listing was deleted/withdrawn/
 * withheld — remove it; otherwise upsert. Vendors with no such flag rely
 * purely on StandardStatus (handled inside buildListingData/normalizeStatus).
 */
export async function processPropertyRecord(
  record: ResoPropertyRecord,
  config: MlsPersistenceConfig,
): Promise<ProcessResult> {
  // Guard against RESO providers that serialize booleans as strings or numbers (D5/D19).
  const canView = config.viewableFlagField ? (record[config.viewableFlagField] as unknown) : undefined;
  if (canView === false || canView === 'false' || canView === 0) {
    return removeListing(record);
  }
  return upsertPropertyAndListing(record, config);
}
