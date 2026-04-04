import { describe, it, expect } from 'bun:test';
import { redactString, redactSensitiveData } from '../../src/utils/pii-detector.ts';

describe('PII Detector', () => {
  describe('redactString', () => {
    it('should redact email addresses', () => {
      const input = 'Contact me at user@example.com for info';
      const result = redactString(input);
      expect(result).toContain('[EMAIL]');
      expect(result).not.toContain('user@example.com');
    });

    it('should redact phone numbers', () => {
      const input = 'Call me at 555-123-4567 or (555) 123-4567';
      const result = redactString(input);
      expect(result).toContain('[PHONE]');
      expect(result).not.toMatch(/\d{3}-\d{3}-\d{4}/);
    });

    it('should redact credit card numbers', () => {
      const input = 'Payment with 4111-1111-1111-1111';
      const result = redactString(input);
      expect(result).toContain('[CREDIT_CARD]');
    });

    it('should redact API keys (OpenAI style)', () => {
      const input = 'sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
      const result = redactString(input);
      expect(result).toContain('[API_KEY]');
      expect(result).not.toContain('sk-');
    });

    it('should redact passwords in URLs', () => {
      const input = 'https://user:secretpass@example.com';
      const result = redactString(input);
      expect(result).toContain('[PASSWORD]');
      expect(result).not.toContain('secretpass');
    });

    it('should redact multiple types in one string', () => {
      const input = 'Email: test@test.com, Phone: 555-123-4567, Key: sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
      const result = redactString(input);
      expect(result).toContain('[EMAIL]');
      expect(result).toContain('[PHONE]');
      expect(result).toContain('[API_KEY]');
      expect(result).not.toContain('test@test.com');
      expect(result).not.toContain('555-123-4567');
      expect(result).not.toContain('sk-');
    });

    it('should return original string if no PII found', () => {
      const input = 'Hello world, nothing sensitive here';
      const result = redactString(input);
      expect(result).toBe(input);
    });
  });

  describe('redactSensitiveData', () => {
    it('should redact strings in an object', () => {
      const obj = {
        name: 'John',
        email: 'john@example.com',
        metadata: {
          phone: '555-123-4567',
        },
      };
      const result = redactSensitiveData(obj);
      expect(result.email).toBe('[EMAIL]');
      expect(result.metadata.phone).toBe('[PHONE]');
    });

    it('should redact arrays', () => {
      const arr = ['test@example.com', 'normal text', '4111-1111-1111-1111'];
      const result = redactSensitiveData(arr);
      expect(result[0]).toBe('[EMAIL]');
      expect(result[2]).toBe('[CREDIT_CARD]');
      expect(result[1]).toBe('normal text');
    });

    it('should leave numbers and booleans unchanged', () => {
      const data = { count: 42, active: true };
      const result = redactSensitiveData(data);
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
    });
  });
});
