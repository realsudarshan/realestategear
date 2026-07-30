import { ListingStatus, Prisma, PropertyType, prisma } from 'db';
import { toContactDoc, toPropertyDoc, toTaskDoc, toTransactionDoc } from './transformers.js';
import { buildPublicListingWhere } from './propertyVisibility.js';

// Postgres-native equivalents of the Typesense-backed searches used by
// apps/api/src/routes/agentSearch.ts (cmd-k palette) and
// apps/api/src/routes/search.ts (public property search). Self-hosters who
// don't run Typesense (TYPESENSE_HOST unset) get real results from these
// instead of a broken palette / search page. Each result is mapped through
// the same toXDoc() transformers Typesense uses, so the frontend renders
// identically regardless of which engine answered the query.

export function isTypesenseConfigured(): boolean {
  return Boolean(process.env.TYPESENSE_HOST);
}

export interface PgSearchResult<T> {
  items: T[];
  total: number;
}

function isValidPropertyType(value: string): value is PropertyType {
  return (Object.values(PropertyType) as string[]).includes(value);
}

// Inverse of transformers.ts's normalizeListingStatus ("ACTIVE" -> "Active").
// Typesense filters and this fallback both take the human-readable form from
// the caller, so this maps it back to the enum value Prisma expects.
function parseListingStatus(status?: string): ListingStatus | undefined {
  if (!status) return undefined;
  const candidate = status.toUpperCase().replace(/\s+/g, '_');
  return (Object.values(ListingStatus) as string[]).includes(candidate)
    ? (candidate as ListingStatus)
    : undefined;
}

