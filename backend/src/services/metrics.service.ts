import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';

const prisma = new PrismaClient();

/**
 * Metrics for a single turn
 */
export interface TurnMetrics {
  battleId: string;
  agentId: string;
  turnNumber: number;
  durationMs: number;
  wordCount: number;
  sourceCitationCount: number;
}

/**
 * Aggregated metrics for an agent in a battle
 */
export interface AgentMetrics {
  avgResponseTime: number;
  totalTurnTime: number;
  timeoutCount: number;
  avgArgumentLength: number;
  vocabularyDiversity: number;
  sourceCitationCount: number;
  citationRate: number; // Citations per turn
}

/**
 * Record metrics for a submitted turn
 *
 * Calculates:
 * - Word count
 * - Source citation count (URLs, "according to", etc.)
 * - Duration (already provided)
 *
 * Non-critical: Errors are logged but don't block turn processing
 *
 * @param battleId - Battle ID
 * @param agentId - Agent ID
 * @param turnNumber - Turn number
 * @param content - Turn content
 * @param durationMs - Time taken to submit turn
 * @param logger - Fastify logger
 */
export async function recordTurnMetrics(
  battleId: string,
  agentId: string,
  turnNumber: number,
  content: string,
  durationMs: number,
  logger: FastifyBaseLogger
): Promise<void> {
  try {
    // Calculate word count
    const wordCount = content.trim().split(/\s+/).length;

    // Count source citations (simple heuristics)
    const urlCount = (content.match(/https?:\/\/[^\s]+/g) || []).length;
    const citationPhrases = ['according to', 'study shows', 'research indicates', 'data from', 'source:'];
    const phraseCount = citationPhrases.reduce((count, phrase) => {
      return count + (content.toLowerCase().match(new RegExp(phrase, 'g')) || []).length;
    }, 0);
    const sourceCitationCount = urlCount + phraseCount;

    logger.debug(
      {
        battleId,
        agentId,
        turnNumber,
        wordCount,
        sourceCitationCount,
        durationMs,
      },
      'Turn metrics recorded'
    );

    // Note: Metrics are stored in BattleTurn.durationMs field
    // Additional analytics can be computed on-demand from BattleTurn records
  } catch (error) {
    // Non-critical: log error but don't throw
    logger.warn({ error, battleId, agentId, turnNumber }, 'Failed to record turn metrics');
  }
}

/**
 * Calculate aggregated metrics for an agent in a battle
 *
 * @param battleId - Battle ID
 * @param agentId - Agent ID
 * @returns Aggregated metrics
 */
export async function calculateBattleMetrics(battleId: string, agentId: string): Promise<AgentMetrics> {
  // Fetch all turns for this agent in this battle
  const turns = await prisma.battleTurn.findMany({
    where: {
      battleId,
      agentId,
    },
    orderBy: { turnNumber: 'asc' },
  });

  if (turns.length === 0) {
    return {
      avgResponseTime: 0,
      totalTurnTime: 0,
      timeoutCount: 0,
      avgArgumentLength: 0,
      vocabularyDiversity: 0,
      sourceCitationCount: 0,
      citationRate: 0,
    };
  }

  // Calculate metrics
  const durations = turns.map((t) => t.durationMs || 0);
  const totalTurnTime = durations.reduce((sum, d) => sum + d, 0);
  const avgResponseTime = totalTurnTime / turns.length;

  const timeoutCount = turns.filter((t) => t.content.includes('[FORFEIT')).length;

  const wordCounts = turns.map((t) => t.content.trim().split(/\s+/).length);
  const avgArgumentLength = wordCounts.reduce((sum, wc) => sum + wc, 0) / turns.length;

  // Vocabulary diversity: unique words / total words
  const allWords = turns
    .map((t) => t.content.toLowerCase().match(/\b\w+\b/g) || [])
    .flat();
  const uniqueWords = new Set(allWords);
  const vocabularyDiversity = allWords.length > 0 ? uniqueWords.size / allWords.length : 0;

  // Source citations
  const citationCounts = turns.map((t) => {
    const urlCount = (t.content.match(/https?:\/\/[^\s]+/g) || []).length;
    const citationPhrases = ['according to', 'study shows', 'research indicates', 'data from', 'source:'];
    const phraseCount = citationPhrases.reduce((count, phrase) => {
      return count + (t.content.toLowerCase().match(new RegExp(phrase, 'g')) || []).length;
    }, 0);
    return urlCount + phraseCount;
  });
  const sourceCitationCount = citationCounts.reduce((sum, c) => sum + c, 0);
  const citationRate = sourceCitationCount / turns.length;

  return {
    avgResponseTime: Math.round(avgResponseTime),
    totalTurnTime,
    timeoutCount,
    avgArgumentLength: Math.round(avgArgumentLength),
    vocabularyDiversity: Math.round(vocabularyDiversity * 100) / 100,
    sourceCitationCount,
    citationRate: Math.round(citationRate * 100) / 100,
  };
}
