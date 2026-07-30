import Typesense from 'typesense';
import { buildPublicPropertyTypesenseFilter } from 'search/propertyVisibility';

const SEARCH_KEY_TTL_SECONDS = 60 * 60;

// Keys are generated from the admin key — this client is only used for key generation
const adminClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || 'localhost',
      port: parseInt(process.env.TYPESENSE_PORT || '8108'),
      protocol: process.env.TYPESENSE_PROTOCOL || 'http',
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY || '',
  connectionTimeoutSeconds: 5,
});

export function generateWebSearchKey(): string {
  return adminClient.keys().generateScopedSearchKey(
    process.env.TYPESENSE_API_KEY!,
    {
      // @ts-expect-error - Typesense supports collection-scoped keys but omits it from this SDK type.
      collection: 'properties',
      filter_by: buildPublicPropertyTypesenseFilter(),
      expires_at: Math.floor(Date.now() / 1000) + SEARCH_KEY_TTL_SECONDS,
    },
  );
}

export function generateAgentSearchKey(accountId: string): string {
  // @ts-ignore
  return adminClient.keys().generateScopedSearchKey(
    process.env.TYPESENSE_API_KEY!,
    {
      filter_by: `(accountId:=${accountId}) || (${buildPublicPropertyTypesenseFilter()})`,
      expires_at: Math.floor(Date.now() / 1000) + SEARCH_KEY_TTL_SECONDS,
    },
  );
}
