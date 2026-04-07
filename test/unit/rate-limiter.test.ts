import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { RateLimiter } from '../../src/middleware/rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    // Fresh rate limiter for each test, 5 requests per 10 seconds
    limiter = new RateLimiter(5, 10000);
  });

  afterEach(() => {
    limiter.stop();
  });

  it('should allow up to maxRequests within window', async () => {
    for (let i = 0; i < 5; i++) {
      const allowed = await limiter.check('test-ip');
      expect(allowed).toBe(true);
    }
  });

  it('should reject when limit exceeded', async () => {
    // Allow up to max
    for (let i = 0; i < 5; i++) {
      expect(await limiter.check('test-ip')).toBe(true);
    }
    // Next should be rejected
    expect(await limiter.check('test-ip')).toBe(false);
  });

  it('should allow requests after window passes', async () => {
    const limiterFast = new RateLimiter(2, 1000); // 2 requests per 1 second
    expect(await limiterFast.check('ip')).toBe(true);
    expect(await limiterFast.check('ip')).toBe(true);
    expect(await limiterFast.check('ip')).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Should allow again
    expect(await limiterFast.check('ip')).toBe(true);
    limiterFast.stop();
  });

  it('should isolate different keys', async () => {
    // Exhaust limit for ip1 (maxRequests=5)
    for (let i = 0; i < 5; i++) {
      expect(await limiter.check('ip1')).toBe(true);
    }
    expect(await limiter.check('ip1')).toBe(false); // ip1 is now rate limited

    // ip2 should still be allowed (separate bucket)
    expect(await limiter.check('ip2')).toBe(true);
  });

  it('getCount should return current request count in window', async () => {
    expect(limiter.getCount('ip')).toBe(0);
    await limiter.check('ip');
    expect(limiter.getCount('ip')).toBe(1);
    await limiter.check('ip');
    expect(limiter.getCount('ip')).toBe(2);
  });
});
