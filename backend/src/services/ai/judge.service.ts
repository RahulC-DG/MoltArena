import { getAnthropicClient } from './index';
import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';

const prisma = new PrismaClient();

/**
 * Scoring breakdown for a single agent
 */
export interface AgentScore {
  logicReasoning: number; // 0-10 (30% weight)
  evidenceSources: number; // 0-10 (25% weight)
  rhetoricPersuasion: number; // 0-10 (20% weight)
  rebuttalQuality: number; // 0-10 (15% weight)
  styleDelivery: number; // 0-10 (10% weight)
  total: number; // Weighted total out of 10
}

/**
 * Judge's decision with scores and reasoning
 */
export interface JudgeDecision {
  winnerId: string;
  scores: Record<string, AgentScore>;
  reasoning: string;
  confidence: number; // 0-1
}

/**
 * Evaluate a completed battle using Claude Opus 4.6
 *
 * Uses expert debate judge persona with structured scoring criteria.
 * Analyzes all turns from all participants.
 *
 * Scoring Weights:
 * - Logic & Reasoning: 30%
 * - Evidence & Sources: 25%
 * - Rhetoric & Persuasion: 20%
 * - Rebuttal Quality: 15%
 * - Style & Delivery: 10%
 *
 * Fallback: If judge fails, uses vote-only winner determination
 *
 * @param battleId - Battle ID to evaluate
 * @param logger - Fastify logger
 * @returns Judge decision with winner and detailed scores
 */
export async function evaluateBattle(battleId: string, logger: FastifyBaseLogger): Promise<JudgeDecision> {
  try {
    const anthropic = getAnthropicClient();

    // 1. Fetch battle data with all turns
    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        participants: {
          where: { isActive: true },
          include: {
            agent: true,
          },
          orderBy: { position: 'asc' },
        },
        turns: {
          orderBy: { turnNumber: 'asc' },
          include: {
            agent: true,
          },
        },
      },
    });

    if (!battle) {
      throw new Error('Battle not found');
    }

    if (battle.participants.length === 0) {
      throw new Error('No participants in battle');
    }

    // 2. Build transcript
    const transcript = battle.turns
      .map((turn) => {
        const agent = battle.participants.find((p) => p.agentId === turn.agentId);
        return `[Turn ${turn.turnNumber}] ${agent?.agent.displayName || 'Unknown'}: ${turn.content}`;
      })
      .join('\n\n');

    // 3. Build participant list
    const participantList = battle.participants
      .map((p, idx) => `${idx + 1}. ${p.agent.displayName} (ID: ${p.agentId})`)
      .join('\n');

    // 4. System prompt: Expert debate judge
    const systemPrompt = `You are an expert debate judge evaluating a competitive debate battle.

Topic: ${battle.topic}

Participants:
${participantList}

Your task is to objectively evaluate each participant's performance across these criteria:

1. Logic & Reasoning (30% weight): Soundness of arguments, logical consistency, fallacy avoidance
2. Evidence & Sources (25% weight): Use of facts, citations, credible sources
3. Rhetoric & Persuasion (20% weight): Persuasive techniques, clarity, audience engagement
4. Rebuttal Quality (15% weight): Addressing opponent's points, counterarguments
5. Style & Delivery (10% weight): Professionalism, coherence, presentation

Score each criterion from 0-10 for each participant.

Respond ONLY with valid JSON in this exact format:
{
  "scores": {
    "agent-id-1": {
      "logicReasoning": 8,
      "evidenceSources": 7,
      "rhetoricPersuasion": 9,
      "rebuttalQuality": 6,
      "styleDelivery": 8
    },
    "agent-id-2": { ... }
  },
  "reasoning": "Detailed explanation of decision (2-3 paragraphs)",
  "winnerId": "agent-id-of-winner",
  "confidence": 0.85
}`;

    const userPrompt = `Full debate transcript:

${transcript}

Evaluate and provide your decision in JSON format.`;

    logger.debug({ battleId }, 'Generating judge evaluation');

    // 5. Call Claude API with timeout
    const response = await Promise.race([
      anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 2000,
        temperature: 0.3, // Low temperature for objective analysis
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Judge timeout')), 30000)),
    ]) as any;

    // 6. Parse JSON response
    const responseText = response.content && response.content[0] && response.content[0].type === 'text' ? response.content[0].text : '';

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from judge response');
    }

    const judgeData = JSON.parse(jsonMatch[0]);

    // 7. Calculate weighted totals
    const processedScores: Record<string, AgentScore> = {};
    for (const [agentId, scores] of Object.entries(judgeData.scores as Record<string, any>)) {
      const total =
        scores.logicReasoning * 0.3 +
        scores.evidenceSources * 0.25 +
        scores.rhetoricPersuasion * 0.2 +
        scores.rebuttalQuality * 0.15 +
        scores.styleDelivery * 0.1;

      processedScores[agentId] = {
        ...scores,
        total: Math.round(total * 10) / 10, // Round to 1 decimal
      };
    }

    const decision: JudgeDecision = {
      winnerId: judgeData.winnerId,
      scores: processedScores,
      reasoning: judgeData.reasoning,
      confidence: judgeData.confidence,
    };

    logger.info({ battleId, winnerId: decision.winnerId, confidence: decision.confidence }, 'Judge evaluation completed');

    return decision;
  } catch (error) {
    logger.error({ error, battleId }, 'Judge evaluation failed - using fallback');

    // Fallback: Use vote winner or first participant
    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        participants: {
          where: { isActive: true },
        },
        votes: true,
      },
    });

    if (!battle || battle.participants.length === 0) {
      throw new Error('Cannot determine fallback winner');
    }

    // Count votes
    const voteCounts: Record<string, number> = {};
    for (const vote of battle.votes) {
      voteCounts[vote.targetAgentId] = (voteCounts[vote.targetAgentId] || 0) + 1;
    }

    // Find winner by votes
    let winnerId = battle.participants[0].agentId;
    let maxVotes = voteCounts[winnerId] || 0;
    for (const participant of battle.participants) {
      const votes = voteCounts[participant.agentId] || 0;
      if (votes > maxVotes) {
        maxVotes = votes;
        winnerId = participant.agentId;
      }
    }

    // Create fallback scores (all 5.0)
    const fallbackScores: Record<string, AgentScore> = {};
    for (const participant of battle.participants) {
      fallbackScores[participant.agentId] = {
        logicReasoning: 5.0,
        evidenceSources: 5.0,
        rhetoricPersuasion: 5.0,
        rebuttalQuality: 5.0,
        styleDelivery: 5.0,
        total: 5.0,
      };
    }

    return {
      winnerId,
      scores: fallbackScores,
      reasoning: 'Judge evaluation failed. Winner determined by popular vote.',
      confidence: 0.5,
    };
  }
}
