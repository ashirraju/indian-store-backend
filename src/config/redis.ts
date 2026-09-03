import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

let redisClient: Redis | null = null;
let isRedisConnected = false;

try {
  redisClient = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    connectTimeout: 5000,
    maxRetriesPerRequest: 2,
    retryStrategy(times) {
      return Math.min(times * 200, 3000);
    },
  });

  redisClient.on('ready', () => {
    isRedisConnected = true;
  });

  redisClient.on('connect', () => {
    isRedisConnected = true;
  });

  redisClient.on('error', (err) => {
    if (isRedisConnected) {
      console.warn('⚠️ Redis error:', err.message);
    }
    isRedisConnected = false;
  });

  redisClient.on('close', () => {
    isRedisConnected = false;
  });
} catch (err: any) {
  console.warn('⚠️ Redis initialization bypassed:', err.message);
  redisClient = null;
  isRedisConnected = false;
}

/**
 * Wait for Redis readiness on server boot
 */
export async function connectRedis(): Promise<boolean> {
  if (!redisClient) return false;
  if (redisClient.status === 'ready') {
    isRedisConnected = true;
    return true;
  }

  return new Promise((resolve) => {
    if (!redisClient || redisClient.status === 'ready') {
      isRedisConnected = Boolean(redisClient && redisClient.status === 'ready');
      return resolve(isRedisConnected);
    }

    const onReady = () => {
      cleanup();
      isRedisConnected = true;
      resolve(true);
    };

    const onError = () => {
      cleanup();
      isRedisConnected = false;
      resolve(false);
    };

    const timer = setTimeout(() => {
      cleanup();
      isRedisConnected = Boolean(redisClient && redisClient.status === 'ready');
      resolve(isRedisConnected);
    }, 2000);

    function cleanup() {
      clearTimeout(timer);
      redisClient?.off('ready', onReady);
      redisClient?.off('error', onError);
    }

    redisClient.once('ready', onReady);
    redisClient.once('error', onError);
  });
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

export function isRedisAvailable(): boolean {
  return Boolean(redisClient && (isRedisConnected || redisClient.status === 'ready'));
}

/**
 * Fetch raw string data from Redis. Returns null if key doesn't exist or on any Redis failure.
 */
export async function getCache(key: string): Promise<string | null> {
  if (!isRedisAvailable() || !redisClient) return null;
  try {
    return await redisClient.get(key);
  } catch {
    return null;
  }
}

/**
 * Save string data to Redis with TTL in seconds. Fails gracefully if Redis is unavailable.
 */
export async function setCache(key: string, value: string, ttlSeconds: number = 60): Promise<void> {
  if (!isRedisAvailable() || !redisClient) return;
  try {
    await redisClient.setex(key, ttlSeconds, value);
  } catch {
    // Graceful fallback - continue without caching
  }
}

/**
 * Invalidate all keys matching a pattern (e.g., 'cache:api:/api/v1/products*')
 */
export async function clearCachePattern(pattern: string): Promise<void> {
  if (!isRedisAvailable() || !redisClient) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch {
    // Graceful fallback
  }
}
