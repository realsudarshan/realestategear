import { parseCollectionPredicate, type CollectionPredicate, type NumericPredicate } from '@realestategear/portal-config';
import { ListingStatus, type Prisma, type PropertyType } from 'db';
import { buildPublicListingWhere } from './propertyVisibility.js';

export interface CollectionScope { accountId: string; portalId: string; boardIds: string[]; collectionId?: string; publicVisibility?: boolean }

function scalarNumber(field: string, rule: NumericPredicate): Prisma.PropertyWhereInput {
  if (rule.nulls === 'only') return { [field]: null } as Prisma.PropertyWhereInput;
  const range = { ...(rule.min != null ? { gte: rule.min } : {}), ...(rule.max != null ? { lte: rule.max } : {}) };
  return rule.nulls === 'include'
    ? { OR: [{ [field]: null }, { [field]: range }] } as Prisma.PropertyWhereInput
    : { [field]: range } as Prisma.PropertyWhereInput;
}

export function compileCollectionPredicate(value: unknown, scope: CollectionScope): Prisma.PropertyWhereInput {
  const p = parseCollectionPredicate(value);
  const predicateAnd: Prisma.PropertyWhereInput[] = [];
  if (p.areaSlugs?.length) predicateAnd.push({ areaMemberships: { some: { decision: 'POSITIVE', area: { accountId: scope.accountId, slug: { in: p.areaSlugs } } } } });
  if (p.tagsAny?.length) predicateAnd.push({ classifications: { some: { accountId: scope.accountId, decision: 'POSITIVE', tagSlug: { in: p.tagsAny } } } });
  for (const tag of p.tagsAll ?? []) predicateAnd.push({ classifications: { some: { accountId: scope.accountId, decision: 'POSITIVE', tagSlug: tag } } });
  if (p.tagsExclude?.length) predicateAnd.push({ classifications: { none: { accountId: scope.accountId, decision: 'POSITIVE', tagSlug: { in: p.tagsExclude } } } });
  if (p.propertyTypes?.length) predicateAnd.push({ propertyType: { in: p.propertyTypes as PropertyType[] } });
  if (p.beds) predicateAnd.push(scalarNumber('bedrooms', p.beds));
  if (p.baths) predicateAnd.push(scalarNumber('bathrooms', p.baths));
  if (p.sqft) predicateAnd.push(scalarNumber('squareFeet', p.sqft));
  if (p.lotSize) predicateAnd.push(scalarNumber('lotSize', p.lotSize));
  if (p.yearBuilt) predicateAnd.push(scalarNumber('yearBuilt', p.yearBuilt));

  const price = p.price;
  let priceWhere: Prisma.ListingWhereInput = {};
  if (price?.nulls === 'only') priceWhere = { listPrice: null };
  else if (price && price.nulls === 'exclude') priceWhere = { listPrice: { ...(price.min != null ? { gte: price.min } : {}), ...(price.max != null ? { lte: price.max } : {}) } };
  // include means a null or in-range listing; model as two eligible-listing branches.
  const baseListing = (additional?: Prisma.ListingWhereInput): Prisma.ListingWhereInput => {
    const where = {
      ...(scope.boardIds.length ? { mlsBoardId: { in: scope.boardIds } } : {}),
      ...additional,
    };
    return scope.publicVisibility
      ? buildPublicListingWhere(where)
      : { status: ListingStatus.ACTIVE, idxDisplayable: true, ...where };
  };
  const eligibility: Prisma.PropertyWhereInput = price?.nulls === 'include'
    ? { OR: [
        { listings: { some: baseListing({ listPrice: null }) } },
        { listings: { some: baseListing({ listPrice: { ...(price.min != null ? { gte: price.min } : {}), ...(price.max != null ? { lte: price.max } : {}) } }) } },
      ] }
    : { listings: { some: baseListing(priceWhere) } };

  if (!scope.collectionId) return { AND: [eligibility, ...predicateAnd] };
  // EXCLUDE is an authoritative veto. INCLUDE bypasses the predicate only.
  const excluded: Prisma.PropertyWhereInput = { collectionOverrides: { none: { collectionId: scope.collectionId, decision: 'EXCLUDE' } } };
  if (predicateAnd.length === 0) return { AND: [eligibility, excluded] };
  const included: Prisma.PropertyWhereInput = { collectionOverrides: { some: { collectionId: scope.collectionId, decision: 'INCLUDE' } } };
  return { AND: [eligibility, excluded, { OR: [included, { AND: predicateAnd }] }] };
}

export interface PredicateFixtureProperty { areaSlugs: string[]; tags: string[]; propertyType: string | null; price: number | null; beds: number | null; baths: number | null; sqft: number | null; lotSize: number | null; yearBuilt: number | null }
function matchesNumeric(value: number | null, rule?: NumericPredicate) {
  if (!rule) return true;
  if (value == null) return rule.nulls === 'include' || rule.nulls === 'only';
  if (rule.nulls === 'only') return false;
  return (rule.min == null || value >= rule.min) && (rule.max == null || value <= rule.max);
}
export function evaluateCollectionPredicate(value: unknown, row: PredicateFixtureProperty): boolean {
  const p: CollectionPredicate = parseCollectionPredicate(value);
  return (!p.areaSlugs?.length || p.areaSlugs.some((v) => row.areaSlugs.includes(v)))
    && (!p.tagsAny?.length || p.tagsAny.some((v) => row.tags.includes(v)))
    && (!p.tagsAll?.length || p.tagsAll.every((v) => row.tags.includes(v)))
    && !p.tagsExclude?.some((v) => row.tags.includes(v))
    && (!p.propertyTypes?.length || (row.propertyType != null && p.propertyTypes.includes(row.propertyType)))
    && matchesNumeric(row.price, p.price) && matchesNumeric(row.beds, p.beds) && matchesNumeric(row.baths, p.baths)
    && matchesNumeric(row.sqft, p.sqft) && matchesNumeric(row.lotSize, p.lotSize) && matchesNumeric(row.yearBuilt, p.yearBuilt);
}
export function explainCollectionPredicate(value: unknown, row: PredicateFixtureProperty) {
  const matched = evaluateCollectionPredicate(value, row);
  return { matched, reason: matched ? 'Matched every configured predicate group.' : 'Failed one or more predicate groups.' };
}
