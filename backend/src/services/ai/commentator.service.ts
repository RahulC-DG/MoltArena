import { getAnthropicClient } from './index';
import { textToSpeech } from './tts.service';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Context for generating commentary
 */
export interface CommentaryContext {
  battleId: string;
  agentId: string;
  agentName: string;
  position: string; // "pro" or "con" or position number
  content: string;
  round: number;
  totalRounds: number;
  previousTurns: Array<{ agentName: string; summary: string }>;
}

/**
 * Commentary result with text and optional audio URL
 */
export interface CommentaryResult {
  text: string;
  audioUrl: string | null;
}

/**
 * Generate real-time sports-style commentary for a turn
 *
 * Uses Claude Opus 4.6 to generate energetic, neutral commentary.
 * Style: Sports commentator analyzing a competitive debate.
 *
 * Features:
 * - Creative temperature (0.8) for varied commentary
 * - 2-3 sentence limit for brevity
 * - Generates TTS audio asynchronously
 * - Graceful degradation on failure
 *
 * @param context - Battle and turn context
 * @param logger - Fastify logger
 * @returns Commentary text and audio URL (or null on failure)
 */
export async function generateCommentary(
  context: CommentaryContext,
  logger: FastifyBaseLogger
): Promise<CommentaryResult> {
  try {
    const anthropic = getAnthropicClient();

    // Build previous turns summary
    const previousTurnsText =
      context.previousTurns.length > 0
        ? context.previousTurns
            .slice(-3) // Last 3 turns for context
            .map((t) => `${t.agentName}: ${t.summary}`)
            .join('\n')
        : 'This is the opening turn of the debate.';

    // System prompt: Sports commentator personality
    const systemPrompt = `You are an energetic, neutral sports commentator providing real-time analysis of a competitive debate battle.

Your style:
- Enthusiastic but objective (don't favor either side)
- Focus on argument quality, rhetoric, and debate tactics
- Keep it brief: 2-3 sentences maximum
- Avoid excessive jargon
- Make it exciting for spectators

Analyze the agent's argument for:
- Strength of reasoning and evidence
- Rhetorical effectiveness
- Strategic positioning in the debate
- Impact on the overall battle`;

    const userPrompt = `Round ${context.round}/${context.totalRounds}

Debate Topic: From battle context
Agent: ${context.agentName} (${context.position})

Previous turns:
${previousTurnsText}

Current turn:
${context.content}

Provide brief sports-style commentary on this turn (2-3 sentences).`;

    logger.debug({ battleId: context.battleId, agentId: context.agentId }, 'Generating AI commentary');

    // Call Claude API with timeout
    const response = await Promise.race([
      anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 300,
        temperature: 0.8,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Commentary timeout')), 5000)),
    ]) as any;

    // Extract text from response
    const commentaryText =
      response.content && response.content[0] && response.content[0].type === 'text'
        ? response.content[0].text
        : 'Analysis processing...';

    logger.info({ battleId: context.battleId, commentaryText }, 'Commentary generated successfully');

    // Generate TTS asynchronously (non-blocking)
    // We return the text immediately and emit audio URL separately when ready
    const audioPromise = textToSpeech(commentaryText, 'commentator', context.battleId, logger);

    // Wait for audio but don't block on failure
    const audioUrl = await audioPromise.catch((err) => {
      logger.warn({ error: err, battleId: context.battleId }, 'Commentary TTS failed');
      return null;
    });

    return {
      text: commentaryText,
      audioUrl,
    };
  } catch (error) {
    // Graceful degradation: return empty commentary on failure
    logger.error({ error, battleId: context.battleId, agentId: context.agentId }, 'Commentary generation failed');

    return {
      text: '',
      audioUrl: null,
    };
  }
}
