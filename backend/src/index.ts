import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { agentRoutes } from './routes/agents';
import { battleRoutes } from './routes/battles';
import { initializeSocketServer } from './socketServer';
import { registerAuthMiddleware } from './websocket/auth';
import { registerAllHandlers } from './websocket/handlers';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Register Redis event handlers with Fastify logger (after server is created)
redis.on('error', (error) => {
  server.log.error({ err: error }, 'Redis connection error');
  server.log.fatal('FATAL: Redis is required for rate limiting and WebSocket operations');
  process.exit(1);
});

redis.on('connect', () => {
  server.log.info('Redis connected successfully');
});

redis.on('ready', () => {
  server.log.info('Redis ready for operations');
});

// Socket.io instance (initialized in start function)
let io: any;

// Register API routes
server.register(agentRoutes);
server.register(battleRoutes);

// Health check endpoint
server.get('/health', async (_request, reply) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    const dbStatus = 'connected';

    // Test Redis connection
    await redis.ping();
    const redisStatus = 'connected';

    return reply.status(200).send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    });
  } catch (error) {
    server.log.error({ error }, 'Health check failed');

    let dbStatus = 'unknown';
    let redisStatus = 'unknown';

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    try {
      await redis.ping();
      redisStatus = 'connected';
    } catch {
      redisStatus = 'disconnected';
    }

    return reply.status(503).send({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    });
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  server.log.info(`Received ${signal}, closing server gracefully...`);

  try {
    // Close Socket.io connections
    io.close(() => {
      server.log.info('Socket.io server closed');
    });

    await server.close();
    await prisma.$disconnect();
    redis.disconnect();
    server.log.info('Server closed successfully');
    process.exit(0);
  } catch (error) {
    server.log.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const start = async () => {
  try {
    // Initialize Socket.io server (must be async)
    io = await initializeSocketServer(server, redis);

    // Register WebSocket authentication middleware
    registerAuthMiddleware(io, server.log);

    // Register event handlers for each connection
    io.on('connection', (socket: any) => {
      registerAllHandlers(io, socket, redis, server.log);
    });

    await server.listen({ port: PORT, host: '0.0.0.0' });
    server.log.info(`Server listening on http://localhost:${PORT}`);
    server.log.info('✓ Database connected');
    server.log.info('✓ Redis connected');
    server.log.info(`✓ Socket.io server ready at ws://localhost:${PORT}/socket.io/`);
  } catch (error) {
    server.log.error({ error }, 'Error starting server');
    process.exit(1);
  }
};

start();
