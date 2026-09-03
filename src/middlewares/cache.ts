import { Request, Response, NextFunction } from 'express';
import { getCache, setCache, clearCachePattern, isRedisAvailable } from '../config/redis.js';

/**
 * Express middleware to transparently cache GET responses in Redis.
 *
 * @param ttlSeconds Duration to cache the response (default: 60 seconds)
 * @param prefix Redis key prefix (default: 'cache:api')
 */
export function cacheResponse(ttlSeconds: number = 60, prefix: string = 'cache:api') {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests and skip when Redis is unavailable
    if (req.method !== 'GET' || !isRedisAvailable()) {
      res.setHeader('X-Cache', 'BYPASS');
      return next();
    }

    // Key format: cache:api:/api/v1/products?page=1&limit=12
    const cacheKey = `${prefix}:${req.originalUrl}`;

    try {
      const cached = await getCache(cacheKey);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(200).send(cached);
      }
    } catch {
      // Graceful bypass on cache read error
    }

    res.setHeader('X-Cache', 'MISS');

    // Intercept res.json to capture and save the response payload
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      // Only cache 2xx successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const payloadString = JSON.stringify(body);
          setCache(cacheKey, payloadString, ttlSeconds).catch(() => {});
        } catch {
          // Ignore serialization errors
        }
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate product catalog and storefront cache
 */
export async function invalidateProductsCache(): Promise<void> {
  await Promise.all([
    clearCachePattern('cache:api:/api/v1/products*'),
    clearCachePattern('cache:api:/api/v1/storefront*'),
  ]);
}

/**
 * Invalidate categories, products, and storefront cache
 */
export async function invalidateCategoriesCache(): Promise<void> {
  await Promise.all([
    clearCachePattern('cache:api:/api/v1/categories*'),
    clearCachePattern('cache:api:/api/v1/products*'),
    clearCachePattern('cache:api:/api/v1/storefront*'),
  ]);
}

/**
 * Invalidate promotional banners and storefront config cache
 */
export async function invalidateStorefrontCache(): Promise<void> {
  await Promise.all([
    clearCachePattern('cache:api:/api/v1/storefront*'),
    clearCachePattern('cache:api:/api/v1/banners*'),
  ]);
}

/**
 * Express middleware to automatically trigger an invalidation callback when any
 * mutation (POST/PUT/PATCH/DELETE) succeeds with a 2xx HTTP response.
 */
export function invalidateOnMutation(invalidator: () => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          invalidator().catch(() => {});
        }
      });
    }
    next();
  };
}
