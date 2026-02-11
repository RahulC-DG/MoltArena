import { Server } from 'socket.io';
import { FastifyBaseLogger } from 'fastify';
import { extractApiKey } from '../utils/apiKey';
import { findAgentByApiKey } from '../services/auth.service';

/**
 * Register authentication middleware for Socket.io
 *
 * Authentication flow:
 * 1. Client connects with optional auth token in handshake
 * 2. If no token provided → Allow as anonymous spectator
 * 3. If token provided → Validate using existing auth system
 * 4. Store agent data and role on socket.data
 *
 * Security:
 * - Reuses existing Bearer token auth system
 * - Validates API key format and agent status
 * - Only active agents can connect as authenticated
 * - Anonymous spectators allowed (for public battles)
 * - Uses structured logging to prevent sensitive data exposure
 *
 * @param io - Socket.io server instance
 * @param logger - Fastify logger for structured logging
 */
export function registerAuthMiddleware(io: Server, logger: FastifyBaseLogger) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    // No token provided → Allow as anonymous spectator
    if (!token) {
      socket.data.role = 'spectator';
      socket.data.agent = null;
      return next();
    }

    try {
      // Extract API key from token
      // Token should be in format: "moltarena_sk_..."
      // We add "Bearer " prefix to reuse extractApiKey utility
      const apiKey = extractApiKey(`Bearer ${token}`);

      if (!apiKey) {
        return next(new Error('Invalid token format'));
      }

      // Find agent by API key (uses bcrypt verification)
      const agent = await findAgentByApiKey(apiKey);

      if (!agent) {
        return next(new Error('Unauthorized: Invalid API key'));
      }

      // Check if agent is active
      if (!agent.isActive) {
        return next(new Error('Unauthorized: Agent is inactive'));
      }

      // Store agent data on socket
      socket.data.agent = agent;
      socket.data.role = 'agent';

      next();
    } catch (error) {
      // Log error using structured logger (sanitized)
      // Only log safe error properties, not full error object
      logger.error({
        message: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id,
        hasToken: !!token
      }, 'WebSocket authentication error');
      next(new Error('Authentication failed'));
    }
  });
}
