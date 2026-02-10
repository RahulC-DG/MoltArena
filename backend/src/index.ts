import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { agentRoutes } from './routes/agents';
import { battleRoutes } from './routes/battles';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

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
    await server.listen({ port: PORT, host: '0.0.0.0' });
    server.log.info(`Server listening on http://localhost:${PORT}`);
    server.log.info('✓ Database connected');
    server.log.info('✓ Redis connected');
  } catch (error) {
    server.log.error({ error }, 'Error starting server');
    process.exit(1);
  }
};

start();
