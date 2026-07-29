import type { Request, RequestHandler, Response } from 'express';
import cacheManager from 'cache';
import logger from '../utils/logger.js';

type CacheKeyGenerator = (req: Request) => string;
type CacheSkipPredicate = (req: Request, res: Response) => boolean;
type CacheOptions = {
  ttl?: number;
  keyGenerator?: CacheKeyGenerator;
  skipCache?: CacheSkipPredicate;
  skipCacheCondition?: CacheSkipPredicate | null;
};
type InvalidationPattern = string | ((req: Request, res: Response) => string | null | undefined);

function toRecord(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}

// Cache middleware factory
export const cache = (options: CacheOptions = {}): RequestHandler => {
  const {
    ttl = 300,                    // Default 5 minutes
    keyGenerator = defaultKeyGenerator,
    skipCache = () => false,
    skipCacheCondition = null
  } = options;

  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching based on custom condition
    if (skipCache(req, res) || (skipCacheCondition && skipCacheCondition(req, res))) {
      return next();
    }

    const cacheKey = keyGenerator(req);

    try {
      // Try to get from cache
      const cachedData = await cacheManager.get(cacheKey);

      if (cachedData) {
        logger.debug(`Cache hit for key: ${cacheKey}`);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        return res.json(cachedData);
      }

      // Cache miss - intercept response
      logger.debug(`Cache miss for key: ${cacheKey}`);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache the response
      res.json = function(data: unknown) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheManager.set(cacheKey, data, ttl).catch(error => {
            logger.error('Failed to cache response:', { error });
          });
        }

        return originalJson(data);
      };

      next();

    } catch (error) {
      logger.error('Cache middleware error:', { error });
      // Continue without caching on error
      next();
    }
  };
};

// Default key generator
function defaultKeyGenerator(req: Request) {
  const { method, originalUrl, query } = req;
  const userId = req.user?.id || 'anonymous';

  // Sort query parameters for consistent keys
  const sortedQuery = Object.keys(query).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = query[key];
    return result;
  }, {});

  const queryString = Object.keys(sortedQuery).length > 0
    ? JSON.stringify(sortedQuery)
    : '';

  return `${method}:${originalUrl}:${userId}:${queryString}`;
}

// Property-specific cache middleware
export const cacheProperties = cache({
  ttl: 300, // 5 minutes
  keyGenerator: (req) => {
    const filters = toRecord(req.query);
    return cacheManager.generatePropertiesKey(filters);
  }
});

// Individual property cache middleware
export const cacheProperty = cache({
  ttl: 600, // 10 minutes
  keyGenerator: (req) => `property:${req.params.id}`
});

// Admin stats cache middleware
export const cacheAdminStats = cache({
  ttl: 60, // 1 minute
  keyGenerator: () => 'admin:stats'
});

// Search cache middleware
export const cacheSearch = cache({
  ttl: 180, // 3 minutes
  keyGenerator: (req) => {
    const { q: query, ...filters } = req.query;
    return cacheManager.generateSearchKey(String(query || ''), toRecord(filters));
  }
});

// Cache invalidation middleware
export const invalidateCache = (patterns: InvalidationPattern[] = []): RequestHandler => {
  return async (req, res, next) => {
    // Store original methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    const invalidatePatterns = async () => {
      try {
        for (const pattern of patterns) {
          const resolvedPattern = typeof pattern === 'function'
            ? pattern(req, res)
            : pattern;

          if (resolvedPattern) {
            const deletedCount = await cacheManager.deletePattern(resolvedPattern);
            logger.debug(`Invalidated ${deletedCount} cache entries for pattern: ${resolvedPattern}`);
          }
        }
      } catch (error) {
        logger.error('Cache invalidation error:', { error });
      }
    };

    // Override response methods to invalidate cache after successful operations
    res.json = function(data: unknown) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        invalidatePatterns();
      }
      return originalJson(data);
    };

    res.send = function(data: unknown) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        invalidatePatterns();
      }
      return originalSend(data);
    };

    next();
  };
};

// Specific invalidation patterns
export const invalidatePropertyCache = invalidateCache([
  'properties:*',
  'admin:stats*',
  (req) => req.params.id ? `property:${req.params.id}` : null
]);

export const invalidateUserCache = invalidateCache([
  (req) => req.params.id ? `user:${req.params.id}` : null
]);

export const invalidateAdminCache = invalidateCache([
  'admin:*',
  'properties:*'
]);
