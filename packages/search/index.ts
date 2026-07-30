export { default as typesenseClient } from './typesenseClient.js';
export { SCHEMAS, ensureCollections } from './collections.js';
export { upsertDocument, deleteDocument, reindexAll, searchDocuments } from './syncService.js';
export { reconcilePropertyDocument } from './reconcilePropertyDocument.js';
export type { PropertyDocumentReconcileResult } from './reconcilePropertyDocument.js';
export { toPropertyDoc, toContactDoc, toTransactionDoc, toNoteDoc, toTaskDoc } from './transformers.js';
export { logger } from './logger.js';
export {
  isTypesenseConfigured,
  searchContactsPg,
  searchPropertiesPg,
  searchTasksPg,
  searchTransactionsPg,
} from './postgresFallback.js';
export { compileCollectionPredicate, evaluateCollectionPredicate, explainCollectionPredicate } from './collectionPredicate.js';
export {
  andTypesenseFilters,
  buildPublicListingWhere,
  buildPublicPropertyTypesenseFilter,
  getPublicPropertyTypesenseBaselineFilter,
  isMlsPublicDisplayEnabled,
} from './propertyVisibility.js';
export type { PropertyVisibilityEnvironment } from './propertyVisibility.js';
