import { Socket, Server } from 'socket.io';
import Redis from 'ioredis';
import { getBattleById, transitionToVoting, transitionToJudging, transitionToCompleted, assignDebatePositions } from '../../services/battle.service';
import { submitTurn, progressToNextRound, startNextTurn } from '../../services/turn.service';
import { recordVote, getTotalVotes } from '../../services/vote.service';
import { textToSpeech } from '../../services/ai/tts.service';
import { generateCommentary } from '../../services/ai/commentator.service';
import { evaluateBattle } from '../../services/ai/judge.service';
import { recordTurnMetrics } from '../../services/metrics.service';
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
      if (!battleId) {
        socket.emit('error', {
          code: 'VALIDATION_ERROR',
          message: 'Battle ID is required'
        });
        return;
      }

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

      // 8. If the battle is now full (all expected participants have joined),
      //    assign PRO/CON debate positions and notify each agent individually.
      if (battle.participants.length >= battle.maxParticipants) {
        try {
          const assignments = await assignDebatePositions(battleId!, logger);

          // Get all sockets in the battle room to emit to each individually
          const roomSockets = await _io.in(battleId!).fetchSockets();

          for (const assignment of assignments) {
            const targetSocket = roomSockets.find(
              (s) => s.data.agent?.id === assignment.agentId
            );
            if (targetSocket) {
              targetSocket.emit('battle:position_assigned', {
                battleId: battleId!,
                position: assignment.position,
                topic: battle.topic,
              });
            }
          }
        } catch (err) {
          logger.error({ err, battleId: battleId! }, 'Failed to assign debate positions');
        }
      }

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

      // Phase 1E: Complete turn submission logic
      const { content } = validation;
      const agentId = socket.data.agent!.id;

      // Explicit content validation
      if (!content || content.trim().length === 0) {
        socket.emit('error', {
          code: 'VALIDATION_ERROR',
          message: 'Turn content is required'
        });
        return;
      }

      try {
        // 1. Submit turn to database
        const turn = await submitTurn(battleId!, agentId, content, redis, logger);

        // 2. Acknowledge immediately to agent
        socket.emit('battle:turn_accepted', {
          battleId: battleId!,
          turnId: turn.id,
          turnNumber: turn.turnNumber,
          processing: true,
        });

        // 3. Record metrics (non-blocking)
        recordTurnMetrics(battleId!, agentId, turn.turnNumber, content!, turn.durationMs || 0, logger).catch((err) =>
          logger.warn({ error: err }, 'Failed to record turn metrics')
        );

        // 4. Generate TTS for turn (async, non-blocking)
        const ttsPromise = textToSpeech(content!, 'agent', battleId!, logger);

        // 5. Broadcast turn to all participants (with or without audio)
        const audioUrl = await ttsPromise.catch(() => null);
        _io.to(BattleRooms.main(battleId!)).emit('battle:turn', {
          turnId: turn.id,
          battleId: battleId!,
          agentId,
          turnNumber: turn.turnNumber,
          content: turn.content,
          audioUrl: audioUrl || undefined,
          timestamp: turn.createdAt.toISOString(),
        });

        // 6. Generate commentary (async, emit when ready)
        const battle = await getBattleById(battleId!);
        if (battle && (battle as any).enableCommentator) {
          generateCommentary(
            {
              battleId: battleId!,
              agentId,
              agentName: socket.data.agent!.name,
              position: 'debater',
              content: content!,
              round: Math.ceil(turn.turnNumber / 2),
              totalRounds: (battle as any).maxTurns / 2,
              previousTurns: [], // TODO: Fetch previous turns if needed
            },
            logger
          )
            .then((commentary) => {
              if (commentary.text) {
                _io.to(BattleRooms.main(battleId!)).emit('battle:commentary', {
                  battleId: battleId!,
                  text: commentary.text,
                  audioUrl: commentary.audioUrl || undefined,
                  timestamp: new Date().toISOString(),
                });
              }
            })
            .catch((err) => logger.warn({ error: err }, 'Commentary generation failed'));
        }

        // 7. Check if battle should progress
        const shouldContinue = await progressToNextRound(battleId!, logger);
        if (!shouldContinue) {
          // Max turns reached - transition to VOTING
          await transitionToVoting(battleId!, logger);
          _io.to(BattleRooms.main(battleId!)).emit('battle:state', {
            battleId: battleId!,
            status: 'VOTING',
            message: 'Battle complete! Voting period open.',
          });

          // After 30 seconds, transition to JUDGING
          setTimeout(async () => {
            try {
              await transitionToJudging(battleId!, logger);
              _io.to(BattleRooms.main(battleId!)).emit('battle:state', {
                battleId: battleId!,
                status: 'JUDGING',
                message: 'Judging in progress...',
              });

              // Run judge evaluation
              const decision = await evaluateBattle(battleId!, logger);
              await transitionToCompleted(battleId!, decision.winnerId, decision.reasoning, logger);

              // Broadcast results
              _io.to(BattleRooms.main(battleId!)).emit('battle:ended', {
                battleId: battleId!,
                winnerId: decision.winnerId,
                scores: decision.scores,
                reasoning: decision.reasoning,
                confidence: decision.confidence,
              });
            } catch (err) {
              logger.error({ error: err, battleId }, 'Failed to complete battle judging');
            }
          }, 30000);
        } else {
          // Start next turn
          const nextTurnInfo = await startNextTurn(battleId!, redis, logger);
          _io.to(BattleRooms.agents(battleId!)).emit('battle:turn_start', {
            battleId: battleId!,
            agentId: nextTurnInfo.agentId,
            deadline: nextTurnInfo.deadline,
          });

          // Notify specific agent
          const agentSockets = await _io.in(BattleRooms.main(battleId!)).fetchSockets();
          const targetSocket = agentSockets.find((s: any) => s.data.agent?.id === nextTurnInfo.agentId);
          if (targetSocket) {
            targetSocket.emit('battle:your_turn', {
              battleId: battleId!,
              deadline: nextTurnInfo.deadline,
            });
          }
        }

        logger.info({
          agentId,
          battleId: battleId!,
          turnId: turn.id,
          turnNumber: turn.turnNumber,
        }, 'Turn submitted and processed successfully');
      } catch (turnError: any) {
        // Handle specific turn submission errors
        if (turnError.message === 'NOT_YOUR_TURN') {
          socket.emit('error', {
            code: 'NOT_YOUR_TURN',
            message: 'It is not your turn to submit',
          });
        } else if (turnError.message === 'TURN_DEADLINE_EXCEEDED') {
          socket.emit('error', {
            code: 'TURN_DEADLINE_EXCEEDED',
            message: 'Turn deadline exceeded',
          });
        } else if (turnError.message === 'INVALID_BATTLE_STATE') {
          socket.emit('error', {
            code: 'INVALID_BATTLE_STATE',
            message: 'Battle is not in progress',
          });
        } else {
          throw turnError; // Re-throw for outer catch
        }
      }
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

      // Phase 1E: Complete voting logic
      try {
        await recordVote(battleId!, identifier, agentId!, logger);

        // Acknowledge vote to voter
        socket.emit('battle:vote_recorded', {
          battleId: battleId!,
          success: true,
        });

        // Get total votes and broadcast update (hide breakdown for fairness)
        const totalVotes = await getTotalVotes(battleId!);
        _io.to(BattleRooms.main(battleId!)).emit('battle:vote_update', {
          battleId: battleId!,
          totalVotes,
        });

        logger.info({
          battleId: battleId!,
          votedFor: agentId!,
          voter: identifier,
        }, 'Vote recorded successfully');
      } catch (voteError: any) {
        if (voteError.message === 'ALREADY_VOTED') {
          socket.emit('error', {
            code: 'ALREADY_VOTED',
            message: 'You have already voted in this battle',
          });
        } else {
          throw voteError; // Re-throw for outer catch
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'Redis error during voting');
      socket.emit('error', {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Voting service unavailable'
      });
    }
  });
}
