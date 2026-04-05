import { test, expect } from "bun:test";
import {
  withRetry,
  CircuitBreaker,
  CircuitBreakerError,
  RetryError,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from "../../src/utils/resilience.js";

test('withRetry: succeeds on first try', async () => {
  let callCount = 0;
  const fn = async () => { callCount++; return 'ok'; };
  const result = await withRetry(fn);
  expect(result).toBe('ok');
  expect(callCount).toBe(1);
});

test('withRetry: retries on failure and eventually succeeds', async () => {
  let callCount = 0;
  const fn = async () => {
    callCount++;
    if (callCount === 1) throw new Error('fail1');
    if (callCount === 2) throw new Error('fail2');
    return 'ok';
  };
  const result = await withRetry(fn, { ...DEFAULT_RETRY_CONFIG, maxAttempts: 3 });
  expect(result).toBe('ok');
  expect(callCount).toBe(3);
});

test('withRetry: throws RetryError after all attempts fail', async () => {
  let callCount = 0;
  const fn = async () => {
    callCount++;
    throw new Error('persistent fail');
  };
  await expect(withRetry(fn, { ...DEFAULT_RETRY_CONFIG, maxAttempts: 2 })).rejects.toThrow(RetryError);
  expect(callCount).toBe(2);
});

test('withRetry: does not retry CircuitBreakerError', async () => {
  const fn = async () => { throw new CircuitBreakerError('open', 'open', 5); };
  await expect(withRetry(fn)).rejects.toThrow(CircuitBreakerError);
});

test('withRetry: respects custom retry config', async () => {
  let callCount = 0;
  const fn = async () => {
    callCount++;
    if (callCount === 1) throw new Error('fail');
    return 'ok';
  };
  const result = await withRetry(fn, { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 10, backoffFactor: 2 });
  expect(result).toBe('ok');
  expect(callCount).toBe(2);
});

// CircuitBreaker tests
test('CircuitBreaker: initial state is closed', () => {
  const cb = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG, 'test');
  expect(cb.getState()).toBe('closed');
  expect(cb.getFailureCount()).toBe(0);
});

test('CircuitBreaker: successful execution does not change state', async () => {
  const cb = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG, 'test');
  const fn = async () => 'ok';
  const result = await cb.execute(fn);
  expect(result).toBe('ok');
  expect(cb.getState()).toBe('closed');
  expect(cb.getFailureCount()).toBe(0);
});

test('CircuitBreaker: failure increments count but stays closed until threshold', async () => {
  const cb = new CircuitBreaker({ ...DEFAULT_CIRCUIT_BREAKER_CONFIG, failureThreshold: 3 }, 'test');
  const fn = async () => { throw new Error('fail'); };
  for (let i = 0; i < 2; i++) {
    await expect(cb.execute(fn)).rejects.toThrow();
  }
  expect(cb.getFailureCount()).toBe(2);
  expect(cb.getState()).toBe('closed');
});

test('CircuitBreaker: opens circuit when failure threshold reached', async () => {
  const cb = new CircuitBreaker({ ...DEFAULT_CIRCUIT_BREAKER_CONFIG, failureThreshold: 2 }, 'test');
  const fn = async () => { throw new Error('fail'); };
  await expect(cb.execute(fn)).rejects.toThrow();
  await expect(cb.execute(fn)).rejects.toThrow();
  expect(cb.getState()).toBe('open');
  expect(cb.getFailureCount()).toBe(2);
});

test('CircuitBreaker: throws CircuitBreakerError when open', async () => {
  const cb = new CircuitBreaker({ ...DEFAULT_CIRCUIT_BREAKER_CONFIG, failureThreshold: 1, resetTimeoutMs: 1000 }, 'test');
  const fn = async () => { throw new Error('fail'); };
  await expect(cb.execute(fn)).rejects.toThrow(); // opens circuit
  await expect(cb.execute(fn)).rejects.toThrow(CircuitBreakerError);
});

test('CircuitBreaker: half-open transition after manually adjusting time', async () => {
  const cb = new CircuitBreaker({ ...DEFAULT_CIRCUIT_BREAKER_CONFIG, failureThreshold: 1, resetTimeoutMs: 50 }, 'test');
  const succeed = async () => 'ok';
  // Simulate open circuit with old lastFailureTime
  (cb as any).state = 'open';
  (cb as any).lastFailureTime = Date.now() - 100;
  const result = await cb.execute(succeed);
  expect(result).toBe('ok');
  // After the attempt, state should have transitioned to half-open
  expect(cb.getState()).toBe('half-open');
});

test('CircuitBreaker: half-open success resets circuit after enough calls', async () => {
  const cb = new CircuitBreaker({ ...DEFAULT_CIRCUIT_BREAKER_CONFIG, failureThreshold: 1, resetTimeoutMs: 50, halfOpenMaxCalls: 2 }, 'test');
  // Manually set to half-open
  (cb as any).state = 'half-open';
  (cb as any).halfOpenCalls = 0;
  const succeed = async () => 'ok';
  // First success
  await cb.execute(succeed);
  expect(cb.getState()).toBe('half-open');
  expect(cb.getFailureCount()).toBe(0);
  // Second success should reset
  await cb.execute(succeed);
  expect(cb.getState()).toBe('closed');
  expect(cb.getFailureCount()).toBe(0);
});

test('CircuitBreaker: half-open failure reopens circuit', async () => {
  const cb = new CircuitBreaker({ ...DEFAULT_CIRCUIT_BREAKER_CONFIG, failureThreshold: 1, resetTimeoutMs: 50, halfOpenMaxCalls: 2 }, 'test');
  // Manually set to half-open
  (cb as any).state = 'half-open';
  (cb as any).halfOpenCalls = 0;
  const fail = async () => { throw new Error('fail'); };
  await expect(cb.execute(fail)).rejects.toThrow();
  expect(cb.getState()).toBe('open');
});

test('CircuitBreaker: reset() brings circuit back to closed', () => {
  const cb = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG, 'test');
  (cb as any).failureCount = 5;
  (cb as any).state = 'open' as any;
  cb.reset();
  expect(cb.getState()).toBe('closed');
  expect(cb.getFailureCount()).toBe(0);
});
