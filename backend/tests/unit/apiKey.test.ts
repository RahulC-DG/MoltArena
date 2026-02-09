import { generateApiKey, extractApiKey } from '../../src/utils/apiKey';

describe('API Key Generation', () => {
  describe('generateApiKey', () => {
    it('should generate API key with correct format', () => {
      const apiKey = generateApiKey();
      expect(apiKey).toMatch(/^moltarena_sk_[A-Za-z0-9_-]{43}$/);
    });

    it('should generate unique API keys', () => {
      const keys = new Set<string>();
      const numKeys = 1000;

      for (let i = 0; i < numKeys; i++) {
        keys.add(generateApiKey());
      }

      expect(keys.size).toBe(numKeys); // All keys should be unique
    });

    it('should generate keys with sufficient entropy', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      const key3 = generateApiKey();

      // Keys should be completely different
      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);

      // Extract the random part (after "moltarena_sk_")
      const random1 = key1.split('_')[2];
      const random2 = key2.split('_')[2];
      const random3 = key3.split('_')[2];

      // Random parts should have no overlap
      expect(random1).not.toBe(random2);
      expect(random2).not.toBe(random3);
    });

    it('should generate keys with correct length', () => {
      const apiKey = generateApiKey();
      // moltarena_sk_ (14 chars) + 43 base64url chars = 57 total
      expect(apiKey.length).toBeGreaterThanOrEqual(55);
      expect(apiKey.length).toBeLessThanOrEqual(60);
    });
  });

  describe('extractApiKey', () => {
    it('should extract valid API key from Bearer token', () => {
      const apiKey = 'moltarena_sk_testkey123';
      const authHeader = `Bearer ${apiKey}`;

      const extracted = extractApiKey(authHeader);
      expect(extracted).toBe(apiKey);
    });

    it('should return null for missing header', () => {
      const extracted = extractApiKey(undefined);
      expect(extracted).toBeNull();
    });

    it('should return null for invalid format (no Bearer)', () => {
      const extracted = extractApiKey('moltarena_sk_testkey123');
      expect(extracted).toBeNull();
    });

    it('should return null for invalid prefix', () => {
      const authHeader = 'Bearer invalid_key_format';
      const extracted = extractApiKey(authHeader);
      expect(extracted).toBeNull();
    });

    it('should return null for malformed Bearer token', () => {
      const authHeader = 'Bearer';
      const extracted = extractApiKey(authHeader);
      expect(extracted).toBeNull();
    });

    it('should handle extra spaces gracefully', () => {
      const authHeader = 'Bearer  moltarena_sk_testkey123';
      const extracted = extractApiKey(authHeader);
      expect(extracted).toBeNull(); // Should be null due to multiple spaces
    });
  });
});
