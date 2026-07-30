import express from 'express';
import Joi from 'joi';
import { validateRequest } from '../middleware/validation.js';
import { cacheSearch } from '../middleware/cache.js';
import logger from '../utils/logger.js';
import { searchByBounds } from '../services/searchService.js';
import { prisma } from 'db';
import { ListingStatus, PropertyType } from 'db';
import type { Prisma } from 'db';
import { generateWebSearchKey, generateAgentSearchKey, reconcilePropertyDocument, reindexAll, toPropertyDoc, toContactDoc, toTransactionDoc, toNoteDoc, toTaskDoc, searchDocuments, isTypesenseConfigured, searchPropertiesPg } from '../search/index.js';
import { buildTypesenseGeoFilter } from '../search/typesenseGeoFilter.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { buildPublicListingWhere, buildPublicPropertyTypesenseFilter } from 'search/propertyVisibility';

const router = express.Router();

const typesenseLiteral = Joi.string()
  .trim()
  .max(100)
  .pattern(/^[\p{L}\p{M}\p{N} .'’,\-]+$/u);
const publicStatuses = Object.values(ListingStatus).map((status) =>
  status.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' '),
);

// Search validation schema
const searchSchema = Joi.object({
  q: Joi.string().min(1).max(200).optional(),
  city: typesenseLiteral.optional(),
  state: typesenseLiteral.optional(),
  minPrice: Joi.number().positive().optional(),
  maxPrice: Joi.number().positive().optional(),
  bedrooms: Joi.number().integer().min(0).optional(),
  bathrooms: Joi.number().positive().optional(),
  propertyType: typesenseLiteral.valid(...Object.values(PropertyType)).optional(),
  status: typesenseLiteral.valid(...publicStatuses).optional(),
  minSquareFeet: Joi.number().integer().positive().optional(),
  maxSquareFeet: Joi.number().integer().positive().optional(),
  minYearBuilt: Joi.number().integer().min(1800).max(new Date().getFullYear()).optional(),
  maxYearBuilt: Joi.number().integer().min(1800).max(new Date().getFullYear()).optional(),
  zipCodes: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
  cities: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
  subdivisions: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
  sortBy: Joi.string().valid('price', 'createdAt', 'updatedAt', 'listingDate', 'yearBuilt', 'squareFeet').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

// Geo search validation schema
const geoSearchSchema = Joi.object({
  north: Joi.number().required(),
  south: Joi.number().required(),
  east: Joi.number().required(),
  west: Joi.number().required(),
  limit: Joi.number().integer().min(1).max(500).default(100),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  minPrice: Joi.number().positive().optional(),
  maxPrice: Joi.number().positive().optional(),
  propertyType: Joi.string().optional(),
  status: Joi.string().optional()
});

// GET /api/search - Property search via Typesense
router.get('/', cacheSearch, validateRequest({ query: searchSchema }), async (req, res, next) => {
  try {
    const {
      q: searchQuery,
      city,
      state,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
      propertyType,
      status,
      minSquareFeet,
      maxSquareFeet,
      minYearBuilt,
      maxYearBuilt,
      zipCodes: zipCodesRaw,
      cities: citiesRaw,
      subdivisions: subdivisionsRaw,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = req.query;

    const toArray = (v: unknown): string[] =>
      Array.isArray(v) ? v as string[] : v ? [v as string] : [];
    const zipCodes = toArray(zipCodesRaw);
    const cities = toArray(citiesRaw);
    const subdivisions = toArray(subdivisionsRaw);

    const filterParts: string[] = [];
    // Geographic OR-group (segment semantics): the cities[] / zipCodes[] /
    // subdivisions[] arrays are legacy public search inputs; they are
    // any-match within and across the three fields. The single-value `city`
    // scalar below is a different code path used by the general consumer
    // search (single-city refinement, AND-joined).
    const segmentGeoClause = buildTypesenseGeoFilter({ zipCodes, cities, subdivisions }, { appendStatus: false });
    if (segmentGeoClause) filterParts.push(segmentGeoClause);

    if (city) filterParts.push(`city:=${city}`);
    if (state) filterParts.push(`state:=${state}`);
    if (status) filterParts.push(`status:=${status}`);
    if (propertyType) filterParts.push(`propertyType:=${propertyType}`);
    if (minPrice) filterParts.push(`price:>=${parseFloat(minPrice)}`);
    if (maxPrice) filterParts.push(`price:<=${parseFloat(maxPrice)}`);
    if (bedrooms) filterParts.push(`bedrooms:>=${parseInt(bedrooms)}`);
    if (bathrooms) filterParts.push(`bathrooms:>=${parseFloat(bathrooms)}`);
    if (minSquareFeet) filterParts.push(`squareFeet:>=${parseInt(minSquareFeet)}`);
    if (maxSquareFeet) filterParts.push(`squareFeet:<=${parseInt(maxSquareFeet)}`);
    if (minYearBuilt) filterParts.push(`yearBuilt:>=${parseInt(minYearBuilt)}`);
    if (maxYearBuilt) filterParts.push(`yearBuilt:<=${parseInt(maxYearBuilt)}`);

    const tsSort = sortBy === 'createdAt' ? `createdAt:${sortOrder}` : `${sortBy}:${sortOrder}`;

    const startTime = Date.now();

    // Backed by Typesense when TYPESENSE_HOST is set; falls back to the
    // Postgres ILIKE equivalent (packages/search/postgresFallback.ts) when
    // it isn't, or if the Typesense call throws.
    const runTypesense = () =>
      searchDocuments('properties', {
        q: searchQuery || undefined,
        filterBy: buildPublicPropertyTypesenseFilter(filterParts.join(' && ')),
        sortBy: tsSort,
        page: parseInt(page),
        perPage: parseInt(limit),
      }).then((result) => ({
        items: result.hits?.map((h) => h.document) ?? [],
        total: result.found ?? 0,
        engine: 'typesense' as const,
      }));

    const runPostgres = () =>
      searchPropertiesPg({
        q: searchQuery,
        city,
        state,
        status,
        propertyType,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
        bathrooms: bathrooms ? parseFloat(bathrooms) : undefined,
        minSquareFeet: minSquareFeet ? parseInt(minSquareFeet) : undefined,
        maxSquareFeet: maxSquareFeet ? parseInt(maxSquareFeet) : undefined,
        minYearBuilt: minYearBuilt ? parseInt(minYearBuilt) : undefined,
        maxYearBuilt: maxYearBuilt ? parseInt(maxYearBuilt) : undefined,
        cities,
        zipCodes,
        subdivisions,
        sortBy,
        sortOrder,
        page: parseInt(page),
        limit: parseInt(limit),
      }).then((result) => ({ items: result.items, total: result.total, engine: 'postgres' as const }));

    const { items: properties, total, engine } = isTypesenseConfigured()
      ? await runTypesense().catch((error) => {
          logger.warn('Typesense property search failed, falling back to Postgres', { error });
          return runPostgres();
        })
      : await runPostgres();

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      properties,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        currentPage: parseInt(page),
        pages: totalPages,
      },
      search: {
        query: searchQuery || '',
        totalResults: total,
        resultsOnPage: properties.length,
        responseTime: Date.now() - startTime,
        engine,
      },
    });

  } catch (error) {
    logger.error('Search error:', error);
    next(error);
  }
});

// GET /api/search/geo - Geographic bounds search
router.get('/geo', validateRequest({ query: geoSearchSchema }), async (req, res, next) => {
  try {
    const {
      north,
      south,
      east,
      west,
      limit = 100,
      city,
      state,
      minPrice,
      maxPrice,
      propertyType,
      status
    } = req.query;

    const bounds = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west)
    };

    // Prepare filters for geo search
    const filters: Record<string, unknown> = {};
    if (city) filters.city = city;
    if (state) filters.state = state;
    if (minPrice) filters.minPrice = minPrice;
    if (maxPrice) filters.maxPrice = maxPrice;
    if (propertyType) filters.propertyType = propertyType;
    if (status) filters.status = status;

    const options = {
      limit: parseInt(limit),
      filters
    };

    const result = await searchByBounds(bounds, options);

    res.json({
      properties: result.properties,
      pagination: {
        total: result.total,
        limit: parseInt(limit),
        resultsOnPage: result.properties.length
      },
      bounds: result.bounds,
      searchMeta: result.searchMeta
    });

  } catch (error) {
    logger.error('Geographic search error:', error);
    next(error);
  }
});

