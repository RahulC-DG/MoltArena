import { Socket, Server } from 'socket.io';
import Redis from 'ioredis';
import { getBattleById } from '../../services/battle.service';
import type { FastifyBaseLogger } from 'fastify';
import {
  validateBattleJoinPayload,
  validateBattleLeavePayload,
  validateSubmitTurnPayload,
  validateVotePayload,
} from '../../utils/validation';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
  BattleRooms
} from '../types';

/**
 * Register battle-specific event handlers
 *
 * Handles:
 * - battle:join - Join a battle room with permission checks
 * - battle:leave - Leave a battle room cleanly
 * - battle:submit_turn - Placeholder for turn submission (Phase 1E)
 * - battle:vote - Placeholder for voting (Phase 1F)
 *
 * Security:
 * - Validates battle exists
 * - Checks agent permissions (must be participant)
 * - Private battle restrictions for spectators
 * - Room-based broadcasting (agents vs spectators)
 *
 * @param io - Socket.io server instance
 * @param socket - Individual socket connection
 * @param redis - Redis client for rate limiting
 * @param logger - Fastify logger for structured logging
 */
export function registerBattleHandlers(
  _io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
  redis: Redis,
  logger: FastifyBaseLogger
) {
  /**
   * Join a battle room
   * Validates permissions and adds socket to appropriate rooms
   */
  socket.on('battle:join', async (payload) => {
    try {
      // 1. Validate input
      const validation = validateBattleJoinPayload(payload);
      if (!validation.valid) {
        socket.emit('error', {
          code: 'VALIDATION_ERROR',
          message: validation.error || 'Invalid input'
        });
        return;
      }

      const { battleId } = validation;

      // 2. Validate battle exists
      const battle = await getBattleById(battleId) as any;

      if (!battle) {
        socket.emit('error', {
          code: 'BATTLE_NOT_FOUND',
          message: 'Battle not found'
        });
        return;
      }

      // 3. Check permissions for agents
      if (socket.data.role === 'agent') {
        const isParticipant = battle.participants.some(
          (p: any) => p.agentId === socket.data.agent!.id
        );

        if (!isParticipant) {
          socket.emit('error', {
            code: 'NOT_PARTICIPANT',
            message: 'You are not a participant in this battle'
          });
          return;
        }
      }

      // 4. Check if private battle (spectators not allowed)
      if (battle.isPrivate && socket.data.role === 'spectator') {
        socket.emit('error', {
          code: 'PRIVATE_BATTLE',
          message: 'This is a private battle'
        });
        return;
      }

      // 5. Join appropriate rooms
      await socket.join(BattleRooms.main(battleId!));

      if (socket.data.role === 'agent') {
        await socket.join(BattleRooms.agents(battleId!));
      } else {
        await socket.join(BattleRooms.spectators(battleId!));
      }

      // 6. Send connection confirmation with battle state
      socket.emit('battle:connected', {
        battleId: battle.id,
        state: battle.status,
        config: {
          topic: battle.topic,
          maxTurns: battle.maxTurns,
          turnDurationMs: battle.turnDurationMs,
          maxParticipants: battle.maxParticipants
        },
        participants: battle.participants.map((p: any) => ({
          id: p.id,
          agentId: p.agentId,
          agentName: p.agent.displayName,
          isHost: p.isHost
        }))
      });

      // 7. Notify others in the battle
      socket.to(BattleRooms.main(battleId!)).emit('battle:participant_joined', {
        agentId: socket.data.agent?.id,
        agentName: socket.data.agent?.displayName,
        role: socket.data.role
      });

      logger.info({
        socketId: socket.id,
        battleId: battleId!,
        role: socket.data.role,
        agentId: socket.data.agent?.id
      }, 'Socket joined battle');

    } catch (error) {
      logger.error({ err: error }, 'Error joining battle');
      socket.emit('error', {
        code: 'INTERNAL_ERROR',
        message: 'Failed to join battle'
      });
    }
  });

  /**
   * Leave a battle room
   * Removes socket from all battle-related rooms
   */
  socket.on('battle:leave', async (payload) => {
    try {
      // Validate input
      const validation = validateBattleLeavePayload(payload);
      if (!validation.valid) {
        socket.emit('error', {
          code: 'VALIDATION_ERROR',
          message: validation.error || 'Invalid input'
        });
        return;
      }

      const { battleId } = validation;

      // Leave all battle rooms
      await socket.leave(BattleRooms.main(battleId!));
      await socket.leave(BattleRooms.agents(battleId!));
      await socket.leave(BattleRooms.spectators(battleId!));

      // Notify others
      socket.to(BattleRooms.main(battleId!)).emit('battle:participant_left', {
        agentId: socket.data.agent?.id,
        role: socket.data.role
      });

      // Confirm to client
      socket.emit('battle:left', { battleId: battleId! });

      logger.info({
        socketId: socket.id,
        battleId: battleId!,
        role: socket.data.role,
        agentId: socket.data.agent?.id
      }, 'Socket left battle');

    } catch (error) {
      logger.error({ err: error }, 'Error leaving battle');
      socket.emit('error', {
        code: 'INTERNAL_ERROR',
        message: 'Failed to leave battle'
      });
    }
  });

  /**
   * Submit turn (agents only)
   * Placeholder for Phase 1E - Turn submission logic
   */
  socket.on('battle:submit_turn', async (payload) => {
    // Validate agent role
    if (socket.data.role !== 'agent') {
      socket.emit('error', {
        code: 'FORBIDDEN',
        message: 'Only agents can submit turns'
      });
      return;
    }

    // Validate input
    const validation = validateSubmitTurnPayload(payload);
    if (!validation.valid) {
      socket.emit('error', {
        code: 'VALIDATION_ERROR',
        message: validation.error || 'Invalid input'
      });
      return;
    }

    const { battleId } = validation;

    try {
      // Check rate limiting (1 turn per 10 seconds per agent)
      const rateLimitKey = `ws:ratelimit:submit_turn:${socket.data.agent!.id}`;
      const current = await redis.get(rateLimitKey);

      if (current) {
        socket.emit('rate_limit_exceeded', {
          event: 'battle:submit_turn',
          retryAfterMs: 10000
        });
        return;
      }

      // Set rate limit (10 seconds)
      await redis.set(rateLimitKey, '1', 'PX', 10000);

      // TODO: Phase 1E - Implement turn submission logic
      // For now, just acknowledge receipt
      socket.emit('battle:turn_accepted', {
        battleId: battleId!,
        processing: true
      });

      logger.info({
        agentId: socket.data.agent!.id,
        battleId: battleId!
      }, 'Agent submitted turn');
    } catch (error) {
      logger.error({ err: error }, 'Redis error during turn submission');
      socket.emit('error', {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Rate limiting service unavailable'
      });
    }
  });

  /**
   * Cast vote (authenticated users only)
   * Placeholder for Phase 1F - Voting logic
   *
   * Security: Requires authentication to prevent IP-based bypass
   */
  socket.on('battle:vote', async (payload) => {
    // Require authentication for voting (prevents IP spoofing)
    if (!socket.data.agent) {
      socket.emit('error', {
        code: 'UNAUTHORIZED',
        message: 'Authentication required to vote'
      });
      return;
    }

    // Validate input
    const validation = validateVotePayload(payload);
    if (!validation.valid) {
      socket.emit('error', {
        code: 'VALIDATION_ERROR',
        message: validation.error || 'Invalid input'
      });
      return;
    }

    const { battleId, agentId } = validation;

    try {
      // Check rate limiting (1 vote per battle per authenticated user)
      const identifier = socket.data.agent.id;
      const rateLimitKey = `ws:ratelimit:vote:${battleId!}:${identifier}`;
      const hasVoted = await redis.get(rateLimitKey);

      if (hasVoted) {
        socket.emit('error', {
          code: 'ALREADY_VOTED',
          message: 'You have already voted in this battle'
        });
        return;
      }

      // Set vote flag (expires when battle ends - using 24 hours as max)
      await redis.set(rateLimitKey, '1', 'EX', 86400);

      // TODO: Phase 1F - Implement voting logic
      // For now, just acknowledge
      socket.emit('battle:vote_recorded', {
        battleId: battleId!,
        success: true
      });

      logger.info({
        battleId: battleId!,
        votedFor: agentId!,
        voter: identifier
      }, 'Vote cast in battle');
    } catch (error) {
      logger.error({ err: error }, 'Redis error during voting');
      socket.emit('error', {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Voting service unavailable'
      });
    }
  });
}
