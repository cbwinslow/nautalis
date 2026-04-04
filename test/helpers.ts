/**
 * Test helper utilities
 */

import { createSpan, recordMetric, logMessage } from '@/telemetry/api.js';
import type { Memory } from '@/types/memory.js';

/**
 * Silence telemetry during tests
 */
export function disableTelemetry() {
  // Set environment variable to disable OTLP export
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'none';
  process.env.NAUTALIS_TELEMETRY_ENABLED = 'false';
}

/**
 * Enable verbose logging for debugging tests
 */
export function enableVerboseLogging() {
  process.env.NAUTALIS_LOG_LEVEL = 'debug';
}

/**
 * Cleanup function to reset test state
 */
export async function cleanupTestData(store: any): Promise<void> {
  // Clean up test data from database
  // This should be implemented per test suite based on what was inserted
  try {
    await store.close();
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100,
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry(
  fn: () => Promise<any>,
  maxAttempts: number = 3,
  initialDelayMs: number = 100,
): Promise<any> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts - 1) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Mock OpenTelemetry spans for testing
 */
export function createMockSpan(name: string, attributes?: Record<string, any>) {
  const span = {
    name,
    attributes: attributes || {},
    startTime: Date.now(),
    endTime: null as number | null,
    ended: false,
    status: { code: 0, message: '' } as { code: number; message: string },

    end(error?: Error) {
      this.endTime = Date.now();
      this.ended = true;
      if (error) {
        this.status = { code: 2, message: error.message };
      }
    },

    setAttribute(key: string, value: any) {
      this.attributes[key] = value;
    },

    recordMetric(name: string, value: number, unit?: string) {
      // No-op in tests
    },
  };

  return span;
}

/**
 * Assert that a memory has required fields
 */
export function assertValidMemory(memory: Memory): void {
  expect(memory.id).toBeDefined();
  expect(memory.agentId).toBeDefined();
  expect(memory.agentType).toBeDefined();
  expect(memory.userId).toBeDefined();
  expect(memory.sessionId).toBeDefined();
  expect(memory.project).toBeDefined();
  expect(memory.summary).toBeDefined();
  expect(memory.detail).toBeDefined();
  expect(memory.embedding).toBeDefined();
  expect(memory.embedding).toHaveLength(384);
  expect(memory.category).toBeDefined();
  expect(memory.importance).toBeDefined();
  expect(memory.sensitivity).toBeDefined();
  expect(memory.status).toBe('active');
  expect(memory.createdAt).toBeInstanceOf(Date);
  expect(memory.updatedAt).toBeInstanceOf(Date);
}

/**
 * Generate a unique test identifier
 */
export function testId(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
