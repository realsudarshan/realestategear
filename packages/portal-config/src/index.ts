import { portalConfig } from './portal.config.js';
import { PortalConfigError } from './errors.js';
import { getMlsBoardPolicy } from './mlsBoardPolicy.js';
import type { PortalConfig, PortalListingMode, PublicPortalConfig, ResolveOptions, ResolvedPortalConfig } from './types.js';
import { classifierExpressionSchema, collectionPredicateSchema } from './classification.js';

export type {
  ListingSurfacePolicy,
  MlsBoardPolicy,
  PortalComplianceConfig,
  PortalConfig,
  PortalFeatureFlags,
  PortalListingMode,
  PortalListingPolicy,
  PortalThemeConfig,
  PublicListingDisplay,
  PublicPortalConfig,
  ResolveOptions,
  ResolvedPortalConfig,
} from './types.js';
export type { AttributeMapping, ClassificationDefinition, ClassifierExpression, CollectionPredicate, InitialArea, InitialCollection, NullSemantics, NumericPredicate, PortalClassificationConfig } from './types.js';
export { classificationConfigHash, classifierExpressionSchema, collectionPredicateSchema, evaluateClassifier, parseCollectionPredicate } from './classification.js';

export { PortalConfigError };
export { MLS_BOARD_POLICIES, getMlsBoardPolicy } from './mlsBoardPolicy.js';

const VALID_LISTING_MODES = new Set<PortalListingMode>(['hidden', 'mock', 'db']);

function validateConfig(config: PortalConfig): void {
  if (!config.slug) throw new PortalConfigError('Portal config slug is required.');
  if (!config.name) throw new PortalConfigError(`Portal ${config.slug} name is required.`);
  if (!Array.isArray(config.domains)) throw new PortalConfigError(`Portal ${config.slug} domains must be an array.`);
  if (!VALID_LISTING_MODES.has(config.listings.mode)) throw new PortalConfigError(`Portal ${config.slug} has invalid listing mode.`);
  if (!Array.isArray(config.listings.boardIds)) throw new PortalConfigError(`Portal ${config.slug} boardIds must be an array.`);
  if (!config.classification?.version) throw new PortalConfigError(`Portal ${config.slug} classification version is required.`);
  const slugs = [...config.classification.definitions.map((item) => item.slug), ...config.classification.initialAreas.map((item) => item.slug), ...config.classification.initialCollections.map((item) => item.slug)];
  if (slugs.some((value) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))) throw new PortalConfigError(`Portal ${config.slug} classification slugs must be stable lowercase slugs.`);
  if (new Set(config.classification.definitions.map((item) => item.slug)).size !== config.classification.definitions.length) throw new PortalConfigError(`Portal ${config.slug} has duplicate classification slugs.`);
  for (const item of config.classification.definitions) classifierExpressionSchema.parse(item.classifier);
  for (const item of config.classification.initialAreas) classifierExpressionSchema.parse(item.definition);
  for (const item of config.classification.initialCollections) collectionPredicateSchema.parse(item.predicate);
  if (!config.compliance.brokerageName || !config.compliance.brokeragePhone) {
    throw new PortalConfigError(`Portal ${config.slug} compliance brokerage fields are required.`);
  }
  // Every board this portal shows listings for must have a registered compliance
  // policy (attribution/disclaimer rules) — checked at config-load time so a
  // self-hoster who points boardIds at their own board and forgets to add a
  // policy entry finds out at boot, not by reactively discovering a cosmetic
  // null somewhere. getMlsBoardPolicy itself intentionally throws for an
  // unregistered board; this just surfaces that as early as possible.
  for (const boardId of config.listings.boardIds) {
    getMlsBoardPolicy(boardId);
  }
}
export const validatePortalConfig = validateConfig;

function environmentFromNodeEnv(): ResolveOptions['environment'] {
  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview' || process.env.RAILWAY_ENVIRONMENT_NAME === 'preview') return 'preview';
  return 'local';
}

function applyResolution(config: PortalConfig, options: ResolveOptions = {}): ResolvedPortalConfig {
  validateConfig(config);
  const environment = options.environment ?? environmentFromNodeEnv();
  const requestedMode = options.listingModeOverride ?? process.env.REALESTATEGEAR_PORTAL_LISTING_MODE as PortalListingMode | undefined;
  const mode = requestedMode && VALID_LISTING_MODES.has(requestedMode) ? requestedMode : config.listings.mode;

  // Standalone migration note: this guard is intentionally deterministic and
  // JSON-serializable so a future Railway config service can return the same DTO.
  const safeMode = environment === 'production' && mode === 'mock' && !config.listings.allowMockInProduction
    ? 'hidden'
    : mode;

  return {
    ...config,
    listings: { ...config.listings, mode: safeMode },
    compliance: {
      ...config.compliance,
      publicListingDisplay: safeMode === 'db' ? 'real' : safeMode,
    },
  };
}

// There is exactly one portal per deployment — no registry to search, no
// slug/host lookup. Every deployment's config is this file's export.
export function getPortalConfig(options: ResolveOptions = {}): ResolvedPortalConfig {
  return applyResolution(portalConfig, options);
}

export function getPortalListingPolicy(options: ResolveOptions = {}) {
  return getPortalConfig(options).listings;
}

export function toPublicPortalConfig(config: ResolvedPortalConfig): PublicPortalConfig {
  const { allowMockInProduction: _allowMockInProduction, ...listings } = config.listings;
  return {
    slug: config.slug,
    name: config.name,
    domains: config.domains,
    theme: config.theme,
    listings,
    features: config.features,
    compliance: config.compliance,
  };
}
