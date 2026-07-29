import Typesense from 'typesense';

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
    // @ts-ignore — SDK types are incomplete; collection + filter_by are valid scoped key params
    { collection: 'properties', filter_by: 'status:=[Active,Pending]' },
  );
}

export function generateAgentSearchKey(accountId: string): string {
  // @ts-ignore
  return adminClient.keys().generateScopedSearchKey(
    process.env.TYPESENSE_API_KEY!,
    { filter_by: `accountId:=${accountId}` },
  );
}
