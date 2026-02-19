import { PrismaClient, BattleTurn, BattleStatus } from '@prisma/client';
import { sanitizeInput } from '../utils/sanitize';
import type { FastifyBaseLogger } from 'fastify';
import Redis from 'ioredis';

const prisma = new PrismaClient();

// Redis key patterns
const TURN_DEADLINE_KEY = (battleId: string) => `battle:${battleId}:turn:deadline`;
const CURRENT_AGENT_KEY = (battleId: string) => `battle:${battleId}:current_agent`;

/**
 * Start the next turn in a battle
 *
 * Determines the next agent in rotation based on position order,
 * sets turn deadline, and emits WebSocket events.
 *
 * @param battleId - Battle ID
 * @param redis - Redis client for storing deadline
 * @param logger - Fastify logger
 * @returns Agent ID whose turn it is
 */
export async function startNextTurn(
  battleId: string,
  redis: Redis,
  logger: FastifyBaseLogger
): Promise<{ agentId: string; deadline: number }> {
  // 1. Get battle with participants ordered by position
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      participants: {
        where: { isActive: true },
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!battle) {
    throw new Error('Battle not found');
  }

  if (battle.status !== BattleStatus.IN_PROGRESS) {
    throw new Error(`Battle not in IN_PROGRESS state: ${battle.status}`);
  }

  if (battle.participants.length === 0) {
    throw new Error('No active participants in battle');
  }

  // 2. Determine next agent by rotating through positions
  const currentTurn = battle.currentTurn;
  const participantIndex = currentTurn % battle.participants.length;
  const nextAgent = battle.participants[participantIndex];

  // 3. Calculate deadline (current time + turnDurationMs)
  const deadline = Date.now() + battle.turnDurationMs;

  // 4. Store in Redis
  await redis.setex(TURN_DEADLINE_KEY(battleId), Math.ceil(battle.turnDurationMs / 1000), deadline.toString());
  await redis.set(CURRENT_AGENT_KEY(battleId), nextAgent.agentId);

  logger.info(
    {
      battleId,
      agentId: nextAgent.agentId,
      turnNumber: currentTurn + 1,
      deadline,
    },
    'Started next turn'
  );

  return {
    agentId: nextAgent.agentId,
    deadline,
  };
}

/**
 * Submit a turn for an agent
 *
 * Validates:
 * - Agent is the current turn holder
 * - Turn is within deadline
 * - Battle is in IN_PROGRESS state
 *
 * @param battleId - Battle ID
 * @param agentId - Agent submitting the turn
 * @param content - Turn content (will be sanitized)
 * @param redis - Redis client
 * @param logger - Fastify logger
 * @returns Created BattleTurn record
 */
export async function submitTurn(
  battleId: string,
  agentId: string,
  content: string,
  redis: Redis,
  logger: FastifyBaseLogger
): Promise<BattleTurn> {
  // 1. Validate battle state
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      participants: {
        where: { agentId, isActive: true },
      },
    },
  });

  if (!battle) {
    throw new Error('BATTLE_NOT_FOUND');
  }

  if (battle.status !== BattleStatus.IN_PROGRESS) {
    throw new Error('INVALID_BATTLE_STATE');
  }

  if (battle.participants.length === 0) {
    throw new Error('NOT_PARTICIPANT');
  }

  // 2. Validate it's this agent's turn
  const currentAgentId = await redis.get(CURRENT_AGENT_KEY(battleId));
  if (currentAgentId !== agentId) {
    throw new Error('NOT_YOUR_TURN');
  }

  // 3. Check deadline
  const deadlineStr = await redis.get(TURN_DEADLINE_KEY(battleId));
  if (deadlineStr) {
    const deadline = parseInt(deadlineStr, 10);
    if (Date.now() > deadline) {
      throw new Error('TURN_DEADLINE_EXCEEDED');
    }
  }

  // 4. Sanitize content
  const sanitizedContent = sanitizeInput(content);

  // 5. Calculate duration
  const turnStartTime = deadlineStr ? parseInt(deadlineStr, 10) - battle.turnDurationMs : Date.now();
  const durationMs = Date.now() - turnStartTime;

  // 6. Create turn record
  const turn = await prisma.battleTurn.create({
    data: {
      battleId,
      agentId,
      turnNumber: battle.currentTurn + 1,
      content: sanitizedContent,
      durationMs,
    },
  });

  // 7. Increment battle currentTurn
  await prisma.battle.update({
    where: { id: battleId },
    data: { currentTurn: battle.currentTurn + 1 },
  });

  // 8. Clear Redis turn data
  await redis.del(TURN_DEADLINE_KEY(battleId));
  await redis.del(CURRENT_AGENT_KEY(battleId));

  logger.info(
    {
      battleId,
      agentId,
      turnId: turn.id,
      turnNumber: turn.turnNumber,
      durationMs,
    },
    'Turn submitted successfully'
  );

  return turn;
}

