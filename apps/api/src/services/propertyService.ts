import { ListingStatus, Prisma, PropertyType, prisma } from 'db';
import { deleteDocument, isTypesenseConfigured, reconcilePropertyDocument } from '../search/index.js';
import { resolveMlsBoardName } from '../utils/mlsBoardName.js';
import { buildPublicListingWhere, isMlsPublicDisplayEnabled } from 'search/propertyVisibility';
import logger from '../utils/logger.js';

async function reconcilePropertyDocumentBestEffort(propertyId: string): Promise<void> {
  if (!isTypesenseConfigured()) return;
  try {
    await reconcilePropertyDocument(propertyId);
  } catch (error) {
    logger.error('Property Typesense reconciliation failed after DB write', { propertyId, error });
  }
}

function listingWhere(additional: Prisma.ListingWhereInput | undefined, publicOnly: boolean) {
  if (publicOnly) return buildPublicListingWhere(additional);
  const baseline: Prisma.ListingWhereInput = { status: ListingStatus.ACTIVE, idxDisplayable: true };
  return additional ? { AND: [baseline, additional] } : baseline;
}

function listingInclude(additional: Prisma.ListingWhereInput | undefined, publicOnly: boolean) {
  return {
    where: listingWhere(additional, publicOnly),
    orderBy: [{ listDate: 'desc' as const }, { createdAt: 'desc' as const }],
    take: 1,
  };
}

function normalizeListingStatus(status?: string | null) {
  if (!status) return undefined;
  return status
    .split('_')
    .map((s) => s.charAt(0) + s.slice(1).toLowerCase())
    .join(' ');
}

function decimalToNumber(value: unknown) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseListingStatus(value: unknown): ListingStatus | undefined {
  if (typeof value !== 'string') return undefined;
  const candidate = value.toUpperCase().replace(/\s+/g, '_');
  return (Object.values(ListingStatus) as string[]).includes(candidate)
    ? candidate as ListingStatus
    : undefined;
}

function toPropertyResult(property, publicOnly: boolean) {
  const { listings = [], media = [], ...base } = property;
  const listing = listings[0] ?? null;
  const exposePropertyMedia = !publicOnly || isMlsPublicDisplayEnabled();
  const firstMediaUrl = exposePropertyMedia ? media[0]?.url ?? null : null;

  return {
    ...base,
    media: exposePropertyMedia ? media : [],
    listingId: listing?.id ?? null,
    slug: listing?.slug ?? null,
    mlsId: listing?.mlsId ?? null,
    mlsBoardId: listing?.mlsBoardId ?? null,
    mlsBoardName: resolveMlsBoardName(listing?.mlsBoardId),
    lastMlsUpdate: listing?.updatedAt ?? null,
    status: normalizeListingStatus(listing?.status) ?? null,
    price: decimalToNumber(listing?.listPrice),
    listPrice: decimalToNumber(listing?.listPrice),
    listingDate: listing?.listDate ?? null,
    imageUrl: listing?.imageUrl ?? firstMediaUrl,
    description: listing?.description ?? null,
    listingAgentName: listing?.listingAgentName ?? null,
    brokerageName: listing?.brokerageName ?? null,
    brokeragePhone: listing?.brokeragePhone ?? null,
  };
}

function mapSortOption(sortBy = 'created_desc') {
  switch (sortBy) {
    case 'price_asc':
      return { sortBy: 'price', sortOrder: 'asc' };
    case 'price_desc':
      return { sortBy: 'price', sortOrder: 'desc' };
    case 'bedrooms_desc':
      return { sortBy: 'bedrooms', sortOrder: 'desc' };
    case 'sqft_desc':
      return { sortBy: 'squareFeet', sortOrder: 'desc' };
    case 'created_desc':
    default:
      return { sortBy: 'createdAt', sortOrder: 'desc' };
  }
}

const VALID_PROPERTY_TYPES = new Set<string>(Object.values(PropertyType));

