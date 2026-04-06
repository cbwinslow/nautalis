import { describe, it, expect, vi, beforeEach } from 'bun:test';
import { createSpan, recordMetric, logMessage } from '../../src/telemetry/api.js';

describe('Telemetry API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSpan', () => {
    it('should create a span object with end method', () => {
      const span = createSpan('test.operation', { key: 'value' });
      expect(span).toHaveProperty('end');
      expect(span).toHaveProperty('span');
    });

    it('should allow ending span without error', () => {
      const span = createSpan('test');
      expect(() => span.end()).not.toThrow();
    });
  });

  describe('recordMetric', () => {
    it('should not throw when recording counter', () => {
      expect(() => recordMetric('test.count', 1, { teamId: 'test' })).not.toThrow();
    });

    it('should not throw when recording histogram', () => {
      expect(() => recordMetric('test.latency_ms', 100, { operation: 'test' })).not.toThrow();
    });
  });

  describe('logMessage', () => {
    it('should log info without throwing', () => {
      expect(() => logMessage('info', 'Test message')).not.toThrow();
    });

    it('should log error with error object without throwing', () => {
      const err = new Error('Test error');
      expect(() => logMessage('error', 'Error occurred', { error: err })).not.toThrow();
    });
  });
});
