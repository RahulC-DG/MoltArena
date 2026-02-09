import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { apiRateLimit, registrationRateLimit } from '../middleware/rateLimit';
import {
  registerAgent,
  getAgentById,
  updateAgent,
  CreateAgentData,
  UpdateAgentData,
} from '../services/agent.service';

export async function agentRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/agents/register
   * Register a new agent and receive API key
   *
   * Security:
   * - Rate limited (5 per hour per IP)
   * - Input sanitized with DOMPurify
   * - API key hashed with bcrypt before storage
   * - API key returned ONLY ONCE
   */
  fastify.post(
    '/api/v1/agents/register',
    {
      preHandler: [registrationRateLimit],
    },
    async (
      request: FastifyRequest<{ Body: CreateAgentData }>,
      reply: FastifyReply
    ) => {
      try {
        const { name, displayName, description } = request.body;

        // Validate required fields
        if (!name || !displayName) {
          return reply.status(422).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Missing required fields: name, displayName',
            },
          });
        }

        // Register agent
        const { agent, apiKey } = await registerAgent({
          name,
          displayName,
          description,
        });

        // Return agent and API key (ONLY TIME KEY IS RETURNED!)
        return reply.status(201).send({
          agent: {
            id: agent.id,
            name: agent.name,
            displayName: agent.displayName,
            description: agent.description,
            createdAt: agent.createdAt,
            isActive: agent.isActive,
          },
          apiKey, // ⚠️ IMPORTANT: Store this - it will never be shown again!
        });
      } catch (error: any) {
        request.log.error('Registration error:', error);

        // Check for unique constraint violation (duplicate name)
        if (error.code === 'P2002') {
          return reply.status(409).send({
            error: {
              code: 'CONFLICT',
              message: 'Agent name already exists',
            },
          });
        }

        // Validation errors
        if (error.message.includes('Invalid') || error.message.includes('must be')) {
          return reply.status(422).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: error.message,
            },
          });
        }

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to register agent',
          },
        });
      }
    }
  );

  /**
   * GET /api/v1/agents/me
   * Get current authenticated agent's profile
   *
   * Security:
   * - Requires authentication
   * - Rate limited (100 per minute per API key)
   */
  fastify.get(
    '/api/v1/agents/me',
    {
      preHandler: [requireAuth, apiRateLimit],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const agent = request.agent!;

      return reply.send({
        agent: {
          id: agent.id,
          name: agent.name,
          displayName: agent.displayName,
          description: agent.description,
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt,
          isActive: agent.isActive,
        },
      });
    }
  );

  /**
   * GET /api/v1/agents/:agentId
   * Get agent profile by ID (public endpoint)
   *
   * Security:
   * - Rate limited (100 per minute)
   * - No authentication required
   */
  fastify.get(
    '/api/v1/agents/:agentId',
    {
      preHandler: [apiRateLimit],
    },
    async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { agentId } = request.params;

        const agent = await getAgentById(agentId);

        if (!agent) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: 'Agent not found',
            },
          });
        }

        return reply.send({
          agent: {
            id: agent.id,
            name: agent.name,
            displayName: agent.displayName,
            description: agent.description,
            createdAt: agent.createdAt,
            isActive: agent.isActive,
          },
        });
      } catch (error) {
        request.log.error('Get agent error:', error);
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to get agent',
          },
        });
      }
    }
  );

  /**
   * PATCH /api/v1/agents/:agentId
   * Update agent profile
   *
   * Security:
   * - Requires authentication
   * - Can only update own profile
   * - Rate limited (100 per minute per API key)
   * - Input sanitized with DOMPurify
   */
  fastify.patch(
    '/api/v1/agents/:agentId',
    {
      preHandler: [requireAuth, apiRateLimit],
    },
    async (
      request: FastifyRequest<{
        Params: { agentId: string };
        Body: UpdateAgentData;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { agentId } = request.params;
        const authenticatedAgent = request.agent!;

        // Verify agent is updating their own profile
        if (authenticatedAgent.id !== agentId) {
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'You can only update your own profile',
            },
          });
        }

        const { displayName, description, isActive } = request.body;

        // Update agent
        const updatedAgent = await updateAgent(agentId, {
          displayName,
          description,
          isActive,
        });

        return reply.send({
          agent: {
            id: updatedAgent.id,
            name: updatedAgent.name,
            displayName: updatedAgent.displayName,
            description: updatedAgent.description,
            createdAt: updatedAgent.createdAt,
            updatedAt: updatedAgent.updatedAt,
            isActive: updatedAgent.isActive,
          },
        });
      } catch (error: any) {
        request.log.error('Update agent error:', error);

        // Validation errors
        if (error.message.includes('must be')) {
          return reply.status(422).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: error.message,
            },
          });
        }

        // Agent not found
        if (error.code === 'P2025') {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: 'Agent not found',
            },
          });
        }

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to update agent',
          },
        });
      }
    }
  );
}
