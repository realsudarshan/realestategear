import { prisma } from 'db';
import logger from '../utils/logger.js';

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
  const listingWhere: any = { property: propertyWhere };
  if (filters.status) listingWhere.status = filters.status;
  if (filters.propertyType) listingWhere.property = { ...propertyWhere, propertyType: filters.propertyType };
  if (filters.minPrice || filters.maxPrice) {
    const priceFilter: Record<string, number> = {};
    if (filters.minPrice) priceFilter.gte = parseFloat(String(filters.minPrice));
    if (filters.maxPrice) priceFilter.lte = parseFloat(String(filters.maxPrice));
    listingWhere.listPrice = priceFilter;
  }

  try {
    const listings = await prisma.listing.findMany({
      where: listingWhere,
      take: limit,
      orderBy: { listPrice: 'desc' },
      include: { property: { include: { media: { orderBy: { order: 'asc' } } } } },
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
