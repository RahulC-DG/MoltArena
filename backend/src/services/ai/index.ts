import Anthropic from '@anthropic-ai/sdk';
import { createClient as createDeepgramClient } from '@deepgram/sdk';
import type { FastifyBaseLogger } from 'fastify';

let anthropicClient: Anthropic | null = null;
let deepgramClient: any | null = null;

/**
 * Initialize AI service clients (Anthropic and Deepgram)
 *
 * This MUST be called during server startup, after environment variables are loaded.
 * Fails fast if API keys are missing or invalid.
 *
 * @param logger - Fastify logger for structured logging
 * @throws Error if ANTHROPIC_API_KEY or DEEPGRAM_API_KEY are not configured
 */
export function initializeAIClients(logger: FastifyBaseLogger): void {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const deepgramKey = process.env.DEEPGRAM_API_KEY;

  if (!anthropicKey || anthropicKey === '') {
    logger.fatal('ANTHROPIC_API_KEY not configured');
    throw new Error('Missing ANTHROPIC_API_KEY');
  }

  if (!deepgramKey || deepgramKey === '') {
    logger.fatal('DEEPGRAM_API_KEY not configured');
    throw new Error('Missing DEEPGRAM_API_KEY');
  }

  anthropicClient = new Anthropic({ apiKey: anthropicKey });
  deepgramClient = createDeepgramClient(deepgramKey);

  logger.info('AI clients initialized successfully');
}

/**
 * Get the Anthropic client instance
 *
 * @returns Anthropic client for Claude API calls
 * @throws Error if client not initialized (call initializeAIClients first)
 */
export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    throw new Error('Anthropic client not initialized. Call initializeAIClients() first.');
  }
  return anthropicClient;
}

/**
 * Get the Deepgram client instance
 *
 * @returns Deepgram client for TTS and STT
 * @throws Error if client not initialized (call initializeAIClients first)
 */
export function getDeepgramClient(): any {
  if (!deepgramClient) {
    throw new Error('Deepgram client not initialized. Call initializeAIClients() first.');
  }
  return deepgramClient;
}
