import crypto from 'crypto';

/**
 * Timing-safe string comparison to prevent timing attacks
 * Uses crypto.timingSafeEqual for constant-time comparison
 *
 * Security: Prevents attackers from using response time to guess valid tokens
 */
export function timingSafeCompare(a: string, b: string): boolean {
  // Ensure both strings are the same length to avoid early return
  if (a.length !== b.length) {
    return false;
  }

  try {
    // Convert strings to buffers for comparison
    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');

    // Use crypto.timingSafeEqual for constant-time comparison
    return crypto.timingSafeEqual(bufferA, bufferB);
  } catch (error) {
    // If any error occurs during comparison, return false
    return false;
  }
}
