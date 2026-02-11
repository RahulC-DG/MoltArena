import { FastifyRequest, FastifyReply } from 'fastify';
import { Agent } from '@prisma/client';
import { extractApiKey } from '../utils/apiKey';
import { findAgentByApiKey } from '../services/auth.service';

// Extend Fastify request to include authenticated agent
declare module 'fastify' {
  interface FastifyRequest {
    agent?: Agent;
  }
}

/**
 * Authentication middleware for protected routes
 * Validates Bearer token and attaches agent to request
 *
 * Security:
 * - Extracts API key from Authorization header
 * - Verifies key using bcrypt (timing-safe)
 * - Rejects invalid/missing tokens with 401
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing Authorization header',
        },
      });
    }

    const apiKey = extractApiKey(authHeader);

    if (!apiKey) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid API key format. Expected: Bearer moltarena_sk_...',
        },
      });
    }

    // Find agent by API key (uses bcrypt verification with timing-safe comparison)
    const agent = await findAgentByApiKey(apiKey, request.log);

    if (!agent) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid API key',
        },
      });
    }

    if (!agent.isActive) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Agent account is disabled',
        },
      });
    }

    // Attach agent to request for use in route handlers
    request.agent = agent;
  } catch (error) {
    request.log.error('Authentication error:', error);
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed',
      },
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches agent if valid token provided, but doesn't require it
 * Useful for endpoints that work for both authenticated and anonymous users
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const apiKey = extractApiKey(request.headers.authorization);

    if (apiKey) {
      const agent = await findAgentByApiKey(apiKey, request.log);
      if (agent && agent.isActive) {
        request.agent = agent;
      }
    }
  } catch (error) {
    // Silent fail for optional auth - just don't attach agent
    request.log.warn('Optional auth failed:', error);
  }
}
