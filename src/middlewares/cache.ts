import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis.js';

/**
 * Express middleware to transparently cache GET responses in Redis with a 200ms timeout guard.
 *
 * @param ttlSeconds Duration to cache the response (default: 60 seconds)
 * @param prefix Redis key prefix (default: 'cache:api')
 */
export function cacheResponse(ttlSeconds: number = 60, prefix: string = 'cache:api') {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      res.setHeader('X-Cache', 'BYPASS');
      return next();
    }

    const client = getRedisClient();
    if (!client) {
      res.setHeader('X-Cache', 'BYPASS');
      return next();
    }

    // Key format: cache:api:/api/v1/products?page=1&limit=12
    const cacheKey = `${prefix}:${req.originalUrl}`;

    try {
      // Query Redis with a fast 250ms timeout guard so slow redis never blocks API requests
      const cached = await Promise.race([
        client.get(cacheKey),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Redis timeout')), 250)
        ),
      ]);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(200).send(cached);
      }
    } catch {
      // Graceful fallback to database on timeout or disconnection
      res.setHeader('X-Cache', 'BYPASS');
      return next();
    }

    res.setHeader('X-Cache', 'MISS');

    // Intercept res.json to capture and save the response payload
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      // Only cache 2xx successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const payloadString = JSON.stringify(body);
          client.setex(cacheKey, ttlSeconds, payloadString).catch(() => {});
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
  const client = getRedisClient();
  if (!client) return;
  try {
    const keys = await client.keys('cache:api:/api/v1/products*');
    const sfKeys = await client.keys('cache:api:/api/v1/storefront*');
    const all = [...keys, ...sfKeys];
    if (all.length > 0) await client.del(...all);
  } catch {}
}

/**
 * Invalidate categories, products, and storefront cache
 */
export async function invalidateCategoriesCache(): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  try {
    const keys = await client.keys('cache:api:/api/v1/categories*');
    const pKeys = await client.keys('cache:api:/api/v1/products*');
    const sfKeys = await client.keys('cache:api:/api/v1/storefront*');
    const all = [...keys, ...pKeys, ...sfKeys];
    if (all.length > 0) await client.del(...all);
  } catch {}
}

/**
 * Invalidate promotional banners and storefront config cache
 */
export async function invalidateStorefrontCache(): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  try {
    const keys = await client.keys('cache:api:/api/v1/storefront*');
    const bKeys = await client.keys('cache:api:/api/v1/banners*');
    const all = [...keys, ...bKeys];
    if (all.length > 0) await client.del(...all);
  } catch {}
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