// Filter values can arrive as display labels ("Single Family") from the portal's
// property type checkboxes, but Prisma's PropertyType column is an enum
// ("SINGLE_FAMILY"). Convert and drop anything that isn't a real enum value
// instead of letting Prisma throw on an invalid filter.
function normalizePropertyTypes(propertyType) {
  if (!propertyType) return [];

  const values = Array.isArray(propertyType)
    ? propertyType
    : `${propertyType}`.split(',');

  return values
    .map((value) => `${value}`.trim().toUpperCase().replace(/\s+/g, '_'))
    .filter((value) => VALID_PROPERTY_TYPES.has(value));
}

function buildPropertyTypeClause(propertyTypes) {
  if (propertyTypes.length === 0) return null;
  if (propertyTypes.length === 1) {
    return { propertyType: propertyTypes[0] };
  }
  return { propertyType: { in: propertyTypes } };
}

export async function getProperties(
  filters: Record<string, any> = {},
  options: { publicOnly?: boolean } = {},
) {
  const publicOnly = options.publicOnly !== false;
  const {
      page = 1,
      limit = 20,
      search,
      city,
      state,
      minPrice,
      maxPrice,
      minSqFt,
      maxSqFt,
      minYearBuilt,
      maxYearBuilt,
      bedrooms,
      minBedrooms,
      maxBedrooms,
      bathrooms,
      minBathrooms,
      maxBathrooms,
      propertyType,
      status,
      sortBy = 'created_desc'
    } = filters;
    const propertyTypes = normalizePropertyTypes(propertyType);

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    // Build where clause
    const requestedStatus = parseListingStatus(status);
    const requestedListingWhere: Prisma.ListingWhereInput = {
      ...(status ? (requestedStatus ? { status: requestedStatus } : { status: { in: [] } }) : {}),
      ...(minPrice || maxPrice
        ? {
            listPrice: {
              ...(minPrice ? { gte: parseFloat(minPrice) } : {}),
              ...(maxPrice ? { lte: parseFloat(maxPrice) } : {}),
            },
          }
        : {}),
    };
    const requestedListingFilter = Object.keys(requestedListingWhere).length
      ? requestedListingWhere
      : undefined;
    const matchedListingWhere = listingWhere(requestedListingFilter, publicOnly);
    const where: Prisma.PropertyWhereInput = {
      listings: { some: matchedListingWhere },
    };

    // Full-text search via Prisma (dedicated /api/search uses Typesense)
    if (search) {
      where.OR = [
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (state) where.state = { contains: state, mode: 'insensitive' };
    const propertyTypeClause = buildPropertyTypeClause(propertyTypes);
    if (propertyTypeClause) {
      Object.assign(where, propertyTypeClause);
    }

    const minimumBedrooms = minBedrooms || bedrooms;
    if (minimumBedrooms || maxBedrooms) {
      where.bedrooms = {};
      if (minimumBedrooms) where.bedrooms.gte = parseInt(minimumBedrooms);
      if (maxBedrooms) where.bedrooms.lte = parseInt(maxBedrooms);
    }

    const minimumBathrooms = minBathrooms || bathrooms;
    if (minimumBathrooms || maxBathrooms) {
      where.bathrooms = {};
      if (minimumBathrooms) where.bathrooms.gte = parseFloat(minimumBathrooms);
      if (maxBathrooms) where.bathrooms.lte = parseFloat(maxBathrooms);
    }

    if (minSqFt || maxSqFt) {
      where.squareFeet = {};
      if (minSqFt) where.squareFeet.gte = parseInt(minSqFt);
      if (maxSqFt) where.squareFeet.lte = parseInt(maxSqFt);
    }

    if (minYearBuilt || maxYearBuilt) {
      where.yearBuilt = {};
      if (minYearBuilt) where.yearBuilt.gte = parseInt(minYearBuilt);
      if (maxYearBuilt) where.yearBuilt.lte = parseInt(maxYearBuilt);
    }

    // Build orderBy clause - map frontend sort values to database fields
    let orderBy: Prisma.PropertyOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'bedrooms_desc':
        orderBy = { bedrooms: 'desc' };
        break;
      case 'sqft_desc':
        orderBy = { squareFeet: 'desc' };
        break;
      case 'created_desc':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          media: {
            orderBy: { order: 'asc' }
          },
          listings: listingInclude(requestedListingFilter, publicOnly),
        }
      }),
      prisma.property.count({ where })
    ]);

    return {
      properties: properties.map((property) => toPropertyResult(property, publicOnly)),
      pagination: {
        page: parseInt(page),
        currentPage: parseInt(page), // Add currentPage for frontend compatibility
        limit: take,
        total,
        pages: Math.ceil(total / take),
        totalPages: Math.ceil(total / take), // Add totalPages for frontend compatibility
        hasNext: skip + take < total,
        hasPrev: page > 1
      }
    };
}

