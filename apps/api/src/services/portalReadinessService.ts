import { Prisma, PropertyType, prisma } from 'db';
import { getPortalConfig, type PublicPortalConfig, toPublicPortalConfig } from '@realestategear/portal-config';
import { resolveMlsBoardName } from '../utils/mlsBoardName.js';
import { compileCollectionPredicate } from 'search/collectionPredicate';
import { buildPublicListingWhere, isMlsPublicDisplayEnabled } from 'search/propertyVisibility';

export type PortalGateState = 'passed' | 'blocked' | 'warning';

export interface PortalReadinessGate {
  id: string;
  label: string;
  state: PortalGateState;
  reason?: string;
}

export interface PortalReadiness {
  listingMode: 'hidden' | 'mock' | 'db';
  publicListingDisplay: 'hidden' | 'mock' | 'real';
  canShowSearch: boolean;
  canShowListings: boolean;
  configSource: 'code' | 'default';
  gates: PortalReadinessGate[];
  blockers: PortalReadinessGate[];
  warnings: PortalReadinessGate[];
}

interface PortalForReadiness {
  id: string;
  accountId: string;
  slug: string;
  isActive: boolean;
  agentEmail: string | null;
  brokerageName: string | null;
  brokeragePhone: string | null;
  collections?: Array<{ id: string; predicate: Prisma.JsonValue; isPublished: boolean }>;
}

export interface PortalListingQuery {
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
}

const DEFAULT_PUBLIC_CONFIG: Omit<PublicPortalConfig, 'slug' | 'name' | 'domains' | 'theme'> = {
  listings: { mode: 'db', boardIds: [], collectionSlugs: [] },
  features: { search: true, map: false, inquiryForm: true, savedSearch: false },
  compliance: {
    idxApproved: true,
    brokerageName: '',
    brokeragePhone: '',
    publicListingDisplay: 'real',
  },
};

function resolveEnvironment() {
  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.RAILWAY_ENVIRONMENT_NAME === 'preview' || process.env.VERCEL_ENV === 'preview') return 'preview';
  if (process.env.RAILWAY_ENVIRONMENT_NAME === 'staging') return 'staging';
  return 'local';
}

// There is exactly one code-configured portal per deployment. A DB Portal row
// whose slug doesn't match it (e.g. an extra portal someone created despite
// the recommended one-portal-per-deployment shape) gracefully degrades to
// sensible defaults rather than erroring.
function resolvePublicConfig(slug: string): { config: PublicPortalConfig; source: 'code' | 'default' } {
  const resolved = getPortalConfig({ environment: resolveEnvironment() });
  if (resolved.slug !== slug) {
    return {
      config: {
        slug,
        name: slug,
        domains: [],
        theme: {},
        ...DEFAULT_PUBLIC_CONFIG,
      },
      source: 'default',
    };
  }
  return {
    config: toPublicPortalConfig(resolved),
    source: 'code',
  };
}

function gate(id: string, label: string, state: PortalGateState, reason?: string): PortalReadinessGate {
  return { id, label, state, reason };
}

function publishedCollections(portal: PortalForReadiness) {
  return portal.collections?.filter((collection) => collection.isPublished) ?? [];
}

export type PortalPropertyFilters = Pick<
  PortalListingQuery,
  'q' | 'minPrice' | 'maxPrice' | 'bedrooms' | 'bathrooms' | 'propertyType'
>;

function isValidPropertyType(value: string): value is PropertyType {
  return (Object.values(PropertyType) as string[]).includes(value);
}

// Single source of truth for "what counts as an active, displayable listing,
// matching these price filters" — used both for matching properties
// (buildPortalPropertyWhere) and for which listing gets displayed
// (getPortalListings' `include`). These must stay in lockstep: if only the
// match side applied the price range, a property with multiple listings
// could match via an in-range listing but *display* a different,
// out-of-range one.
function buildActiveListingWhere(
  boardIds: string[],
  priceFilters: { minPrice?: number; maxPrice?: number } = {}
): Prisma.ListingWhereInput {
  return buildPublicListingWhere({
    ...(boardIds.length > 0 ? { mlsBoardId: { in: boardIds } } : {}),
    ...(priceFilters.minPrice != null || priceFilters.maxPrice != null
      ? {
          listPrice: {
            ...(priceFilters.minPrice != null ? { gte: priceFilters.minPrice } : {}),
            ...(priceFilters.maxPrice != null ? { lte: priceFilters.maxPrice } : {}),
          },
        }
      : {}),
  });
}

