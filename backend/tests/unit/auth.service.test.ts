import { hashApiKey, verifyApiKey, createApiKey } from '../../src/services/auth.service';

describe('Auth Service', () => {
  describe('hashApiKey', () => {
    it('should generate bcrypt hash with cost factor 12', async () => {
      const apiKey = 'moltarena_sk_testkey123';
      const hash = await hashApiKey(apiKey);

      // bcrypt hashes start with $2b$ (bcrypt identifier)
      expect(hash).toMatch(/^\$2[aby]\$/);

      // bcrypt cost factor appears after the second $
      // Format: $2b$12$... where 12 is the cost factor
      const costFactor = hash.split('$')[2];
      expect(costFactor).toBe('12');
    });

    it('should generate different hashes for same input (salt)', async () => {
      const apiKey = 'moltarena_sk_testkey123';
      const hash1 = await hashApiKey(apiKey);
      const hash2 = await hashApiKey(apiKey);

      // Hashes should be different due to salt
      expect(hash1).not.toBe(hash2);

      // But both should verify against the original key
      expect(await verifyApiKey(apiKey, hash1)).toBe(true);
      expect(await verifyApiKey(apiKey, hash2)).toBe(true);
    });

    it('should produce hash of expected length', async () => {
      const apiKey = 'moltarena_sk_testkey123';
      const hash = await hashApiKey(apiKey);

      // bcrypt hashes are always 60 characters
      expect(hash.length).toBe(60);
    });
  });

  describe('verifyApiKey', () => {
    it('should verify correct API key', async () => {
      const apiKey = 'moltarena_sk_testkey123';
      const hash = await hashApiKey(apiKey);

      const isValid = await verifyApiKey(apiKey, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect API key', async () => {
      const correctKey = 'moltarena_sk_testkey123';
      const wrongKey = 'moltarena_sk_wrongkey456';
      const hash = await hashApiKey(correctKey);

      const isValid = await verifyApiKey(wrongKey, hash);
      expect(isValid).toBe(false);
    });

    it('should reject slightly different API key (timing attack protection)', async () => {
      const correctKey = 'moltarena_sk_testkey123';
      const similarKey = 'moltarena_sk_testkey124'; // Only last digit different
      const hash = await hashApiKey(correctKey);

      const isValid = await verifyApiKey(similarKey, hash);
      expect(isValid).toBe(false);
    });

    it('should handle invalid hash gracefully', async () => {
      const apiKey = 'moltarena_sk_testkey123';
      const invalidHash = 'not-a-valid-bcrypt-hash';

      const isValid = await verifyApiKey(apiKey, invalidHash);
      expect(isValid).toBe(false);
    });

    it('should be case-sensitive', async () => {
      const apiKey = 'moltarena_sk_TestKey';
      const wrongCase = 'moltarena_sk_testkey';
      const hash = await hashApiKey(apiKey);

      expect(await verifyApiKey(apiKey, hash)).toBe(true);
      expect(await verifyApiKey(wrongCase, hash)).toBe(false);
    });
  });

  describe('createApiKey', () => {
    it('should generate API key and hash', async () => {
      const { apiKey, apiKeyHash } = await createApiKey();

      expect(apiKey).toMatch(/^moltarena_sk_[A-Za-z0-9_-]{43}$/);
      expect(apiKeyHash).toMatch(/^\$2[aby]\$/);
      expect(apiKeyHash.length).toBe(60);
    });

    it('should generate unique keys each time', async () => {
      const result1 = await createApiKey();
      const result2 = await createApiKey();

      expect(result1.apiKey).not.toBe(result2.apiKey);
      expect(result1.apiKeyHash).not.toBe(result2.apiKeyHash);
    });

    it('should generate verifiable key-hash pairs', async () => {
      const { apiKey, apiKeyHash } = await createApiKey();

      const isValid = await verifyApiKey(apiKey, apiKeyHash);
      expect(isValid).toBe(true);
    });

    it('should generate multiple unique keys rapidly', async () => {
      const keys = await Promise.all([
        createApiKey(),
        createApiKey(),
        createApiKey(),
        createApiKey(),
        createApiKey(),
      ]);

      const uniqueKeys = new Set(keys.map((k) => k.apiKey));
      expect(uniqueKeys.size).toBe(5);
    });
  });
});
