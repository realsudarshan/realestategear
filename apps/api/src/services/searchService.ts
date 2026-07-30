import { ListingStatus, prisma } from 'db';
import logger from '../utils/logger.js';
import { buildPublicListingWhere, isMlsPublicDisplayEnabled } from 'search/propertyVisibility';

interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface SearchFilters {
  city?: string;
  state?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
  propertyType?: string;
  status?: string;
}

function parseListingStatus(value?: string): ListingStatus | undefined {
  if (!value) return undefined;
  const candidate = value.toUpperCase().replace(/\s+/g, '_');
  return (Object.values(ListingStatus) as string[]).includes(candidate)
    ? candidate as ListingStatus
    : undefined;
}

/**
 * Geographic bounds search — returns properties whose coordinates fall within
 * the given lat/lng bounding box.
 */
export async function searchByBounds(
  bounds: Bounds,
  options: { limit?: number; filters?: SearchFilters } = {},
) {
  const { limit = 100, filters = {} } = options;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const propertyWhere: any = {
    AND: [
      { latitude: { gte: bounds.south, lte: bounds.north } },
      { longitude: { gte: bounds.west, lte: bounds.east } },
      { latitude: { not: null } },
      { longitude: { not: null } },
    ],
  };

  if (filters.city) propertyWhere.AND.push({ city: { contains: filters.city, mode: 'insensitive' } });
  if (filters.state) propertyWhere.AND.push({ state: { contains: filters.state, mode: 'insensitive' } });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestedListingWhere: any = { property: propertyWhere };
  const requestedStatus = parseListingStatus(filters.status);
  if (filters.status) requestedListingWhere.status = requestedStatus ?? { in: [] };
  if (filters.propertyType) requestedListingWhere.property = { ...propertyWhere, propertyType: filters.propertyType };
  if (filters.minPrice || filters.maxPrice) {
    const priceFilter: Record<string, number> = {};
    if (filters.minPrice) priceFilter.gte = parseFloat(String(filters.minPrice));
    if (filters.maxPrice) priceFilter.lte = parseFloat(String(filters.maxPrice));
    requestedListingWhere.listPrice = priceFilter;
  }
  const listingWhere = buildPublicListingWhere(requestedListingWhere);

  try {
    const listings = await prisma.listing.findMany({
      where: listingWhere,
      take: limit,
      orderBy: { listPrice: 'desc' },
      select: {
        id: true,
        propertyId: true,
        mlsId: true,
        mlsBoardId: true,
        slug: true,
        listPrice: true,
        status: true,
        listDate: true,
        imageUrl: true,
        description: true,
        listingAgentName: true,
        brokerageName: true,
        brokeragePhone: true,
        bedrooms: true,
        bathrooms: true,
        squareFeet: true,
        property: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            latitude: true,
            longitude: true,
            propertyType: true,
            bedrooms: true,
            bathrooms: true,
            squareFeet: true,
            lotSize: true,
            yearBuilt: true,
            subdivision: true,
            ...(isMlsPublicDisplayEnabled()
              ? { media: { select: { id: true, url: true, caption: true, order: true }, orderBy: { order: 'asc' as const } } }
              : {}),
          },
        },
      },
    });

    return {
      properties: listings,
      total: listings.length,
      bounds,
      searchMeta: { engine: 'postgresql', type: 'geographic' },
    };
  } catch (error) {
    logger.error('Geographic search error:', error);
    throw new Error(`Geographic search failed: ${(error as Error).message}`);
  }
}
