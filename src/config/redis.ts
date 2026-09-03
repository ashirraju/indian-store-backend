import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

let redisClient: Redis | null = null;

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

  redisClient.on('connect', () => {
    console.log(`✅ Redis connected at ${REDIS_HOST}:${REDIS_PORT}`);
  });

  redisClient.on('error', (err) => {
    // Suppress unhandled crash errors if Redis temporarily goes down
    if (!err.message.includes('ECONNREFUSED')) {
      console.warn('⚠️ Redis error:', err.message);
    }
  });
} catch (err: any) {
  console.warn('⚠️ Redis initialization bypassed:', err.message);
  redisClient = null;
}

/**
 * Check if Redis is reachable on server startup
 */
export async function connectRedis(): Promise<boolean> {
  if (!redisClient) return false;
  try {
    const pong = await Promise.race([
      redisClient.ping(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export function getRedisClient(): Redis | null {
  return redisClient;
}
