import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { generateApiKey } from '../utils/apiKey';

const prisma = new PrismaClient();

// bcrypt cost factor (CRITICAL: Must be 12 per security requirements)
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

/**
 * Hash an API key using bcrypt with cost factor 12
 * Security: bcrypt is designed for password hashing and includes salt automatically
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  return bcrypt.hash(apiKey, BCRYPT_ROUNDS);
}

/**
 * Verify an API key against its hash using timing-safe comparison
 * Security: Uses bcrypt.compare which is timing-safe
 */
export async function verifyApiKey(
  apiKey: string,
  apiKeyHash: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(apiKey, apiKeyHash);
  } catch (error) {
    return false;
  }
}

/**
 * Find agent by API key (hashed lookup)
 * Security: Uses Prisma (no raw SQL) and timing-safe comparison
 */
export async function findAgentByApiKey(apiKey: string) {
  try {
    // Get all agents (we need to verify hash for each since we can't query by hash)
    // Note: In production, consider caching API key hashes in Redis
    const agents = await prisma.agent.findMany({
      where: {
        isActive: true,
      },
    });

    // Find matching agent using timing-safe bcrypt comparison
    for (const agent of agents) {
      const isValid = await verifyApiKey(apiKey, agent.apiKeyHash);
      if (isValid) {
        return agent;
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding agent by API key:', error);
    return null;
  }
}

/**
 * Generate a new API key and its hash
 * Returns both the plain key (to return to user) and hash (to store in DB)
 */
export async function createApiKey(): Promise<{
  apiKey: string;
  apiKeyHash: string;
}> {
  const apiKey = generateApiKey();
  const apiKeyHash = await hashApiKey(apiKey);

  return { apiKey, apiKeyHash };
}