export async function getPropertyById(id) {
    const property = await prisma.property.findFirst({
      where: { id, listings: { some: buildPublicListingWhere() } },
      include: {
        media: {
          orderBy: { order: 'asc' }
        },
        listings: listingInclude(undefined, true),
      }
    });
    return property ? toPropertyResult(property, true) : null;
  }

export async function getPropertyBySlug(slug) {
    const listing = await prisma.listing.findFirst({
      where: buildPublicListingWhere({ slug }),
      include: {
        property: {
          include: {
            media: { orderBy: { order: 'asc' } },
          },
        },
      }
    });
    if (!listing?.property) return null;
    return toPropertyResult({ ...listing.property, listings: [listing] }, true);
  }

/**
 * Get property by either ID (cuid) or slug
 * Automatically detects the identifier type
 */
export async function getPropertyByIdentifier(identifier) {
  // CUIDs start with 'c' and are 25 characters; Property has no slug field
  const isCuid = /^c[a-z0-9]{24}$/.test(identifier);
  if (isCuid) {
    return await getPropertyById(identifier);
  }
  return await getPropertyBySlug(identifier);
}

export async function createProperty(data) {
    // New properties have no listings yet, so we don't include them here —
    // status/price land in Typesense when the first Listing is created via
    // services/listingService.ts (which calls refreshPropertyDoc).
    const property = await prisma.property.create({
      data,
      include: {
        media: {
          orderBy: { order: 'asc' }
        },
      }
    });

    await reconcilePropertyDocumentBestEffort(property.id);

    return property;
  }

export async function updateProperty(id, data) {
    try {
      const property = await prisma.property.update({
        where: { id },
        data,
        include: {
          media: {
            orderBy: { order: 'asc' }
          },
          listings: {
            where: { status: 'ACTIVE' },
            orderBy: { listDate: 'desc' },
            take: 1,
          },
        }
      });

      await reconcilePropertyDocumentBestEffort(property.id);

      return property;
    } catch (error) {
      if (error.code === 'P2025') {
        return null; // Property not found
      }
      throw error;
    }
  }

export async function deleteProperty(id) {
    try {
      if (isTypesenseConfigured()) await deleteDocument('properties', id);
      await prisma.property.delete({
        where: { id }
      });

      await reconcilePropertyDocumentBestEffort(id);

      return true;
    } catch (error) {
      if (error.code === 'P2025') {
        return false; // Property not found
      }
      throw error;
    }
  }

export async function getPropertyMedia(propertyId) {
    if (!isMlsPublicDisplayEnabled()) return [];
    const property = await prisma.property.findFirst({
      where: { id: propertyId, listings: { some: buildPublicListingWhere() } },
      select: { media: { orderBy: { order: 'asc' } } },
    });
    return property?.media ?? [];
  }

export async function addPropertyMedia(propertyId, mediaData) {
    return await prisma.media.create({
      data: {
        ...mediaData,
        propertyId
      }
    });
  }

export async function searchProperties(searchTerm) {
    return await prisma.property.findMany({
      where: {
        OR: [
          { address: { contains: searchTerm, mode: 'insensitive' } },
          { city: { contains: searchTerm, mode: 'insensitive' } },
          { state: { contains: searchTerm, mode: 'insensitive' } },
        ]
      },
      include: {
        media: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
