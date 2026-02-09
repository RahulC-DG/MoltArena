import { FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  db: process.env.NODE_ENV === 'test' ? 15 : 0,
});

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Redis key prefix
}

/**
 * Rate limiting middleware using Redis
 * Tracks requests per API key or IP address
 *
 * Security: Prevents abuse and DoS attacks
 */
export function rateLimit(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyPrefix = 'ratelimit' } = config;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      // Use API key if authenticated, otherwise use IP address
      const identifier = request.agent?.id || request.ip;
      const key = `${keyPrefix}:${identifier}`;

      // Get current request count
      const current = await redis.get(key);
      const requestCount = current ? parseInt(current, 10) : 0;

      if (requestCount >= maxRequests) {
        // Rate limit exceeded
        const ttl = await redis.ttl(key);
        const retryAfter = ttl > 0 ? ttl : Math.ceil(windowMs / 1000);

        reply.header('X-RateLimit-Limit', maxRequests);
        reply.header('X-RateLimit-Remaining', 0);
        reply.header('X-RateLimit-Reset', Date.now() + retryAfter * 1000);
        reply.header('Retry-After', retryAfter);

        return reply.status(429).send({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            details: {
              retryAfter,
            },
          },
        });
      }

      // Atomic increment with expiry
      if (requestCount === 0) {
        // First request: set initial count with expiry
        await redis.set(key, '1', 'PX', windowMs);
      } else {
        // Subsequent requests: just increment (expiry already set)
        await redis.incr(key);
      }

      // Add rate limit headers
      const newCount = requestCount + 1;
      reply.header('X-RateLimit-Limit', maxRequests);
      reply.header('X-RateLimit-Remaining', Math.max(0, maxRequests - newCount));
      reply.header('X-RateLimit-Reset', Date.now() + windowMs);
    } catch (error) {
      // Log error but don't block request on Redis failure
      request.log.error('Rate limit error:', error);
    }
  };
}

/**
 * Standard rate limit for authenticated API requests
 * 100 requests per minute per API key
 */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyPrefix: 'api',
});

/**
 * Stricter rate limit for registration endpoint
 * 5 registrations per hour per IP
 */
export const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  keyPrefix: 'register',
});
