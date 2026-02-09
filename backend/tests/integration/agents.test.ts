import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { agentRoutes } from '../../src/routes/agents';
import { createApiKey } from '../../src/services/auth.service';

const prisma = new PrismaClient();
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  db: 15, // Use separate DB for testing
});

describe('Agent API Integration Tests', () => {
  let server: any;

  beforeAll(async () => {
    server = Fastify();
    await server.register(agentRoutes);
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear all Redis data for test DB (db 15)
    await redis.flushdb();
  });

  afterEach(async () => {
    // Clean up test agents
    await prisma.agent.deleteMany({
      where: {
        name: {
          startsWith: 'test_',
        },
      },
    });
  });

  describe('POST /api/v1/agents/register', () => {
    it('should create agent and return API key', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/agents/register',
        payload: {
          name: 'test_agent_1',
          displayName: 'Test Agent 1',
          description: 'Test agent for integration testing',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.agent).toBeDefined();
      expect(body.agent.id).toBeDefined();
      expect(body.agent.name).toBe('test_agent_1');
      expect(body.agent.displayName).toBe('Test Agent 1');
      expect(body.agent.description).toBe('Test agent for integration testing');

      expect(body.apiKey).toBeDefined();
      expect(body.apiKey).toMatch(/^moltarena_sk_[A-Za-z0-9_-]{43}$/);

      // Verify agent exists in database
      const dbAgent = await prisma.agent.findUnique({
        where: { name: 'test_agent_1' },
      });
      expect(dbAgent).not.toBeNull();
      expect(dbAgent?.apiKeyHash).toBeDefined();
    });

    it('should reject duplicate name (409)', async () => {
      // Register first agent
      await server.inject({
        method: 'POST',
        url: '/api/v1/agents/register',
        payload: {
          name: 'test_agent_duplicate',
          displayName: 'Test Agent Duplicate',
          description: 'First agent',
        },
      });

      // Try to register with same name
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/agents/register',
        payload: {
          name: 'test_agent_duplicate',
          displayName: 'Test Agent Duplicate 2',
          description: 'Second agent',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('already exists');
    });

    it('should validate name format (422)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/agents/register',
        payload: {
          name: 'invalid name with spaces!',
          displayName: 'Invalid Name Agent',
          description: 'Invalid name test',
        },
      });

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('Invalid name format');
    });

    it('should sanitize XSS in agent name', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/agents/register',
        payload: {
          name: 'test_<script>alert(1)</script>_xss',
          displayName: 'Test XSS Agent',
          description: 'XSS test',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.agent.name).not.toContain('<script>');
    });
  });

  describe('GET /api/v1/agents/me', () => {
    let testApiKey: string;
    let testAgentId: string;

    beforeEach(async () => {
      // Create a test agent for authentication tests
      const { apiKey, apiKeyHash } = await createApiKey();
      const agent = await prisma.agent.create({
        data: {
          name: 'test_auth_agent',
          displayName: 'Test Auth Agent',
          description: 'Agent for auth testing',
          apiKeyHash,
        },
      });

      testApiKey = apiKey;
      testAgentId = agent.id;
    });

    it('should require authentication (401)', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/agents/me',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('Missing');
    });

    it('should return current agent', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/agents/me',
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.agent.id).toBe(testAgentId);
      expect(body.agent.name).toBe('test_auth_agent');
      expect(body.agent.displayName).toBe('Test Auth Agent');
      expect(body.agent.apiKeyHash).toBeUndefined(); // Should not expose hash
    });

    it('should reject invalid API key', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/agents/me',
        headers: {
          authorization: 'Bearer invalid_key_format',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('Invalid');
    });
  });

  describe('PATCH /api/v1/agents/:agentId', () => {
    let testApiKey: string;
    let testAgentId: string;

    beforeEach(async () => {
      const { apiKey, apiKeyHash } = await createApiKey();
      const agent = await prisma.agent.create({
        data: {
          name: 'test_patch_agent',
          displayName: 'Test Patch Agent',
          description: 'Agent for patch testing',
          apiKeyHash,
        },
      });

      testApiKey = apiKey;
      testAgentId = agent.id;
    });

    it('should require auth (401)', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${testAgentId}`,
        payload: {
          description: 'Unauthorized update attempt',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject updating other agent (403)', async () => {
      // Create another agent
      const { apiKey: otherApiKey, apiKeyHash: otherHash } = await createApiKey();
      const otherAgent = await prisma.agent.create({
        data: {
          name: 'test_other_agent',
          displayName: 'Test Other Agent',
          description: 'Other agent',
          apiKeyHash: otherHash,
        },
      });

      // Try to update first agent using second agent's API key
      const response = await server.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${testAgentId}`,
        headers: {
          authorization: `Bearer ${otherApiKey}`,
        },
        payload: {
          description: 'Unauthorized update attempt',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('update your own profile');

      // Clean up
      await prisma.agent.delete({ where: { id: otherAgent.id } });
    });

    it('should allow agent to update own profile', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${testAgentId}`,
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
        payload: {
          description: 'Updated description',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.agent.description).toBe('Updated description');
    });
  });

  describe('Rate limiting', () => {
    it('should work for registration (5/hour)', async () => {
      const responses = [];

      // Make 6 registration requests (limit is 5 per hour)
      for (let i = 0; i < 6; i++) {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/agents/register',
          payload: {
            name: `test_ratelimit_${i}`,
            displayName: `Test Rate Limit ${i}`,
            description: 'Rate limit test',
          },
        });
        responses.push(response.statusCode);
      }

      // First 5 should succeed
      expect(responses.slice(0, 5).every((status) => status === 201)).toBe(true);

      // 6th should be rate limited
      expect(responses[5]).toBe(429);
    }, 15000); // Increase timeout for this test

    it('should work for API (100/min)', async () => {
      // Register an agent
      const regResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/agents/register',
        payload: {
          name: 'test_api_ratelimit',
          displayName: 'Test API Rate Limit',
          description: 'API rate limit test',
        },
      });
      const { apiKey } = JSON.parse(regResponse.body);

      // Clear registration rate limits
      const keys = await redis.keys('ratelimit:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      const responses = [];

      // Make 50 authenticated requests (limit is 100 per minute)
      for (let i = 0; i < 50; i++) {
        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/agents/me',
          headers: {
            authorization: `Bearer ${apiKey}`,
          },
        });
        responses.push(response.statusCode);
      }

      // All should succeed (well under the limit)
      expect(responses.every((status) => status === 200)).toBe(true);
    }, 20000); // Increase timeout for this test
  });
});
