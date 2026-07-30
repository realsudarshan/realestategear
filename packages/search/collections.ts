import client from './typesenseClient.js';
import logger from './logger.js';

// Do NOT declare an `id` field here. Typesense manages the document `id`
// automatically (it's the reserved doc id) and silently drops a declared `id`,
// so a `{ name: 'id' }` field is never reported back by collections().retrieve().
// That made typesense-migrate see `id` as a permanently-missing non-optional
// field and refuse to run on every deploy. Indexed docs still carry their `id`
// (the doc id); search uses the explicit QUERY_BY map, never `id`.
export const SCHEMAS = [
  {
    name: 'properties',
    fields: [
      { name: 'address', type: 'string' },
      { name: 'city', type: 'string', facet: true },
      { name: 'state', type: 'string', facet: true },
      { name: 'zipCode', type: 'string', facet: true },
      { name: 'mlsId', type: 'string', optional: true },
      // Board scope for white-label portal filtering (Segment.mlsBoardId enforcement).
      { name: 'mlsBoardId', type: 'string', facet: true, optional: true },
      { name: 'propertyType', type: 'string', facet: true, optional: true },
      { name: 'subdivision', type: 'string', facet: true, optional: true },
      { name: 'status', type: 'string', facet: true, optional: true },
      { name: 'source', type: 'string', facet: true, optional: true },
      { name: 'idxDisplayable', type: 'bool', facet: true, optional: true },
      { name: 'price', type: 'float', facet: true, optional: true },
      { name: 'bedrooms', type: 'int32', facet: true, optional: true },
      { name: 'bathrooms', type: 'float', facet: true, optional: true },
      { name: 'squareFeet', type: 'int32', facet: true, optional: true },
      { name: 'description', type: 'string', optional: true },
      { name: 'location', type: 'geopoint', optional: true },
      { name: 'slug', type: 'string', optional: true },
      { name: 'imageUrl', type: 'string', optional: true },
      { name: 'listingDate', type: 'int64', optional: true },
      { name: 'assignedAgentId', type: 'string', optional: true },
      { name: 'createdAt', type: 'int64' },
    ],
    default_sorting_field: 'createdAt',
  },
  {
    name: 'contacts',
    fields: [
      { name: 'firstName', type: 'string' },
      { name: 'lastName', type: 'string' },
      { name: 'fullName', type: 'string' },
      { name: 'email', type: 'string', optional: true },
      { name: 'phone', type: 'string', optional: true },
      { name: 'company', type: 'string', optional: true },
      { name: 'type', type: 'string', facet: true },
      { name: 'stage', type: 'string', facet: true },
      { name: 'tags', type: 'string[]', facet: true, optional: true },
      { name: 'accountId', type: 'string', facet: true, optional: true },
      { name: 'createdAt', type: 'int64' },
    ],
    default_sorting_field: 'createdAt',
  },
  {
    name: 'transactions',
    fields: [
      { name: 'type', type: 'string', facet: true },
      { name: 'stage', type: 'string', facet: true },
      { name: 'address', type: 'string', optional: true },
      { name: 'mlsId', type: 'string', optional: true },
      { name: 'partyNames', type: 'string[]', optional: true },
      { name: 'listPrice', type: 'float', optional: true },
      { name: 'accountId', type: 'string', facet: true, optional: true },
      { name: 'assignedAgentId', type: 'string', facet: true, optional: true },
      { name: 'createdAt', type: 'int64' },
    ],
    default_sorting_field: 'createdAt',
  },
  {
    name: 'notes',
    fields: [
      { name: 'body', type: 'string' },
      { name: 'contactId', type: 'string', optional: true },
      { name: 'transactionId', type: 'string', optional: true },
      { name: 'eventId', type: 'string', facet: true, optional: true },
      { name: 'authorId', type: 'string' },
      { name: 'createdAt', type: 'int64' },
    ],
    default_sorting_field: 'createdAt',
  },
  {
    name: 'tasks',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string', optional: true },
      { name: 'status', type: 'string', facet: true },
      { name: 'priority', type: 'string', facet: true },
      { name: 'contactId', type: 'string', optional: true },
      { name: 'transactionId', type: 'string', optional: true },
      { name: 'assignedToId', type: 'string', facet: true, optional: true },
      { name: 'dueDate', type: 'int64', optional: true },
      { name: 'createdAt', type: 'int64' },
    ],
    default_sorting_field: 'createdAt',
  },
] as const;

export async function ensureCollections() {
  for (const schema of SCHEMAS) {
    try {
      await client.collections(schema.name).retrieve();
      logger.info(`Typesense collection exists: ${schema.name}`);
    } catch {
      await client.collections().create(schema as any);
      logger.info(`Typesense collection created: ${schema.name}`);
    }
  }
}