// Search suggestions validation schema
const suggestionsSchema = Joi.object({
  q: Joi.string().min(1).max(100).required(),
  limit: Joi.number().integer().min(1).max(15).default(8),
  types: Joi.string().optional()
});

// GET /api/search/suggestions - Get search suggestions/autocomplete
router.get('/suggestions', validateRequest({ query: suggestionsSchema }), async (req, res, next) => {
  try {
    const { q: query, limit = 8, types = 'all' } = req.query;

    if (!query || query.length < 2) {
      return res.json({ query, suggestions: [] });
    }

    logger.debug('Search suggestions request', { query, limit, types });

    const suggestions: Array<Record<string, unknown>> = [];

    // City suggestions (highest priority)
    if (types === 'all' || types === 'cities') {
      const cities = await prisma.property.groupBy({
        by: ['city', 'state'],
        where: {
          city: { contains: query, mode: 'insensitive' },
          listings: { some: buildPublicListingWhere() },
        },
        _count: { city: true },
        orderBy: { _count: { city: 'desc' } },
        take: Math.min(limit, 5)
      });

      suggestions.push(...cities.map(item => ({
        type: 'city',
        value: item.city,
        display: `${item.city}, ${item.state}`,
        count: item._count.city,
        searchType: 'location',
        icon: 'map-pin'
      })));
    }

    // Address suggestions
    if (types === 'all' || types === 'addresses') {
      const addresses = await prisma.property.findMany({
        where: {
          address: { contains: query, mode: 'insensitive' },
          listings: { some: buildPublicListingWhere() },
        },
        select: {
          id: true,
          address: true,
          city: true,
          state: true,
          propertyType: true,
          listings: {
            where: buildPublicListingWhere(),
            orderBy: { listDate: 'desc' },
            take: 1,
            select: { listPrice: true },
          },
        },
        take: Math.min(limit - suggestions.length, 4),
        orderBy: { createdAt: 'desc' }
      });

      suggestions.push(...addresses.map(item => ({
        type: 'address',
        value: item.address,
        display: `${item.address}, ${item.city}`,
        subtitle: `${item.propertyType} • $${parseInt(String(item.listings[0]?.listPrice ?? 0)).toLocaleString()}`,
        searchType: 'property',
        propertyId: item.id,
        icon: 'home'
      })));
    }

    // Property type suggestions
    if ((types === 'all' || types === 'types') && suggestions.length < limit) {
      const propertyTypes = await prisma.property.groupBy({
        by: ['propertyType'],
        where: { listings: { some: buildPublicListingWhere() } },
        _count: { propertyType: true },
        orderBy: { _count: { propertyType: 'desc' } },
        take: Math.min(limit - suggestions.length, 3)
      });

      suggestions.push(...propertyTypes.filter((item) => String(item.propertyType ?? '').toLowerCase().includes(String(query).toLowerCase())).map(item => ({
        type: 'propertyType',
        value: item.propertyType,
        display: item.propertyType,
        count: item._count.propertyType,
        searchType: 'filter',
        icon: 'building-office'
      })));
    }

    res.json({
      query,
      suggestions: suggestions.slice(0, limit),
      meta: {
        count: suggestions.length,
        types: types,
        responseTime: Date.now()
      }
    });

  } catch (error) {
    logger.error('Search suggestions error:', error);
    res.json({ query: req.query.q, suggestions: [], error: 'Failed to fetch suggestions' });
  }
});

