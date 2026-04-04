/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 10000,
  backoffFactor: 2,
};

/**
 * Circuit breaker state
 */
type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenMaxCalls: 3,
};

/**
 * Retry error thrown when all retry attempts fail
 */
export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error,
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

/**
 * Circuit breaker error thrown when circuit is open
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitState,
    public readonly failureCount: number,
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof CircuitBreakerError) {
        throw error;
      }
      
      // If this was the last attempt, throw
      if (attempt >= config.maxAttempts - 1) {
        break;
      }
      
      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(
        config.initialDelayMs * Math.pow(config.backoffFactor, attempt) + Math.random() * 100,
        config.maxDelayMs,
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new RetryError(
    `Operation failed after ${config.maxAttempts} attempts`,
    config.maxAttempts,
    lastError!,
  );
}

/**
 * Circuit breaker for protecting external services
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime: number = 0;
  private halfOpenCalls = 0;
  
  constructor(
    private config: CircuitBreakerConfig,
    private name: string,
  ) {}
  
  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
        // Transition to half-open
        this.state = 'half-open';
        this.halfOpenCalls = 0;
      } else {
        throw new CircuitBreakerError(
          `Circuit breaker '${this.name}' is open`,
          this.state,
          this.failureCount,
        );
      }
    }
    
    try {
      const result = await fn();
      
      // Success - reset failure count if half-open
      if (this.state === 'half-open' || this.failureCount > 0) {
        this.onSuccess();
      }
      
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }
  
  /**
   * Reset circuit to closed state
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenCalls = 0;
  }
  
  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.halfOpenCalls++;
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.reset();
      }
    } else {
      this.failureCount = 0;
    }
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'closed' && this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
    } else if (this.state === 'half-open') {
      // Immediately back to open on any failure in half-open
      this.state = 'open';
    }
  }
}
