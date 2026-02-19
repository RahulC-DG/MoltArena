import { transitionToInProgress } from './battle.service';
import { startNextTurn } from './turn.service';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';
import { BattleRooms } from '../websocket/types';

/**
 * Battle Orchestrator Service
 *
 * Coordinates battle state transitions with WebSocket events and timers.
 * Separates orchestration logic from business logic.
 */

/**
 * Start the battle countdown and transition to IN_PROGRESS
 *
 * Called after battle starts (LOBBY → STARTING)
 * Waits 10 seconds, then transitions to IN_PROGRESS and starts first turn
 *
 * @param battleId - Battle ID
 * @param io - Socket.io server instance
 * @param redis - Redis client
 * @param logger - Fastify logger
 */
export async function orchestrateBattleStart(
  battleId: string,
  io: Server,
  redis: Redis,
  logger: FastifyBaseLogger
): Promise<void> {
  try {
    // Emit countdown start to all participants
    io.to(BattleRooms.main(battleId)).emit('battle:starting', {
      battleId,
      countdownSeconds: 10,
      message: 'Battle starting in 10 seconds...',
    });

    logger.info({ battleId }, 'Battle countdown started (10s)');

    // Wait 10 seconds
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Transition to IN_PROGRESS
    await transitionToInProgress(battleId, logger);

    // Emit state change
    io.to(BattleRooms.main(battleId)).emit('battle:state', {
      battleId,
      status: 'IN_PROGRESS',
      message: 'Battle in progress!',
    });

    logger.info({ battleId }, 'Battle transitioned to IN_PROGRESS');

    // Start first turn
    const firstTurnInfo = await startNextTurn(battleId, redis, logger);

    // Notify all agents about turn start
    io.to(BattleRooms.agents(battleId)).emit('battle:turn_start', {
      battleId,
      agentId: firstTurnInfo.agentId,
      deadline: firstTurnInfo.deadline,
    });

    // Notify specific agent it's their turn
    const sockets = await io.in(BattleRooms.main(battleId)).fetchSockets();
    const targetSocket = sockets.find((s: any) => s.data.agent?.id === firstTurnInfo.agentId);
    if (targetSocket) {
      targetSocket.emit('battle:your_turn', {
        battleId,
        deadline: firstTurnInfo.deadline,
      });
    }

    logger.info({ battleId, agentId: firstTurnInfo.agentId }, 'First turn started');
  } catch (error) {
    logger.error({ error, battleId }, 'Failed to orchestrate battle start');
    // Emit error to participants
    io.to(BattleRooms.main(battleId)).emit('error', {
      code: 'BATTLE_START_FAILED',
      message: 'Failed to start battle',
    });
  }
}
