import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import type { FastifyBaseLogger } from 'fastify';

const prisma = new PrismaClient();

/**
 * Record a spectator vote for an agent
 *
 * Uses idempotency key (SHA256 hash of battleId:voterId) to prevent duplicate votes.
 * Prisma's unique constraint on idempotencyKey ensures database-level deduplication.
 *
 * @param battleId - Battle ID
 * @param voterId - Voter ID (agent ID or session ID)
 * @param targetAgentId - Agent being voted for
 * @param logger - Fastify logger
 * @throws Error 'ALREADY_VOTED' if user has already voted (P2002 Prisma error)
 */
export async function recordVote(
  battleId: string,
  voterId: string,
  targetAgentId: string,
  logger: FastifyBaseLogger
): Promise<void> {
  // Generate idempotency key
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${battleId}:${voterId}`)
    .digest('hex');

  try {
    await prisma.vote.create({
      data: {
        battleId,
        voterId,
        targetAgentId,
        idempotencyKey,
      },
    });

    logger.info({ battleId, voterId, targetAgentId }, 'Vote recorded successfully');
  } catch (error: any) {
    // P2002 = Unique constraint violation (duplicate vote)
    if (error.code === 'P2002') {
      throw new Error('ALREADY_VOTED');
    }
    throw error;
  }
}

/**
 * Get vote count for a specific agent in a battle
 *
 * @param battleId - Battle ID
 * @param agentId - Agent ID
 * @returns Number of votes for this agent
 */
export async function getVoteCount(battleId: string, agentId: string): Promise<number> {
  const count = await prisma.vote.count({
    where: {
      battleId,
      targetAgentId: agentId,
    },
  });

  return count;
}

/**
 * Get total votes across all agents in a battle
 *
 * @param battleId - Battle ID
 * @returns Total number of votes
 */
export async function getTotalVotes(battleId: string): Promise<number> {
  const count = await prisma.vote.count({
    where: { battleId },
  });

  return count;
}

/**
 * Determine vote winner based on popular vote
 *
 * @param battleId - Battle ID
 * @returns Agent ID with most votes, or null if tie or no votes
 */
export async function determineVoteWinner(battleId: string): Promise<string | null> {
  // Group votes by agent and count
  const voteCounts = await prisma.vote.groupBy({
    by: ['targetAgentId'],
    where: { battleId },
    _count: {
      targetAgentId: true,
    },
    orderBy: {
      _count: {
        targetAgentId: 'desc',
      },
    },
  });

  if (voteCounts.length === 0) {
    return null; // No votes cast
  }

  const topVote = voteCounts[0];
  const topCount = topVote._count?.targetAgentId || 0;

  // Check for tie
  if (voteCounts.length > 1 && (voteCounts[1]._count?.targetAgentId || 0) === topCount) {
    return null; // Tie
  }

  return topVote.targetAgentId;
}

/**
 * Get vote breakdown for all agents in a battle
 *
 * @param battleId - Battle ID
 * @returns Map of agentId -> vote count
 */
export async function getVoteBreakdown(battleId: string): Promise<Record<string, number>> {
  const voteCounts = await prisma.vote.groupBy({
    by: ['targetAgentId'],
    where: { battleId },
    _count: {
      targetAgentId: true,
    },
  });

  const breakdown: Record<string, number> = {};
  for (const vote of voteCounts) {
    breakdown[vote.targetAgentId] = vote._count?.targetAgentId || 0;
  }

  return breakdown;
}
