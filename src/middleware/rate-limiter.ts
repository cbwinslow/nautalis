/**
 * Simple in-memory rate limiter using sliding window log algorithm
 */

interface RateLimitRecord {
  timestamps: number[];
}

export class RateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private cleanupInterval: NodeJS.Timeout;
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Periodically clean up old entries to prevent memory growth
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000); // every 5 minutes
  }

  /**
   * Check if a request from the given key (e.g., IP) should be allowed.
   * Returns true if allowed, false if rate limited.
   */
  async check(key: string): Promise<boolean> {
    const now = Date.now();
    const record = this.records.get(key) || { timestamps: [] };

    // Filter out timestamps outside the window
    const cutoff = now - this.windowMs;
    const recent = record.timestamps.filter((ts) => ts > cutoff);

    if (recent.length >= this.maxRequests) {
      // Rate limited
      return false;
    }

    // Allow: add current timestamp
    recent.push(now);
    record.timestamps = recent;
    this.records.set(key, record);
    return true;
  }

  /**
   * Get current request count for a key in the current window (for metrics/logging)
   */
  getCount(key: string): number {
    const record = this.records.get(key);
    if (!record) return 0;
    const cutoff = Date.now() - this.windowMs;
    return record.timestamps.filter((ts) => ts > cutoff).length;
  }

  /**
   * Clean up old entries to free memory
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, record] of this.records.entries()) {
      const active = record.timestamps.filter((ts) => ts > cutoff);
      if (active.length === 0) {
        this.records.delete(key);
      } else {
        record.timestamps = active;
      }
    }
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  stop(): void {
    clearInterval(this.cleanupInterval);
  }
}
