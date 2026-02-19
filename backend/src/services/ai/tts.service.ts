import { getDeepgramClient } from './index';
import type { FastifyBaseLogger } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

/**
 * Convert text to speech using Deepgram Aura-2
 *
 * Features:
 * - Agent voice: aura-arcas-en (neutral, authoritative)
 * - Commentator voice: aura-asteria-en (energetic, expressive)
 * - MP3 encoding for smaller file sizes
 * - Graceful degradation on failure (returns null)
 *
 * Storage:
 * - Files saved to: /public/audio/{battleId}/{timestamp}.mp3
 * - Returns public URL: /audio/{battleId}/{filename}
 *
 * @param text - Text to convert to speech
 * @param voiceType - 'agent' or 'commentator' to select voice profile
 * @param battleId - Battle ID for organizing audio files
 * @param logger - Fastify logger for structured logging
 * @returns Public URL path to audio file, or null on failure
 */
export async function textToSpeech(
  text: string,
  voiceType: 'agent' | 'commentator',
  battleId: string,
  logger: FastifyBaseLogger
): Promise<string | null> {
  try {
    const deepgram = getDeepgramClient();

    // Select voice based on type
    const voice = voiceType === 'agent' ? 'aura-arcas-en' : 'aura-asteria-en';
    const speed = voiceType === 'agent' ? 1.0 : 1.1; // Commentator slightly faster

    logger.debug({ text, voiceType, battleId }, 'Generating TTS audio');

    // Call Deepgram TTS API
    const response = await deepgram.speak.request(
      { text },
      {
        model: voice,
        encoding: 'mp3',
        speed,
      }
    );

    // Get audio stream
    const stream = await response.getStream();
    if (!stream) {
      logger.warn({ battleId, voiceType }, 'TTS: No audio stream returned');
      return null;
    }

    // Save to storage
    const audioUrl = await saveAudioToStorage(stream, battleId, logger);

    logger.info({ audioUrl, voiceType, battleId }, 'TTS audio generated successfully');
    return audioUrl;
  } catch (error) {
    // Graceful degradation: log error but don't throw
    logger.error({ error, battleId, voiceType, text: text.substring(0, 100) }, 'TTS generation failed');
    return null;
  }
}

/**
 * Save audio stream to file storage
 *
 * Directory structure: /public/audio/{battleId}/{timestamp}.mp3
 * Ensures directory exists before writing
 *
 * @param audioStream - ReadableStream from Deepgram API
 * @param battleId - Battle ID for organizing files
 * @param logger - Fastify logger
 * @returns Public URL path (e.g., /audio/{battleId}/1234567890.mp3)
 */
async function saveAudioToStorage(
  audioStream: ReadableStream<Uint8Array>,
  battleId: string,
  logger: FastifyBaseLogger
): Promise<string | null> {
  try {
    // Generate filename with timestamp
    const timestamp = Date.now();
    const filename = `${timestamp}.mp3`;

    // Construct file paths
    const audioDir = path.join(process.cwd(), 'public', 'audio', battleId);
    const filePath = path.join(audioDir, filename);

    // Ensure directory exists
    await fs.mkdir(audioDir, { recursive: true });

    // Convert ReadableStream to Node.js Readable
    const reader = audioStream.getReader();
    const nodeStream = new Readable({
      async read() {
        try {
          const { done, value } = await reader.read();
          if (done) {
            this.push(null);
          } else {
            this.push(Buffer.from(value));
          }
        } catch (error) {
          this.destroy(error as Error);
        }
      },
    });

    // Write stream to file
    const writeStream = createWriteStream(filePath);
    await pipeline(nodeStream, writeStream);

    // Return public URL path
    const publicUrl = `/audio/${battleId}/${filename}`;

    logger.debug({ filePath, publicUrl }, 'Audio file saved successfully');
    return publicUrl;
  } catch (error) {
    logger.error({ error, battleId }, 'Failed to save audio file');
    return null;
  }
}
