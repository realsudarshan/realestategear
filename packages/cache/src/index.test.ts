import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockRedis = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  keys: vi.fn(),
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(function Redis() {
    return mockRedis;
  }),
}));

const { CacheManager } = await import('./index.js');

describe('CacheManager key generation', () => {
  const cache = new CacheManager();

  it('generatePropertiesKey sorts filters and drops empty values so equivalent filter sets share a cache key', () => {
    const keyA = cache.generatePropertiesKey({ city: 'Charlotte', beds: 3, agent: '' });
    const keyB = cache.generatePropertiesKey({ beds: 3, city: 'Charlotte', agent: undefined });
    expect(keyA).toBe(keyB);
    expect(keyA).toMatch(/^properties:/);
  });

  it('generatePropertiesKey returns the bare "properties" key when there are no filters', () => {
    expect(cache.generatePropertiesKey({})).toBe('properties');
  });

  it('generateSearchKey encodes the query alongside filters', () => {
    const key = cache.generateSearchKey('charlotte homes', { minPrice: 300000 });
    expect(key).toMatch(/^search:/);
    const decoded = JSON.parse(Buffer.from(key.slice('search:'.length), 'base64').toString());
    expect(decoded).toEqual({ query: 'charlotte homes', minPrice: 300000 });
  });
});

describe('CacheManager get/set/del — behavior when not connected', () => {
  let cache: InstanceType<typeof CacheManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new CacheManager();
  });

  it('get returns null without touching redis when the client never connected', async () => {
    const result = await cache.get('some-key');
    expect(result).toBeNull();
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('set returns false without touching redis when the client never connected', async () => {
    const result = await cache.set('some-key', { a: 1 });
    expect(result).toBe(false);
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });

  it('del returns false without touching redis when the client never connected', async () => {
    const result = await cache.del('some-key');
    expect(result).toBe(false);
    expect(mockRedis.del).not.toHaveBeenCalled();
  });
});

describe('CacheManager get/set — once connected', () => {
  let cache: InstanceType<typeof CacheManager>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRedis.connect.mockResolvedValue(undefined);
    cache = new CacheManager();
    await cache.connect();
    // The 'connect' event handler (which flips isConnected) is wired via
    // mockRedis.on — invoke it directly since our mock never actually fires.
    const connectHandler = mockRedis.on.mock.calls.find(([event]) => event === 'connect')?.[1];
    connectHandler?.();
  });

  it('set serializes the value as JSON and writes it with the given TTL', async () => {
    mockRedis.setex.mockResolvedValue('OK');
    const result = await cache.set('property:1', { address: '123 Main St' }, 600);
    expect(result).toBe(true);
    expect(mockRedis.setex).toHaveBeenCalledWith('property:1', 600, JSON.stringify({ address: '123 Main St' }));
  });

  it('get parses the stored JSON back into an object', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ address: '123 Main St' }));
    const result = await cache.get('property:1');
    expect(result).toEqual({ address: '123 Main St' });
  });

  it('get returns null for a cache miss', async () => {
    mockRedis.get.mockResolvedValue(null);
    const result = await cache.get('property:missing');
    expect(result).toBeNull();
  });

  it('get returns null instead of throwing when redis.get rejects', async () => {
    mockRedis.get.mockRejectedValue(new Error('ECONNRESET'));
    const result = await cache.get('property:1');
    expect(result).toBeNull();
  });

  it('get returns null instead of throwing when the stored value is not valid JSON', async () => {
    mockRedis.get.mockResolvedValue('{not-json');
    const result = await cache.get('property:1');
    expect(result).toBeNull();
  });

  it('set returns false instead of throwing when redis.setex rejects', async () => {
    mockRedis.setex.mockRejectedValue(new Error('ECONNRESET'));
    const result = await cache.set('property:1', { a: 1 });
    expect(result).toBe(false);
  });
});