export function buildPortalPropertyWhere(
  portal: PortalForReadiness,
  boardIds: string[] = [],
  filters: PortalPropertyFilters = {}
): Prisma.PropertyWhereInput | null {
  const collections = publishedCollections(portal);
  if (collections.length === 0) return null;

  const where: Prisma.PropertyWhereInput = {
    AND: [
      { OR: collections.map((collection) => compileCollectionPredicate(collection.predicate, { accountId: portal.accountId, portalId: portal.id, boardIds, collectionId: collection.id, publicVisibility: true })) },
      { listings: { some: buildActiveListingWhere(boardIds, { minPrice: filters.minPrice, maxPrice: filters.maxPrice }) } },
    ],
    // Math.trunc: bedrooms is a typed Int column — a fractional query param
    // (e.g. ?bedrooms=2.5) would otherwise reach Prisma as a float and throw
    // a PrismaClientValidationError instead of degrading gracefully.
    ...(filters.bedrooms != null ? { bedrooms: { gte: Math.trunc(filters.bedrooms) } } : {}),
    ...(filters.bathrooms != null ? { bathrooms: { gte: filters.bathrooms } } : {}),
    ...(filters.propertyType && isValidPropertyType(filters.propertyType)
      ? { propertyType: filters.propertyType }
      : {}),
  };
  const search = filters.q?.trim();
  if (search) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : [where.AND].filter(Boolean) as Prisma.PropertyWhereInput[]),
      {
        OR: [
          { address: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
          { state: { contains: search, mode: 'insensitive' } },
          { zipCode: { contains: search } },
          { subdivision: { contains: search, mode: 'insensitive' } },
        ],
      },
    ];
  }

  return where;
}

async function countMatchingListings(portal: PortalForReadiness, boardIds: string[]) {
  const where = buildPortalPropertyWhere(portal, boardIds);
  if (!where) return 0;
  return prisma.property.count({ where });
}

export async function getPortalReadiness(portal: PortalForReadiness): Promise<PortalReadiness> {
  const { config, source } = resolvePublicConfig(portal.slug);
  const mode = config.listings.mode;
  const gates: PortalReadinessGate[] = [];

  gates.push(
    gate(
      'agent-email',
      'Agent email set',
      portal.agentEmail ? 'passed' : 'blocked',
      portal.agentEmail ? undefined : 'Add an agent email for inquiry delivery.'
    )
  );

  const hasBrokerage = Boolean(portal.brokerageName && portal.brokeragePhone);
  gates.push(
    gate(
      'brokerage',
      'Brokerage compliance',
      hasBrokerage ? 'passed' : 'blocked',
      hasBrokerage ? undefined : 'Set brokerage name and phone for public compliance display.'
    )
  );

  if (mode === 'hidden') {
    gates.push(gate('listing-policy', 'Listing policy', 'passed', 'Listings are intentionally hidden for this portal.'));
  } else if (mode === 'mock') {
    gates.push(
      gate(
        'listing-policy',
        'Listing policy',
        config.compliance.publicListingDisplay === 'mock' ? 'warning' : 'passed',
        config.compliance.publicListingDisplay === 'mock'
          ? 'Mock listings are enabled for this environment; do not use for live IDX display.'
          : 'Mock listings are hidden by the environment safety guard.'
      )
    );
  } else {
    gates.push(
      gate(
        'idx-approval',
        'IDX approval',
        config.compliance.idxApproved ? 'passed' : source === 'default' ? 'warning' : 'blocked',
        config.compliance.idxApproved
          ? undefined
          : source === 'default'
            ? 'No code-defined IDX policy exists; using DB portal defaults.'
            : 'IDX approval must be true before real listings can be displayed.'
      )
    );

    gates.push(
      gate(
        'collections-published',
        'Collections published',
        publishedCollections(portal).length ? 'passed' : 'blocked',
        publishedCollections(portal).length ? undefined : 'Publish at least one listing collection.'
      )
    );

    const matchCount = await countMatchingListings(portal, config.listings.boardIds);
    gates.push(
      gate(
        'listings-match',
        'Listings available',
        matchCount > 0 ? 'passed' : 'blocked',
        matchCount > 0
          ? `${matchCount.toLocaleString()} active IDX-displayable listing${matchCount === 1 ? '' : 's'} match this portal.`
          : 'No active IDX-displayable listings match the published collections and board scope.'
      )
    );
  }

  const blockers = gates.filter((item) => item.state === 'blocked');
  const warnings = gates.filter((item) => item.state === 'warning');
  const canShowListings = mode === 'db' && blockers.length === 0;

  return {
    listingMode: mode,
    publicListingDisplay: config.compliance.publicListingDisplay,
    canShowSearch: canShowListings && config.features.search,
    canShowListings,
    configSource: source,
    gates,
    blockers,
    warnings,
  };
}

