export type PortalListingMode = 'hidden' | 'mock' | 'db';
export type PublicListingDisplay = 'hidden' | 'mock' | 'real';

export interface PortalThemeConfig {
  primary?: string;
  logoUrl?: string;
  preset?: string;
}

export interface PortalListingPolicy {
  mode: PortalListingMode;
  boardIds: string[];
  collectionSlugs?: string[];
  allowMockInProduction?: boolean;
}

export type NullSemantics = 'exclude' | 'include' | 'only';
export interface NumericPredicate {
  min?: number;
  max?: number;
  nulls: NullSemantics;
}

// Values inside each field are ORed. Different fields are ANDed. tagsAll is
// the only all-of group; excludes always veto a predicate match.
export interface CollectionPredicate {
  areaSlugs?: string[];
  tagsAny?: string[];
  tagsAll?: string[];
  tagsExclude?: string[];
  propertyTypes?: string[];
  price?: NumericPredicate;
  beds?: NumericPredicate;
  baths?: NumericPredicate;
  sqft?: NumericPredicate;
  lotSize?: NumericPredicate;
  yearBuilt?: NumericPredicate;
}

export type AttributeMapping = Record<string, string[]>;
export type FieldCondition =
  | { field: string; operator: 'equals'; value: string | number | boolean }
  | { field: string; operator: 'exists' }
  | { field: string; operator: 'includesAny'; values: Array<string | number | boolean> };
export type ClassifierExpression =
  | { kind: 'fields'; all: FieldCondition[] }
  | { kind: 'place'; cities?: string[]; zipCodes?: string[]; subdivisions?: string[] }
  | { kind: 'radius'; latitude: number; longitude: number; miles: number }
  | { kind: 'polygon'; coordinates: Array<[number, number]> }
  | { kind: 'composite'; operator: 'all' | 'any'; definitions: ClassifierExpression[] };

export interface ClassificationDefinition {
  slug: string;
  label: string;
  classifier: ClassifierExpression;
  confidence?: number;
}

export interface InitialArea {
  slug: string;
  name: string;
  description?: string;
  definition: ClassifierExpression;
}

export interface InitialCollection {
  slug: string;
  name: string;
  description?: string;
  predicate: CollectionPredicate;
}

export interface PortalClassificationConfig {
  version: string;
  providerAttributeMappings: Record<string, AttributeMapping>;
  definitions: ClassificationDefinition[];
  advancedClassifiers: Record<string, ClassifierExpression>;
  initialAreas: InitialArea[];
  initialCollections: InitialCollection[];
}

export interface PortalFeatureFlags {
  search: boolean;
  map: boolean;
  inquiryForm: boolean;
  savedSearch: boolean;
}

export interface PortalComplianceConfig {
  idxApproved: boolean;
  brokerageName: string;
  brokeragePhone: string;
  publicListingDisplay: PublicListingDisplay;
}

export interface PortalConfig {
  slug: string;
  name: string;
  domains: string[];
  theme: PortalThemeConfig;
  listings: PortalListingPolicy;
  features: PortalFeatureFlags;
  compliance: PortalComplianceConfig;
  classification: PortalClassificationConfig;
}

export interface ResolveOptions {
  environment?: 'local' | 'preview' | 'staging' | 'production';
  listingModeOverride?: PortalListingMode;
}

// Same shape as PortalConfig, after environment-based safety guards (e.g.
// forcing 'mock' listings to 'hidden' outside local/preview) have been applied.
export type ResolvedPortalConfig = PortalConfig;

export interface PublicPortalConfig {
  slug: string;
  name: string;
  domains: string[];
  theme: PortalThemeConfig;
  listings: Omit<PortalListingPolicy, 'allowMockInProduction'>;
  features: PortalFeatureFlags;
  compliance: PortalComplianceConfig;
}

// ─────────────── MLS board compliance policy ───────────────

export interface ListingSurfacePolicy {
  attributionRequired: boolean;
  requiresListingBrokerage?: boolean;
  requiresMlsId?: boolean;
  requiresMlsBoardName?: boolean;
  requiresLastUpdatedAt?: boolean;
  disclaimerRequired?: boolean;
}

export interface MlsBoardPolicy {
  boardId: string;
  displayName: string;
  surfaces: {
    portalListingCard: ListingSurfacePolicy;
    portalListingGrid: ListingSurfacePolicy;
    listingDetail: ListingSurfacePolicy;
    portalFooter: ListingSurfacePolicy;
  };
}
