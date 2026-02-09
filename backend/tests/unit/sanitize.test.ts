import { sanitizeInput, sanitizeObject } from '../../src/utils/sanitize';

describe('Input Sanitization', () => {
  describe('sanitizeInput', () => {
    it('should remove script tags (XSS prevention)', () => {
      const malicious = '<script>alert("XSS")</script>Hello';
      const sanitized = sanitizeInput(malicious);
      expect(sanitized).toBe('Hello');
      expect(sanitized).not.toContain('<script>');
    });

    it('should remove img tags with onerror (XSS prevention)', () => {
      const malicious = '<img src=x onerror="alert(1)">Test';
      const sanitized = sanitizeInput(malicious);
      expect(sanitized).not.toContain('<img');
      expect(sanitized).not.toContain('onerror');
    });

    it('should remove all HTML tags', () => {
      const input = '<div><p>Hello <b>World</b></p></div>';
      const sanitized = sanitizeInput(input);
      expect(sanitized).toBe('Hello World');
    });

    it('should preserve plain text', () => {
      const input = 'This is plain text without HTML';
      const sanitized = sanitizeInput(input);
      expect(sanitized).toBe(input);
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const sanitized = sanitizeInput(input);
      expect(sanitized).toBe('Hello World');
    });

    it('should handle empty strings', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput('   ')).toBe('');
    });

    it('should remove javascript: protocol', () => {
      const malicious = '<a href="javascript:alert(1)">Click</a>';
      const sanitized = sanitizeInput(malicious);
      expect(sanitized).not.toContain('javascript:');
    });

    it('should handle SQL injection attempts (though backend uses Prisma)', () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const sanitized = sanitizeInput(sqlInjection);
      // Should preserve the text but without any dangerous context
      expect(sanitized).toContain('DROP TABLE users');
    });

    it('should handle unicode and special characters safely', () => {
      const input = 'Test 你好 🔑 café';
      const sanitized = sanitizeInput(input);
      expect(sanitized).toBe(input);
    });

    it('should prevent CSS injection', () => {
      const malicious = '<style>body { display: none; }</style>Content';
      const sanitized = sanitizeInput(malicious);
      expect(sanitized).not.toContain('<style>');
      expect(sanitized).toBe('Content');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string fields in an object', () => {
      const input = {
        name: '<script>alert(1)</script>test',
        description: '<b>Bold</b> text',
        number: 123,
      };

      const sanitized = sanitizeObject(input);
      expect(sanitized.name).toBe('test');
      expect(sanitized.description).toBe('Bold text');
      expect(sanitized.number).toBe(123);
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '<script>XSS</script>John',
          profile: {
            bio: '<img src=x onerror=alert(1)>Dev',
          },
        },
      };

      const sanitized = sanitizeObject(input);
      expect(sanitized.user.name).toBe('John');
      expect(sanitized.user.profile.bio).toBe('Dev');
    });

    it('should preserve non-string values', () => {
      const input = {
        string: '<b>text</b>',
        number: 42,
        boolean: true,
        nullValue: null,
        undefined: undefined,
      };

      const sanitized = sanitizeObject(input);
      expect(sanitized.string).toBe('text');
      expect(sanitized.number).toBe(42);
      expect(sanitized.boolean).toBe(true);
      expect(sanitized.nullValue).toBeNull();
      expect(sanitized.undefined).toBeUndefined();
    });

    it('should handle empty objects', () => {
      const sanitized = sanitizeObject({});
      expect(sanitized).toEqual({});
    });
  });
});