function decimalToNumber(value: unknown) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toPortalProperty(property: any, selectedListing?: any) {
  const listing = selectedListing ?? property.listings?.[0] ?? null;
  return {
    id: property.id,
    address: property.address,
    city: property.city,
    state: property.state,
    zipCode: property.zipCode,
    subdivision: property.subdivision,
    price: decimalToNumber(listing?.listPrice),
    bedrooms: property.bedrooms ?? listing?.bedrooms ?? null,
    bathrooms: property.bathrooms ?? listing?.bathrooms ?? null,
    squareFeet: property.squareFeet ?? listing?.squareFeet ?? null,
    imageUrl: listing?.imageUrl ?? (isMlsPublicDisplayEnabled() ? property.media?.[0]?.url ?? null : null),
    slug: listing?.slug ?? null,
    status: listing?.status ?? null,
    listingId: listing?.id ?? null,
  };
}

function toPortalPropertyDetail(property: any, listing: any) {
  return {
    ...toPortalProperty(property, listing),
    propertyType: property.propertyType ?? null,
    lotSize: decimalToNumber(property.lotSize),
    yearBuilt: property.yearBuilt ?? null,
    latitude: property.latitude ?? null,
    longitude: property.longitude ?? null,
    description: listing.description ?? null,
    mlsId: listing.mlsId ?? null,
    mlsBoardId: listing.mlsBoardId ?? null,
    mlsBoardName: resolveMlsBoardName(listing.mlsBoardId),
    listingDate: listing.listDate ?? null,
    lastMlsUpdate: listing.updatedAt ?? null,
    listingAgentName: listing.listingAgentName ?? null,
    brokerageName: listing.brokerageName ?? null,
    brokeragePhone: listing.brokeragePhone ?? null,
    media: (isMlsPublicDisplayEnabled() ? property.media ?? [] : []).map((item: any) => ({
      id: item.id,
      url: item.url,
      caption: item.caption ?? null,
    })),
  };
}

function sortOption(sortBy?: string, sortOrder?: string): Prisma.PropertyOrderByWithRelationInput {
  if (sortBy === 'yearBuilt') return { yearBuilt: sortOrder === 'asc' ? 'asc' : 'desc' };
  if (sortBy === 'squareFeet') return { squareFeet: sortOrder === 'asc' ? 'asc' : 'desc' };
  return { createdAt: 'desc' };
}

export async function getPortalListings(portal: PortalForReadiness, query: PortalListingQuery = {}) {
  const readiness = await getPortalReadiness(portal);
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 12)));

  if (!readiness.canShowListings) {
    return {
      properties: [],
      pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      readiness,
    };
  }

  const { config } = resolvePublicConfig(portal.slug);
  const where = buildPortalPropertyWhere(portal, config.listings.boardIds, {
    q: query.q,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    bedrooms: query.bedrooms,
    bathrooms: query.bathrooms,
    propertyType: query.propertyType,
  });
  if (!where) {
    return {
      properties: [],
      pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      readiness,
    };
  }

  const skip = (page - 1) * limit;
  const listingWhere = buildActiveListingWhere(config.listings.boardIds, {
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
  });

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      skip,
      take: limit,
      orderBy: sortOption(query.sortBy, query.sortOrder),
      include: {
        media: { orderBy: { order: 'asc' }, take: 1 },
        listings: { where: listingWhere, orderBy: [{ listDate: 'desc' }, { createdAt: 'desc' }], take: 1 },
      },
    }),
    prisma.property.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);
  return {
    properties: properties.map(toPortalProperty),
    pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    readiness,
  };
}

export async function getPortalProperty(portal: PortalForReadiness, identifier: string) {
  const readiness = await getPortalReadiness(portal);
  if (!readiness.canShowListings) return null;

  const { config } = resolvePublicConfig(portal.slug);
  const scopedWhere = buildPortalPropertyWhere(portal, config.listings.boardIds);
  if (!scopedWhere) return null;

  const listingWhere = buildActiveListingWhere(config.listings.boardIds);
  const property = await prisma.property.findFirst({
    where: {
      AND: [
        scopedWhere,
        {
          OR: [
            { id: identifier },
            { listings: { some: { ...listingWhere, slug: identifier } } },
          ],
        },
      ],
    },
    include: {
      media: { orderBy: { order: 'asc' } },
      listings: {
        where: listingWhere,
        orderBy: [{ listDate: 'desc' }, { createdAt: 'desc' }],
      },
    },
  });
  if (!property) return null;

  // A slug identifies a listing period; an id identifies the property and uses
  // its newest eligible listing. Never substitute a different listing for a slug.
  const listing = property.id === identifier
    ? property.listings[0]
    : property.listings.find((item) => item.slug === identifier);
  return listing ? toPortalPropertyDetail(property, listing) : null;
}
