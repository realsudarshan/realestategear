import { ListingStatus, Prisma, prisma } from 'db';
import { resolveMlsBoardName } from '../utils/mlsBoardName.js';
import { compileCollectionPredicate } from 'search/collectionPredicate';

const LISTING_CARD_TAKE = 8;

const listingCardInclude = {
  property: {
    include: {
      media: { orderBy: { order: 'asc' as const }, take: 1 },
    },
  },
};

const listingDetailInclude = {
  property: {
    include: {
      media: { orderBy: { order: 'asc' as const } },
      listings: { orderBy: [{ listDate: 'desc' as const }, { createdAt: 'desc' as const }] },
    },
  },
};

function money(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeStatus(status: string): string {
  return status
    .split('_')
    .map((s) => s.charAt(0) + s.slice(1).toLowerCase())
    .join(' ');
}

function listingCard(listing: any) {
  const property = listing.property;
  return {
    id: listing.id,
    propertyId: listing.propertyId,
    listingKey: listing.listingKey,
    mlsId: listing.mlsId,
    mlsBoardId: listing.mlsBoardId,
    mlsBoardName: resolveMlsBoardName(listing.mlsBoardId),
    slug: listing.slug,
    status: normalizeStatus(listing.status),
    price: money(listing.listPrice),
    listDate: listing.listDate,
    imageUrl: listing.imageUrl ?? property?.media?.[0]?.url ?? null,
    address: property?.address ?? null,
    city: property?.city ?? null,
    state: property?.state ?? null,
    zipCode: property?.zipCode ?? null,
    bedrooms: listing.bedrooms ?? property?.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? property?.bathrooms ?? null,
    squareFeet: listing.squareFeet ?? property?.squareFeet ?? null,
    propertyType: property?.propertyType ?? null,
    brokerageName: listing.brokerageName,
    listingAgentName: listing.listingAgentName,
  };
}

function parseRawData(rawData: string | null): Record<string, unknown> | null {
  if (!rawData) return null;
  try {
    const parsed = JSON.parse(rawData);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function propertyFacts(property: any) {
  if (!property) return null;
  return {
    id: property.id,
    address: property.address,
    city: property.city,
    state: property.state,
    zipCode: property.zipCode,
    latitude: property.latitude,
    longitude: property.longitude,
    parcelId: property.parcelId,
    propertyType: property.propertyType,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    squareFeet: property.squareFeet,
    lotSize: property.lotSize,
    yearBuilt: property.yearBuilt,
    subdivision: property.subdivision,
  };
}

function transactionSummary(transaction: any) {
  return {
    id: transaction.id,
    type: transaction.type,
    stage: transaction.stage,
    address: transaction.address,
    mlsId: transaction.mlsId,
    listPrice: money(transaction.listPrice),
    salePrice: money(transaction.salePrice),
    closingDate: transaction.closingDate,
    updatedAt: transaction.updatedAt,
  };
}

function listingDetail(listing: any, transactions: any[]) {
  const rawData = parseRawData(listing.rawData);
  const history = listing.property?.listings ?? [];

  return {
    listing: {
      ...listingCard(listing),
      source: listing.source,
      closeDate: listing.closeDate,
      description: listing.description,
      rawData,
      agent: {
        name: listing.listingAgentName,
        email: listing.listingAgentEmail,
        phone: listing.listingAgentPhone,
      },
      brokerage: {
        name: listing.brokerageName,
        phone: listing.brokeragePhone,
      },
      updatedAt: listing.updatedAt,
    },
    property: propertyFacts(listing.property),
    media: (listing.property?.media ?? []).map((media) => ({
      id: media.id,
      url: media.url,
      caption: media.caption,
      order: media.order,
    })),
    propertyHistory: history.map(listingCard),
    workflow: {
      canCreateTransaction: transactions.length === 0,
      transactions: transactions.map(transactionSummary),
    },
  };
}

async function accountIdForUser(user: { id: string; accountId?: string | null }): Promise<string | null> {
  if (user.accountId) return user.accountId;
  const member = await prisma.accountMember.findFirst({ where: { userId: user.id }, select: { accountId: true } });
  return member?.accountId ?? null;
}

async function mlsAccessForAccount(accountId: string) {
  return prisma.accountMlsAccess.findMany({
    where: { accountId, verifiedAt: { not: null } },
    orderBy: { createdAt: 'asc' },
  });
}

function boardScopedWhere(mlsBoardIds: string[]): Prisma.ListingWhereInput {
  return {
    status: ListingStatus.ACTIVE,
    idxDisplayable: true,
    mlsBoardId: { in: mlsBoardIds },
  };
}

export async function getListingDiscovery(user: { id: string; accountId?: string | null }) {
  const accountId = await accountIdForUser(user);
  if (!accountId) throw Object.assign(new Error('No account found for user'), { status: 403 });

  const mlsAccess = await mlsAccessForAccount(accountId);
  const mlsBoardIds = mlsAccess.map((access) => access.mlsBoardId);
  const hasMlsAccess = mlsBoardIds.length > 0;

  const [collections, deployedCollections] = await Promise.all([
    prisma.listingCollection.findMany({ where: { portal: { accountId } }, select: { id: true } }),
    prisma.listingCollection.findMany({
      where: { portal: { accountId, isActive: true }, isPublished: true },
      include: { portal: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!hasMlsAccess) {
    return {
      setup: { hasMlsAccess, hasSegments: collections.length > 0, hasDeployedSegments: deployedCollections.length > 0, mlsBoards: [] },
      defaultFeed: null,
      segmentFeeds: [],
    };
  }

  const defaultListings = await prisma.listing.findMany({
    where: boardScopedWhere(mlsBoardIds),
    include: listingCardInclude,
    orderBy: [{ listDate: 'desc' }, { createdAt: 'desc' }],
    take: LISTING_CARD_TAKE,
  });

  const segmentFeeds = await Promise.all(deployedCollections.map(async (collection) => {
      const where = compileCollectionPredicate(collection.predicate, { accountId, portalId: collection.portal.id, boardIds: mlsBoardIds, collectionId: collection.id });
      const [count, properties] = await Promise.all([
        prisma.property.count({ where }),
        prisma.property.findMany({ where, take: LISTING_CARD_TAKE, orderBy: { updatedAt: 'desc' }, include: { media: { orderBy: { order: 'asc' }, take: 1 }, listings: { where: boardScopedWhere(mlsBoardIds), orderBy: [{ listDate: 'desc' }, { createdAt: 'desc' }], take: 1 } } }),
      ]);
      return {
        segmentId: collection.id,
        segmentName: collection.name,
        portalCount: 1,
        listingCount: count,
        listings: properties.flatMap((property) => property.listings[0] ? [listingCard({ ...property.listings[0], property })] : []),
      };
    }));

  return {
    setup: {
      hasMlsAccess,
      hasSegments: collections.length > 0,
      hasDeployedSegments: deployedCollections.length > 0,
      mlsBoards: mlsAccess.map((access) => ({
        mlsBoardId: access.mlsBoardId,
        mlsBoardName: resolveMlsBoardName(access.mlsBoardId),
        membershipId: access.membershipId,
        verifiedAt: access.verifiedAt,
      })),
    },
    defaultFeed: {
      label:
        mlsBoardIds.length === 1
          ? `Newest from ${resolveMlsBoardName(mlsBoardIds[0]) ?? mlsBoardIds[0]}`
          : 'Newest from your MLS boards',
      listings: defaultListings.map(listingCard),
    },
    segmentFeeds,
  };
}

export async function searchAgentListings(user: { id: string; accountId?: string | null }, q: string, limit = 12) {
  const accountId = await accountIdForUser(user);
  if (!accountId) throw Object.assign(new Error('No account found for user'), { status: 403 });

  const mlsAccess = await mlsAccessForAccount(accountId);
  const mlsBoardIds = mlsAccess.map((access) => access.mlsBoardId);
  if (mlsBoardIds.length === 0) return [];

  const query = q.trim();
  const base = boardScopedWhere(mlsBoardIds);
  const exactMls = await prisma.listing.findMany({
    where: { ...base, mlsId: { equals: query, mode: 'insensitive' } },
    include: listingCardInclude,
    orderBy: [{ listDate: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });
  if (exactMls.length >= limit) return exactMls.map(listingCard);

  const fuzzy = await prisma.listing.findMany({
    where: {
      ...base,
      NOT: exactMls.length ? { id: { in: exactMls.map((listing) => listing.id) } } : undefined,
      OR: [
        { mlsId: { contains: query, mode: 'insensitive' } },
        { property: { address: { contains: query, mode: 'insensitive' } } },
        { property: { city: { contains: query, mode: 'insensitive' } } },
        { property: { subdivision: { contains: query, mode: 'insensitive' } } },
      ],
    },
    include: listingCardInclude,
    orderBy: [{ listDate: 'desc' }, { createdAt: 'desc' }],
    take: Math.max(0, limit - exactMls.length),
  });

  return [...exactMls, ...fuzzy].map(listingCard);
}

export async function getAgentListingDetail(user: { id: string; accountId?: string | null }, id: string) {
  const accountId = await accountIdForUser(user);
  if (!accountId) throw Object.assign(new Error('No account found for user'), { status: 403 });

  const mlsAccess = await mlsAccessForAccount(accountId);
  const mlsBoardIds = mlsAccess.map((access) => access.mlsBoardId);
  if (mlsBoardIds.length === 0) throw Object.assign(new Error('Listing not found'), { status: 404 });

  const listing = await prisma.listing.findFirst({
    where: { ...boardScopedWhere(mlsBoardIds), id },
    include: listingDetailInclude,
  });
  if (!listing) throw Object.assign(new Error('Listing not found'), { status: 404 });

  const transactions = await prisma.transaction.findMany({
    where: { accountId, propertyId: listing.propertyId },
    orderBy: { updatedAt: 'desc' },
  });

  return listingDetail(listing, transactions);
}
