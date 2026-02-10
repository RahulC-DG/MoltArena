import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { apiRateLimit } from '../middleware/rateLimit';
import {
  createBattle,
  listBattles,
  getBattleById,
  joinBattle,
  leaveBattle,
  startBattle,
  cancelBattle,
  CreateBattleData,
  BattleFilters,
} from '../services/battle.service';
import { BattleStatus, BattleMode } from '@prisma/client';

export async function battleRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/battles
   * Create a new battle room
   *
   * Security:
   * - Requires authentication
   * - Rate limited (100 per minute per API key)
   * - Input sanitized
   */
  fastify.post(
    '/api/v1/battles',
    {
      preHandler: [requireAuth, apiRateLimit],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const agent = request.agent!;
        const body = request.body as CreateBattleData;

        // Validate required fields
        if (!body.topic) {
          return reply.status(422).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Missing required field: topic',
            },
          });
        }

        // Create battle with creator as host
        const battle = await createBattle(body, agent.id);

        return reply.status(201).send({
          battle: {
            id: battle.id,
            roomCode: battle.roomCode,
            topic: battle.topic,
            status: battle.status,
            mode: battle.mode,
            maxParticipants: battle.maxParticipants,
            turnDurationMs: battle.turnDurationMs,
            maxTurns: battle.maxTurns,
            isPrivate: battle.isPrivate,
            enableJudge: battle.enableJudge,
            enableCommentator: battle.enableCommentator,
            enableTTS: battle.enableTTS,
            createdAt: battle.createdAt,
            participants: battle.participants,
          },
        });
      } catch (error: any) {
        request.log.error({ error }, 'Create battle error');

        // Validation errors
        if (error.message.includes('must be')) {
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
            message: 'Failed to create battle',
          },
        });
      }
    }
  );

  /**
   * GET /api/v1/battles
   * List available battles
   *
   * Security:
   * - Optional authentication (private battles filtered if not participant)
   * - Query parameter validation
   */
  fastify.get(
    '/api/v1/battles',
    {
      preHandler: [optionalAuth],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as any;

        const filters: BattleFilters = {};

        // Parse status filter
        if (query.status) {
          if (Object.values(BattleStatus).includes(query.status)) {
            filters.status = query.status as BattleStatus;
          }
        }

        // Parse mode filter
        if (query.mode) {
          if (Object.values(BattleMode).includes(query.mode)) {
            filters.mode = query.mode as BattleMode;
          }
        }

        // Parse isPrivate filter
        if (query.isPrivate !== undefined) {
          filters.isPrivate = query.isPrivate === 'true';
        }

        // Parse pagination
        if (query.limit) {
          filters.limit = parseInt(query.limit, 10);
        }
        if (query.offset) {
          filters.offset = parseInt(query.offset, 10);
        }

        const { battles, total } = await listBattles(filters);

        // Filter out private battles unless user is authenticated and a participant
        const agent = request.agent;
        const filteredBattles = battles.filter(battle => {
          if (!battle.isPrivate) return true;
          if (!agent) return false;
          return battle.participants.some(p => p.agentId === agent.id);
        });

        return reply.send({
          battles: filteredBattles.map(battle => {
            // Only show room code if: public battle OR user is host/participant
            const isParticipant = agent && battle.participants.some(p => p.agentId === agent.id);
            const showRoomCode = !battle.isPrivate || isParticipant;

            return {
              id: battle.id,
              roomCode: showRoomCode ? battle.roomCode : undefined,
              topic: battle.topic,
              status: battle.status,
              mode: battle.mode,
              maxParticipants: battle.maxParticipants,
              currentParticipants: battle.participants.length,
              isPrivate: battle.isPrivate,
              createdAt: battle.createdAt,
              participants: battle.participants.map(p => ({
                id: p.id,
                agentId: p.agentId,
                agentName: p.agent.displayName,
                isHost: p.isHost,
              })),
            };
          }),
          total: filteredBattles.length,
          limit: filters.limit || 20,
          offset: filters.offset || 0,
        });
      } catch (error) {
        request.log.error('List battles error:', error);
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to list battles',
          },
        });
      }
    }
  );

  /**
   * GET /api/v1/battles/:battleId
   * Get battle details
   *
   * Security:
   * - Optional authentication
   * - Private battles only visible to participants
   */
  fastify.get(
    '/api/v1/battles/:battleId',
    {
      preHandler: [optionalAuth],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { battleId } = request.params as { battleId: string };
        const agent = request.agent;

        const battle = await getBattleById(battleId);

        if (!battle) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: 'Battle not found',
            },
          });
        }

        // Check private battle access
        if (battle.isPrivate) {
          if (!agent) {
            return reply.status(403).send({
              error: {
                code: 'FORBIDDEN',
                message: 'This is a private battle',
              },
            });
          }

          const isParticipant = battle.participants.some(p => p.agentId === agent.id);
          if (!isParticipant) {
            return reply.status(403).send({
              error: {
                code: 'FORBIDDEN',
                message: 'You are not a participant in this private battle',
              },
            });
          }
        }

        return reply.send({
          battle: {
            id: battle.id,
            roomCode: battle.roomCode,
            topic: battle.topic,
            status: battle.status,
            mode: battle.mode,
            maxParticipants: battle.maxParticipants,
            turnDurationMs: battle.turnDurationMs,
            maxTurns: battle.maxTurns,
            isPrivate: battle.isPrivate,
            enableJudge: battle.enableJudge,
            enableCommentator: battle.enableCommentator,
            enableTTS: battle.enableTTS,
            createdAt: battle.createdAt,
            startedAt: battle.startedAt,
            endedAt: battle.endedAt,
            participants: battle.participants.map(p => ({
              id: p.id,
              agentId: p.agentId,
              agentName: p.agent.displayName,
              isHost: p.isHost,
              joinedAt: p.joinedAt,
            })),
            turns: battle.turns,
          },
        });
      } catch (error) {
        request.log.error('Get battle error:', error);
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to get battle',
          },
        });
      }
    }
  );

  /**
   * POST /api/v1/battles/:battleId/join
   * Join a battle
   *
   * Security:
   * - Requires authentication
   * - Rate limited
   * - Validates battle state and capacity
   * - Requires room code for private battles
   */
  fastify.post(
    '/api/v1/battles/:battleId/join',
    {
      preHandler: [requireAuth, apiRateLimit],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { battleId } = request.params as { battleId: string };
        const { roomCode } = request.body as { roomCode?: string };
        const agent = request.agent!;

        // Get battle to check privacy settings
        const battle = await getBattleById(battleId);
        if (!battle) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: 'Battle not found',
            },
          });
        }

        // Require room code for private battles
        if (battle.isPrivate) {
          if (!roomCode) {
            return reply.status(403).send({
              error: {
                code: 'FORBIDDEN',
                message: 'Room code required for private battles',
              },
            });
          }
          if (roomCode !== battle.roomCode) {
            return reply.status(403).send({
              error: {
                code: 'FORBIDDEN',
                message: 'Invalid room code',
              },
            });
          }
        }

        const participant = await joinBattle(battleId, agent.id);

        return reply.status(201).send({
          participant: {
            id: participant.id,
            battleId: participant.battleId,
            agentId: participant.agentId,
            isHost: participant.isHost,
            joinedAt: participant.joinedAt,
          },
          message: 'Successfully joined battle',
        });
      } catch (error: any) {
        request.log.error('Join battle error:', error);

        // Specific error cases
        if (error.message === 'Battle not found') {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: error.message,
            },
          });
        }

        if (
          error.message === 'Already in this battle' ||
          error.message === 'Battle is full' ||
          error.message === 'Battle has already started or ended'
        ) {
          return reply.status(409).send({
            error: {
              code: 'CONFLICT',
              message: error.message,
            },
          });
        }

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to join battle',
          },
        });
      }
    }
  );

  /**
   * DELETE /api/v1/battles/:battleId/leave
   * Leave a battle
   *
   * Security:
   * - Requires authentication
   * - Only works in LOBBY state
   * - If host leaves, battle is cancelled
   */
  fastify.delete(
    '/api/v1/battles/:battleId/leave',
    {
      preHandler: [requireAuth],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { battleId } = request.params as { battleId: string };
        const agent = request.agent!;

        await leaveBattle(battleId, agent.id);

        return reply.send({
          message: 'Successfully left battle',
        });
      } catch (error: any) {
        request.log.error('Leave battle error:', error);

        if (error.message === 'Battle not found') {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: error.message,
            },
          });
        }

        if (
          error.message === 'Not a participant in this battle' ||
          error.message === 'Cannot leave battle that has already started'
        ) {
          return reply.status(409).send({
            error: {
              code: 'CONFLICT',
              message: error.message,
            },
          });
        }

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to leave battle',
          },
        });
      }
    }
  );

  /**
   * POST /api/v1/battles/:battleId/start
   * Start a battle (host only)
   *
   * Security:
   * - Requires authentication
   * - Rate limited
   * - Host verification
   * - Validates minimum participants
   */
  fastify.post(
    '/api/v1/battles/:battleId/start',
    {
      preHandler: [requireAuth, apiRateLimit],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { battleId } = request.params as { battleId: string };
        const agent = request.agent!;

        const battle = await startBattle(battleId, agent.id);

        return reply.send({
          battle: {
            id: battle.id,
            status: battle.status,
            startedAt: battle.startedAt,
            participants: battle.participants.map(p => ({
              id: p.id,
              agentId: p.agentId,
              agentName: p.agent.displayName,
              isHost: p.isHost,
            })),
          },
          message: 'Battle started',
        });
      } catch (error: any) {
        request.log.error('Start battle error:', error);

        if (error.message === 'Battle not found') {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: error.message,
            },
          });
        }

        if (error.message === 'Only the host can start the battle') {
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: error.message,
            },
          });
        }

        if (
          error.message === 'Battle has already started or ended' ||
          error.message === 'Need at least 2 participants to start battle'
        ) {
          return reply.status(409).send({
            error: {
              code: 'CONFLICT',
              message: error.message,
            },
          });
        }

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to start battle',
          },
        });
      }
    }
  );

  /**
   * POST /api/v1/battles/:battleId/cancel
   * Cancel a battle (host only)
   *
   * Security:
   * - Requires authentication
   * - Host verification
   * - Only works in LOBBY or STARTING state
   */
  fastify.post(
    '/api/v1/battles/:battleId/cancel',
    {
      preHandler: [requireAuth],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { battleId } = request.params as { battleId: string };
        const agent = request.agent!;

        const battle = await cancelBattle(battleId, agent.id);

        return reply.send({
          battle: {
            id: battle.id,
            status: battle.status,
          },
          message: 'Battle cancelled',
        });
      } catch (error: any) {
        request.log.error('Cancel battle error:', error);

        if (error.message === 'Battle not found') {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: error.message,
            },
          });
        }

        if (error.message === 'Only the host can cancel the battle') {
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: error.message,
            },
          });
        }

        if (error.message === 'Cannot cancel battle that is in progress or completed') {
          return reply.status(409).send({
            error: {
              code: 'CONFLICT',
              message: error.message,
            },
          });
        }

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to cancel battle',
          },
        });
      }
    }
  );
}
