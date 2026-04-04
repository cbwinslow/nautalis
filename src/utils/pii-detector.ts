/**
 * Simple PII detection and redaction utility.
 * Uses regex patterns to identify and mask common sensitive data.
 */

// Regex patterns for common PII
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const CREDIT_CARD_REGEX = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
const API_KEY_REGEX = /(sk|pk|rk)_[a-zA-Z0-9]{24,}/gi;
const PASSWORD_IN_URL_REGEX = /(:\/\/[^:]+:)[^@]+(@)/g; // captures password in URL: https://user:password@host

/**
 * Redacts PII from a string, replacing with placeholders.
 * Returns the original string if no PII found.
 */
export function redactString(text: string): string {
  if (typeof text !== 'string') {
    return text;
  }

  let redacted = text;

  // Email addresses -> [EMAIL]
  redacted = redacted.replace(EMAIL_REGEX, '[EMAIL]');

  // Phone numbers -> [PHONE]
  redacted = redacted.replace(PHONE_REGEX, '[PHONE]');

  // Credit card numbers -> [CREDIT_CARD]
  redacted = redacted.replace(CREDIT_CARD_REGEX, '[CREDIT_CARD]');

  // API keys (OpenAI-style) -> [API_KEY]
  redacted = redacted.replace(API_KEY_REGEX, '[API_KEY]');

  // Passwords in URLs: e.g., https://user:password@host -> https://user:[PASSWORD]@host
  redacted = redacted.replace(PASSWORD_IN_URL_REGEX, (match, p1, p2) => `${p1}[PASSWORD]${p2}`);

  return redacted;
}

/**
 * Recursively redacts PII from an object, array, or primitive.
 * Creates a new object/array, does not mutate the original.
 */
export function redactSensitiveData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return redactString(data);
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item));
  }

  if (typeof data === 'object') {
    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      redacted[key] = redactSensitiveData(value);
    }
    return redacted;
  }

  // Numbers, booleans, etc. unchanged
  return data;
}