/**
 * Handle turn timeout when agent fails to submit within deadline
 *
 * Creates a forfeit turn record and progresses to next agent
 *
 * @param battleId - Battle ID
 * @param agentId - Agent who timed out
 * @param redis - Redis client
 * @param logger - Fastify logger
 */
export async function handleTurnTimeout(
  battleId: string,
  agentId: string,
  redis: Redis,
  logger: FastifyBaseLogger
): Promise<void> {
  logger.warn({ battleId, agentId }, 'Agent turn timeout - forfeiting turn');

  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
  });

  if (!battle) {
    throw new Error('Battle not found');
  }

  // Create forfeit turn
  await prisma.battleTurn.create({
    data: {
      battleId,
      agentId,
      turnNumber: battle.currentTurn + 1,
      content: '[FORFEIT - Turn timeout]',
      durationMs: battle.turnDurationMs,
    },
  });

  // Increment turn counter
  await prisma.battle.update({
    where: { id: battleId },
    data: { currentTurn: battle.currentTurn + 1 },
  });

  // Clear Redis turn data
  await redis.del(TURN_DEADLINE_KEY(battleId));
  await redis.del(CURRENT_AGENT_KEY(battleId));
}

/**
 * Get current turn information
 *
 * @param battleId - Battle ID
 * @param redis - Redis client
 * @returns Current agent ID and deadline, or null if no active turn
 */
export async function getCurrentTurnInfo(
  battleId: string,
  redis: Redis
): Promise<{ agentId: string; deadline: number } | null> {
  const agentId = await redis.get(CURRENT_AGENT_KEY(battleId));
  const deadlineStr = await redis.get(TURN_DEADLINE_KEY(battleId));

  if (!agentId || !deadlineStr) {
    return null;
  }

  return {
    agentId,
    deadline: parseInt(deadlineStr, 10),
  };
}

/**
 * Check if current round is complete
 *
 * A round is complete when all active participants have submitted a turn
 *
 * @param battleId - Battle ID
 * @returns True if round is complete
 */
export async function isRoundComplete(battleId: string): Promise<boolean> {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      participants: {
        where: { isActive: true },
      },
    },
  });

  if (!battle) {
    throw new Error('Battle not found');
  }

  const participantCount = battle.participants.length;
  const turnsInCurrentRound = battle.currentTurn % participantCount;

  // Round is complete if we've cycled back to position 0
  return turnsInCurrentRound === 0 && battle.currentTurn > 0;
}

/**
 * Progress to the next round
 *
 * Checks if battle should end based on maxTurns limit
 *
 * @param battleId - Battle ID
 * @param logger - Fastify logger
 * @returns True if battle should continue, false if should transition to VOTING
 */
export async function progressToNextRound(
  battleId: string,
  logger: FastifyBaseLogger
): Promise<boolean> {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
  });

  if (!battle) {
    throw new Error('Battle not found');
  }

  // Check if we've reached max turns
  if (battle.currentTurn >= battle.maxTurns) {
    logger.info({ battleId, currentTurn: battle.currentTurn, maxTurns: battle.maxTurns }, 'Battle max turns reached');
    return false; // Should transition to VOTING
  }

  logger.info({ battleId, currentTurn: battle.currentTurn, maxTurns: battle.maxTurns }, 'Progressing to next round');
  return true; // Continue battle
}