// GET /api/search/stats - Typesense collection health
router.get('/stats', async (_req, res, next) => {
  try {
    const { default: client } = await import('search/typesenseClient');
    const [properties, contacts] = await Promise.allSettled([
      client.collections('properties').retrieve(),
      client.collections('contacts').retrieve(),
    ]);
    res.json({
      engine: 'typesense',
      collections: {
        properties: properties.status === 'fulfilled' ? { count: properties.value.num_documents } : { error: true },
        contacts: contacts.status === 'fulfilled' ? { count: contacts.value.num_documents } : { error: true },
      },
    });
  } catch (error) {
    logger.error('Search stats error:', error);
    next(error);
  }
});

// GET /api/search/key - Returns a scoped Typesense search key for the calling client
router.get('/key', authMiddleware, async (req, res, next) => {
  try {
    const user = req.user;
    let key: string;

    if (user.role === 'AGENT' || user.role === 'ADMIN') {
      const member = await prisma.accountMember.findFirst({ where: { userId: user.id } });
      key = member ? generateAgentSearchKey(member.accountId) : generateWebSearchKey();
    } else {
      key = generateWebSearchKey();
    }

    res.json({
      key,
      host: process.env.TYPESENSE_HOST,
      port: parseInt(process.env.TYPESENSE_PORT || '8108'),
      protocol: process.env.TYPESENSE_PROTOCOL || 'http',
    });
  } catch (error) {
    logger.error('Search key generation error:', error);
    next(error);
  }
});

