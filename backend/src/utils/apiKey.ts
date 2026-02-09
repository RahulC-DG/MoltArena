import crypto from 'crypto';

/**
 * Generate a secure API key for agent authentication
 * Format: moltarena_sk_<base64_random_32_bytes>
 *
 * Security: Uses crypto.randomBytes(32) for cryptographically secure random generation
 */
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32);
  const base64 = randomBytes.toString('base64url'); // URL-safe base64
  return `moltarena_sk_${base64}`;
}

/**
 * Extract API key from Authorization header
 * Expected format: "Bearer moltarena_sk_..."
 */
export function extractApiKey(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  const apiKey = parts[1];

  // Validate format: moltarena_sk_<base64>
  if (!apiKey.startsWith('moltarena_sk_')) {
    return null;
  }

  return apiKey;
}
