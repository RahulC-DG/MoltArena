import { Server as SocketIOServer } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

/**
 * Initialize Socket.io server attached to Fastify
 *
 * Features:
 * - Integrates with Fastify HTTP server
 * - Redis adapter for horizontal scaling
 * - CORS configuration for frontend
 * - WebSocket and polling transports
 *
 * Security: Throws on Redis connection failure to prevent degraded state
 *
 * @param fastify - Fastify instance
 * @param redis - Redis client instance
 * @returns Configured Socket.io server
 */
export async function initializeSocketServer(
  fastify: FastifyInstance,
  redis: Redis
): Promise<SocketIOServer> {
  // Create Socket.io server attached to Fastify
  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'],
    path: '/socket.io/',
    // Connection settings
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    connectTimeout: 45000, // 45 seconds
    // Allow binary data (for future TTS integration)
    allowEIO3: true
  });

  // Redis adapter for horizontal scaling
  // Allows multiple server instances to share Socket.io state
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();

  // Initialize Redis adapter with fail-fast behavior
  try {
    await pubClient.connect();
    fastify.log.info('Socket.io Redis pub client connected');
  } catch (error) {
    fastify.log.error({ error }, 'Failed to connect Redis pub client');
    throw new Error('Redis pub client connection failed - cannot start Socket.io');
  }

  try {
    await subClient.connect();
    fastify.log.info('Socket.io Redis sub client connected');
  } catch (error) {
    fastify.log.error({ error }, 'Failed to connect Redis sub client');
    // Clean up pub client before throwing
    await pubClient.quit();
    throw new Error('Redis sub client connection failed - cannot start Socket.io');
  }

  io.adapter(createAdapter(pubClient, subClient));

  // Connection logging
  io.on('connection', (socket) => {
    fastify.log.info({
      socketId: socket.id,
      role: socket.data.role,
      agentId: socket.data.agent?.id
    }, 'WebSocket connection established');
  });

  // Error logging
  io.on('error', (error) => {
    fastify.log.error({ error }, 'Socket.io server error');
  });

  fastify.log.info('Socket.io server initialized');

  return io;
}