export async function searchContactsPg(params: {
  accountId: string;
  q?: string;
  limit?: number;
}): Promise<PgSearchResult<ReturnType<typeof toContactDoc>>> {
  const { accountId, q, limit = 8 } = params;
  const search = q?.trim();

  const where: Prisma.ContactWhereInput = {
    accountId,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.contact.findMany({ where, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.contact.count({ where }),
  ]);

  return { items: rows.map(toContactDoc), total };
}

export async function searchTransactionsPg(params: {
  accountId: string;
  q?: string;
  limit?: number;
}): Promise<PgSearchResult<ReturnType<typeof toTransactionDoc>>> {
  const { accountId, q, limit = 8 } = params;
  const search = q?.trim();

  const where: Prisma.TransactionWhereInput = {
    accountId,
    ...(search
      ? {
          OR: [
            { address: { contains: search, mode: 'insensitive' } },
            { mlsId: { contains: search, mode: 'insensitive' } },
            {
              parties: {
                some: {
                  contact: {
                    OR: [
                      { firstName: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { parties: { include: { contact: { select: { firstName: true, lastName: true } } } } },
    }),
    prisma.transaction.count({ where }),
  ]);

  return { items: rows.map(toTransactionDoc), total };
}

export async function searchTasksPg(params: {
  assignedToId: string;
  q?: string;
  limit?: number;
}): Promise<PgSearchResult<ReturnType<typeof toTaskDoc>>> {
  const { assignedToId, q, limit = 8 } = params;
  const search = q?.trim();

  const where: Prisma.TaskWhereInput = {
    assignedToId,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.task.findMany({ where, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.task.count({ where }),
  ]);

  return { items: rows.map(toTaskDoc), total };
}

export interface PgPropertySearchParams {
  q?: string;
  city?: string;
  state?: string;
  status?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  minSquareFeet?: number;
  maxSquareFeet?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  cities?: string[];
  zipCodes?: string[];
  subdivisions?: string[];
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
  publicOnly?: boolean;
}

// Which listing represents a property in results, independent of any match
// filter above: the most recently listed ACTIVE one. Mirrors the convention
// already baked into apps/api/src/routes/search.ts's reindexAll('properties')
// handler, which indexes every property via this same fixed selection.
function listingWhere(
  additional: Prisma.ListingWhereInput | undefined,
  publicOnly: boolean,
): Prisma.ListingWhereInput {
  if (publicOnly) return buildPublicListingWhere(additional);
  const baseline: Prisma.ListingWhereInput = { status: ListingStatus.ACTIVE, idxDisplayable: true };
  return additional ? { AND: [baseline, additional] } : baseline;
}

function representativeListing(publicOnly: boolean) {
  return {
    where: listingWhere(undefined, publicOnly),
    orderBy: { listDate: 'desc' as const },
    take: 1,
  };
}

function buildPropertyOrderBy(
  sortBy?: string,
  sortOrder?: string,
): Prisma.PropertyOrderByWithRelationInput {
  const order = sortOrder === 'asc' ? 'asc' : 'desc';
  switch (sortBy) {
    case 'yearBuilt':
      return { yearBuilt: order };
    case 'squareFeet':
      return { squareFeet: order };
    case 'updatedAt':
      return { updatedAt: order };
    // 'price' and 'listingDate' live on the related Listing, not Property.
    // Prisma can't order a to-many parent by a related row's scalar field
    // without raw SQL -- not worth that for a fallback path. Falls back to
    // createdAt rather than erroring.
    default:
      return { createdAt: order };
  }
}

export async function searchPropertiesPg(
  params: PgPropertySearchParams,
): Promise<PgSearchResult<ReturnType<typeof toPropertyDoc>>> {
  const {
    q,
    city,
    state,
    status,
    propertyType,
    minPrice,
    maxPrice,
    bedrooms,
    bathrooms,
    minSquareFeet,
    maxSquareFeet,
    minYearBuilt,
    maxYearBuilt,
    cities,
    zipCodes,
    subdivisions,
    sortBy,
    sortOrder,
    page = 1,
    limit = 20,
    publicOnly = true,
  } = params;
  const search = q?.trim();

  // Segment-style geographic OR-group (cities[]/zipCodes[]/subdivisions[]).
  // Same `{ in, mode: 'insensitive' }` bug as buildPortalPropertyWhere: fan
  // out to an OR of case-insensitive equals instead of using `in` + mode.
  const geoOr: Prisma.PropertyWhereInput[] = [];
  if (cities?.length) {
    geoOr.push({ OR: cities.map((value) => ({ city: { equals: value, mode: 'insensitive' } })) });
  }
  if (zipCodes?.length) geoOr.push({ zipCode: { in: zipCodes } });
  if (subdivisions?.length) {
    geoOr.push({
      OR: subdivisions.map((value) => ({ subdivision: { equals: value, mode: 'insensitive' } })),
    });
  }

  const statusFilter = parseListingStatus(status);
  const requestedListingWhere: Prisma.ListingWhereInput = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(minPrice != null || maxPrice != null
      ? {
          listPrice: {
            ...(minPrice != null ? { gte: minPrice } : {}),
            ...(maxPrice != null ? { lte: maxPrice } : {}),
          },
        }
      : {}),
  };
  const matchedListingWhere = listingWhere(
    Object.keys(requestedListingWhere).length ? requestedListingWhere : undefined,
    publicOnly,
  );

  const where: Prisma.PropertyWhereInput = {
    ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
    ...(state ? { state: { equals: state, mode: 'insensitive' } } : {}),
    ...(propertyType && isValidPropertyType(propertyType) ? { propertyType } : {}),
    ...(bedrooms != null ? { bedrooms: { gte: Math.trunc(bedrooms) } } : {}),
    ...(bathrooms != null ? { bathrooms: { gte: bathrooms } } : {}),
    ...(minSquareFeet != null || maxSquareFeet != null
      ? {
          squareFeet: {
            ...(minSquareFeet != null ? { gte: minSquareFeet } : {}),
            ...(maxSquareFeet != null ? { lte: maxSquareFeet } : {}),
          },
        }
      : {}),
    ...(minYearBuilt != null || maxYearBuilt != null
      ? {
          yearBuilt: {
            ...(minYearBuilt != null ? { gte: minYearBuilt } : {}),
            ...(maxYearBuilt != null ? { lte: maxYearBuilt } : {}),
          },
        }
      : {}),
    listings: { some: matchedListingWhere },
    ...(geoOr.length > 0 ? { OR: geoOr } : {}),
    ...(search
      ? {
          AND: [
            {
              OR: [
                { address: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
                { state: { contains: search, mode: 'insensitive' } },
                { zipCode: { contains: search } },
                { subdivision: { contains: search, mode: 'insensitive' } },
              ],
            },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.property.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: buildPropertyOrderBy(sortBy, sortOrder),
      include: { listings: representativeListing(publicOnly) },
    }),
    prisma.property.count({ where }),
  ]);

  return { items: rows.map((p) => toPropertyDoc(p, p.listings[0])), total };
}
