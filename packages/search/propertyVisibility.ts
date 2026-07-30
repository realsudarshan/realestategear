import { ListingSource, ListingStatus, type Prisma } from 'db';

export type PropertyVisibilityEnvironment = {
  MLS_PUBLIC_DISPLAY_ENABLED?: string;
};

export function isMlsPublicDisplayEnabled(
  env: PropertyVisibilityEnvironment = process.env,
): boolean {
  return env.MLS_PUBLIC_DISPLAY_ENABLED === 'true';
}

export function buildPublicListingWhere(
  additional?: Prisma.ListingWhereInput,
  env: PropertyVisibilityEnvironment = process.env,
): Prisma.ListingWhereInput {
  const baseline: Prisma.ListingWhereInput = {
    status: ListingStatus.ACTIVE,
    idxDisplayable: true,
    ...(isMlsPublicDisplayEnabled(env) ? {} : { source: { not: ListingSource.MLS } }),
  };

  return additional ? { AND: [baseline, additional] } : baseline;
}

export function getPublicPropertyTypesenseBaselineFilter(
  env: PropertyVisibilityEnvironment = process.env,
): string {
  const baseline = 'status:=Active && idxDisplayable:=true';
  return isMlsPublicDisplayEnabled(env) ? baseline : `${baseline} && source:!=MLS`;
}

export function andTypesenseFilters(baseline: string, additional?: string): string {
  const callerFilter = additional?.trim();
  return callerFilter ? `(${baseline}) && (${callerFilter})` : baseline;
}

export function buildPublicPropertyTypesenseFilter(
  additional?: string,
  env: PropertyVisibilityEnvironment = process.env,
): string {
  return andTypesenseFilters(
    getPublicPropertyTypesenseBaselineFilter(env),
    additional,
  );
}
