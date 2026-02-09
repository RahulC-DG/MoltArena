import { timingSafeCompare } from '../../src/utils/timing';

describe('Timing-Safe Comparison', () => {
  describe('timingSafeCompare', () => {
    it('should return true for identical strings', () => {
      const str = 'moltarena_sk_testkey123';
      expect(timingSafeCompare(str, str)).toBe(true);
    });

    it('should return false for different strings', () => {
      const str1 = 'moltarena_sk_testkey123';
      const str2 = 'moltarena_sk_testkey456';
      expect(timingSafeCompare(str1, str2)).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      const str1 = 'short';
      const str2 = 'longer string';
      expect(timingSafeCompare(str1, str2)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(timingSafeCompare('', '')).toBe(true);
      expect(timingSafeCompare('', 'nonempty')).toBe(false);
    });

    it('should be case-sensitive', () => {
      const str1 = 'TestKey';
      const str2 = 'testkey';
      expect(timingSafeCompare(str1, str2)).toBe(false);
    });

    it('should handle unicode characters', () => {
      const str1 = 'test🔑key';
      const str2 = 'test🔑key';
      expect(timingSafeCompare(str1, str2)).toBe(true);
    });

    it('should not leak timing information (basic test)', () => {
      // This is a basic test - timing attacks are hard to test in unit tests
      // The important thing is we use crypto.timingSafeEqual under the hood
      const correct = 'a'.repeat(100);
      const wrong1 = 'b' + 'a'.repeat(99); // Wrong first char
      const wrong2 = 'a'.repeat(99) + 'b'; // Wrong last char

      // Both should return false regardless of position
      expect(timingSafeCompare(correct, wrong1)).toBe(false);
      expect(timingSafeCompare(correct, wrong2)).toBe(false);
    });

    it('should handle special characters', () => {
      const str1 = 'test!@#$%^&*()_+-=[]{}|;:",.<>?/`~';
      const str2 = 'test!@#$%^&*()_+-=[]{}|;:",.<>?/`~';
      expect(timingSafeCompare(str1, str2)).toBe(true);
    });

    it('should return false for null-like comparisons', () => {
      // These should be handled gracefully
      expect(timingSafeCompare('test', '')).toBe(false);
      expect(timingSafeCompare('', 'test')).toBe(false);
    });
  });
});
