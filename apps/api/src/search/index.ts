// Shared Typesense primitives now live in the `search` workspace package
// (imported by both apps/api and apps/mls-service). This barrel keeps apps/api's
// existing import surface stable and adds the api-only key helpers.
export {
  typesenseClient,
  ensureCollections,
  upsertDocument,
  deleteDocument,
  reconcilePropertyDocument,
  reindexAll,
  searchDocuments,
  toPropertyDoc,
  toContactDoc,
  toTransactionDoc,
  toNoteDoc,
  toTaskDoc,
  isTypesenseConfigured,
  searchContactsPg,
  searchPropertiesPg,
  searchTasksPg,
  searchTransactionsPg,
} from 'search';
export { generateWebSearchKey, generateAgentSearchKey } from './keys.js';
