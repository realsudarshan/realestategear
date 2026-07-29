import Typesense from 'typesense';

// Lazy-initialize so dotenv has already run before the client is created.
// (ESM hoists imports before the dotenv.config() calls in the host app execute.)
let _client: InstanceType<typeof Typesense.Client> | null = null;

function getClient(): InstanceType<typeof Typesense.Client> {
  if (!_client) {
    _client = new Typesense.Client({
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
  }
  return _client;
}

const client = new Proxy({} as InstanceType<typeof Typesense.Client>, {
  get(_target, prop) {
    return getClient()[prop as keyof InstanceType<typeof Typesense.Client>];
  },
}) as InstanceType<typeof Typesense.Client>;

export default client;
