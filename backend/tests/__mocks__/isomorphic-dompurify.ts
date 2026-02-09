// Mock for isomorphic-dompurify to avoid ESM import issues in Jest

export default {
  sanitize: (input: string, config?: any) => {
    if (!config || !config.ALLOWED_TAGS || config.ALLOWED_TAGS.length === 0) {
      // Strip all HTML tags AND their contents for script/style tags
      let result = input;

      // Remove script tags and their content
      result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

      // Remove style tags and their content
      result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

      // Remove all other HTML tags (but keep their text content)
      result = result.replace(/<[^>]*>/g, '');

      return result.trim();
    }
    return input.replace(/<[^>]*>/g, '').trim();
  },
};
