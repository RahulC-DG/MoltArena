import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize user input to prevent XSS attacks
 * Uses DOMPurify to strip malicious HTML/JavaScript
 *
 * Security: Required for all user-generated content before storage
 */
export function sanitizeInput(input: string): string {
  // DOMPurify.sanitize removes all potentially dangerous content
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // Strip all HTML tags
    ALLOWED_ATTR: [], // Strip all attributes
  }).trim();
}

/**
 * Sanitize an object's string fields
 * Recursively sanitizes all string values in an object
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T
): T {
  const sanitized = { ...obj };

  for (const key in sanitized) {
    const value = sanitized[key];

    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value) as any;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value) as any;
    }
  }

  return sanitized;
}
