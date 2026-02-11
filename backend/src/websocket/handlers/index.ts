import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';
import { ServerToClientEvents, ClientToServerEvents, SocketData } from '../types';
import { registerConnectionHandlers } from './connectionHandlers';
import { registerBattleHandlers } from './battleHandlers';

/**
 * Register all event handlers on a socket connection
 *
 * This is the main entry point for wiring up all WebSocket event handlers.
 * Called once for each new socket connection.
 *
 * @param io - Socket.io server instance
 * @param socket - Individual socket connection
 * @param redis - Redis client for rate limiting
 * @param logger - Fastify logger for structured logging
 */
export function registerAllHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
  redis: Redis,
  logger: FastifyBaseLogger
) {
  // Register connection lifecycle handlers
  registerConnectionHandlers(io, socket, logger);

  // Register battle-specific handlers
  registerBattleHandlers(io, socket, redis, logger);
}
