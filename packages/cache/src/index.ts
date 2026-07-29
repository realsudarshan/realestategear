import { Redis, type RedisOptions } from 'ioredis';

type CacheValue = unknown;
type CacheFilters = Record<string, unknown>;
type TtlMap = {
  properties: number;
  property: number;
  search: number;
  stats: number;
  user: number;
  session: number;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function hasErrorCode(error: unknown, code: string) {
  return error instanceof Error && 'code' in error && error.code === code;
}

class CacheManager {
  private redisEnabled: boolean;
  private redis: Redis | null;
  private defaultTTL: TtlMap;
  private isConnected: boolean;
  private connectionRefused = false;

  constructor(options: RedisOptions = {}) {
    // Check if Redis should be enabled
    this.redisEnabled = process.env.REDIS_ENABLED !== 'false';

    if (this.redisEnabled) {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        db: Number(process.env.REDIS_DB || 0),
        connectTimeout: 2000,     // 2 second timeout
        lazyConnect: true,
        maxRetriesPerRequest: null, // Disable retries for faster failover
        ...options
      });
      this.setupEventHandlers();
    } else {
      console.log('Redis disabled via environment variable');
      this.redis = null;
    }

    // Default TTL values (in seconds)
    this.defaultTTL = {
      properties: 300,      // 5 minutes
      property: 600,        // 10 minutes
      search: 180,          // 3 minutes
      stats: 60,            // 1 minute
      user: 3600,           // 1 hour
      session: 86400        // 24 hours
    };

    this.isConnected = false;
  }

  setupEventHandlers() {
    if (!this.redis) return;

    this.redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
      this.isConnected = true;
    });

    this.redis.on('error', (err: Error) => {
      if (hasErrorCode(err, 'ECONNREFUSED')) {
        if (!this.connectionRefused) {
          console.warn('⚠️  Redis connection refused - continuing without cache');
          this.connectionRefused = true;
        }
      } else {
        console.error('Redis error:', err.message);
      }
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      if (this.isConnected) {
        console.log('Redis connection closed');
      }
      this.isConnected = false;
    });
  }

  async connect() {
    if (!this.redisEnabled || !this.redis) {
      console.log('📦 Cache: Operating without Redis (disabled)');
      return false;
    }

    try {
      await this.redis.connect();
      return true;
    } catch (error) {
      if (hasErrorCode(error, 'ECONNREFUSED')) {
        console.log('📦 Cache: Operating without Redis (not available)');
      } else {
        console.error('Failed to connect to Redis:', getErrorMessage(error));
      }
      return false;
    }
  }

  async disconnect() {
    if (this.redis && this.isConnected) {
      await this.redis.disconnect();
    }
  }

  // Generic cache operations
  async get<T = CacheValue>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.redis) return null;

    try {
      const value = await this.redis.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      console.error('Cache get error:', getErrorMessage(error));
      return null;
    }
  }

  async set(key: string, value: CacheValue, ttl = 300): Promise<boolean> {
    if (!this.isConnected || !this.redis) return false;

    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error('Cache set error:', getErrorMessage(error));
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected || !this.redis) return false;

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', getErrorMessage(error));
      return false;
    }
  }

  async exists(key: string): Promise<number | false> {
    if (!this.isConnected || !this.redis) return false;

    try {
      return await this.redis.exists(key);
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  // Pattern-based deletion
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isConnected || !this.redis) return 0;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error('Cache pattern delete error:', error);
      return 0;
    }
  }

  // Property-specific cache methods
  async getProperties<T = CacheValue>(filters: CacheFilters = {}) {
    const key = this.generatePropertiesKey(filters);
    return await this.get<T>(key);
  }

  async setProperties(filters: CacheFilters = {}, data: CacheValue) {
    const key = this.generatePropertiesKey(filters);
    return await this.set(key, data, this.defaultTTL.properties);
  }

  async getProperty<T = CacheValue>(id: string) {
    const key = `property:${id}`;
    return await this.get<T>(key);
  }

  async setProperty(id: string, data: CacheValue) {
    const key = `property:${id}`;
    return await this.set(key, data, this.defaultTTL.property);
  }

  async invalidateProperty(id: string) {
    // Delete specific property
    await this.del(`property:${id}`);

          // Delete all property data (since they might include this property)
    await this.deletePattern('properties:*');

    // Delete admin stats
    await this.deletePattern('admin:stats*');
  }

  // Search cache methods
  async getSearch<T = CacheValue>(query: string, filters: CacheFilters = {}) {
    const key = this.generateSearchKey(query, filters);
    return await this.get<T>(key);
  }

  async setSearch(query: string, filters: CacheFilters = {}, results: CacheValue) {
    const key = this.generateSearchKey(query, filters);
    return await this.set(key, results, this.defaultTTL.search);
  }

  // Admin stats cache
  async getAdminStats<T = CacheValue>() {
    return await this.get<T>('admin:stats');
  }

  async setAdminStats(stats: CacheValue) {
    return await this.set('admin:stats', stats, this.defaultTTL.stats);
  }

  // User cache methods
  async getUser<T = CacheValue>(id: string) {
    const key = `user:${id}`;
    return await this.get<T>(key);
  }

  async setUser(id: string, userData: CacheValue) {
    const key = `user:${id}`;
    return await this.set(key, userData, this.defaultTTL.user);
  }

  async invalidateUser(id: string) {
    await this.del(`user:${id}`);
  }

  // Session management
  async getSession<T = CacheValue>(sessionId: string) {
    const key = `session:${sessionId}`;
    return await this.get<T>(key);
  }

  async setSession(sessionId: string, sessionData: CacheValue) {
    const key = `session:${sessionId}`;
    return await this.set(key, sessionData, this.defaultTTL.session);
  }

  async deleteSession(sessionId: string) {
    const key = `session:${sessionId}`;
    return await this.del(key);
  }

  // Helper methods for key generation
  generatePropertiesKey(filters: CacheFilters) {
    const sortedFilters = Object.keys(filters).sort().reduce<CacheFilters>((result, key) => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        result[key] = filters[key];
      }
      return result;
    }, {});

    const filterString = Object.keys(sortedFilters).length > 0
      ? ':' + Buffer.from(JSON.stringify(sortedFilters)).toString('base64')
      : '';

    return `properties${filterString}`;
  }

  generateSearchKey(query: string, filters: CacheFilters) {
    const searchParams = { query, ...filters };
    const paramString = Buffer.from(JSON.stringify(searchParams)).toString('base64');
    return `search:${paramString}`;
  }

  // Cache statistics
  async getStats() {
    if (!this.isConnected || !this.redis) return { connected: false };

    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');

      return {
        connected: this.isConnected,
        memory: info,
        keyspace: keyspace,
        totalKeys: await this.redis.dbsize()
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { connected: false, error: getErrorMessage(error) };
    }
  }

  // Health check
  async healthCheck() {
    if (!this.isConnected || !this.redis) return false;

    try {
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch (error) {
      return false;
    }
  }

  // Bulk operations
  async mget<T = CacheValue>(keys: string[]): Promise<Array<T | null>> {
    if (!this.isConnected || !this.redis) return new Array(keys.length).fill(null);

    try {
      const values = await this.redis.mget(keys);
      return values.map(value => value ? (JSON.parse(value) as T) : null);
    } catch (error) {
      console.error('Cache mget error:', error);
      return new Array(keys.length).fill(null);
    }
  }

  async mset(keyValuePairs: Array<[string, CacheValue]>, ttl = 300): Promise<boolean> {
    if (!this.isConnected || !this.redis) return false;

    try {
      const pipeline = this.redis.pipeline();

      for (const [key, value] of keyValuePairs) {
        const serialized = JSON.stringify(value);
        pipeline.setex(key, ttl, serialized);
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

export default cacheManager;
export { CacheManager };