// POST /api/search/reindex/:collection - properties are exact; other collections upsert (admin only)
router.post('/reindex/:collection', authMiddleware, requireRole(['ADMIN']), async (req, res, next) => {
  const { collection } = req.params;
  const supportedCollections = ['properties', 'contacts', 'transactions', 'notes', 'tasks'] as const;

  if (collection !== 'all' && !supportedCollections.includes(collection as typeof supportedCollections[number])) {
    return res.status(400).json({ error: `Unknown search collection: ${collection}` });
  }

  try {
    const counts: Record<string, Awaited<ReturnType<typeof reindexAll>>> = {};
    if (collection === 'properties' || collection === 'all') {
      counts.properties = await reindexAll('properties', async () => {
        const rows = await prisma.property.findMany({
          where: { listings: { some: buildPublicListingWhere() } },
          include: {
            listings: {
              where: buildPublicListingWhere(),
              orderBy: [{ listDate: 'desc' }, { createdAt: 'desc' }],
              take: 1,
            },
          },
        });
        return rows.map((p) => toPropertyDoc(p, p.listings[0]));
      }, {
        exact: true,
        reconcile: (propertyId) => reconcilePropertyDocument(propertyId),
      });
    }

    if (collection === 'contacts' || collection === 'all') {
      counts.contacts = await reindexAll('contacts', async () => {
        const rows = await prisma.contact.findMany();
        return rows.map(toContactDoc);
      });
    }

    if (collection === 'transactions' || collection === 'all') {
      counts.transactions = await reindexAll('transactions', async () => {
        const rows = await prisma.transaction.findMany({
          include: {
            parties: { include: { contact: { select: { firstName: true, lastName: true } } } },
          },
        });
        return rows.map(toTransactionDoc);
      });
    }

    if (collection === 'notes' || collection === 'all') {
      counts.notes = await reindexAll('notes', async () => {
        const rows = await prisma.note.findMany();
        return rows.map(toNoteDoc);
      });
    }

    if (collection === 'tasks' || collection === 'all') {
      counts.tasks = await reindexAll('tasks', async () => {
        const rows = await prisma.task.findMany();
        return rows.map(toTaskDoc);
      });
    }

    res.json({ ok: true, collection, counts });
  } catch (error) {
    logger.error('Reindex error:', error);
    next(error);
  }
});

export default router;
