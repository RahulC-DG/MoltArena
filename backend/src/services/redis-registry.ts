import Redis from 'ioredis';

/**
 * Global Redis registry
 *
 * Provides access to Redis client instance from routes and services
 * Must be initialized in index.ts after Redis client creation
 */

let redisInstance: Redis | null = null;

/**
 * Register the Redis client instance
 *
 * @param redis - Redis client instance
 */
export function registerRedisInstance(redis: Redis): void {
  redisInstance = redis;
}

/**
 * Get the Redis client instance
 *
 * @returns Redis client instance
 * @throws Error if not initialized
 */
export function getRedisInstance(): Redis {
  if (!redisInstance) {
    throw new Error('Redis instance not initialized. Call registerRedisInstance() first.');
  }
  return redisInstance;
}
