/**
 * Retry utilities for handling transient failures
 */

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
  retryCondition?: (error: Error) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  retryCondition: (error: Error) => {
    // Default: retry on network errors, timeouts, and server errors
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'TIMEOUT',
      'NETWORK_ERROR',
      'SERVER_ERROR'
    ];
    
    return retryableErrors.some(errorType => 
      error.message?.includes(errorType) || 
      error.name?.includes(errorType)
    );
  }
};

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on the last attempt
      if (attempt === opts.maxAttempts) {
        break;
      }
      
      // Check if we should retry this error
      if (opts.retryCondition && !opts.retryCondition(lastError)) {
        throw lastError;
      }
      
      // Call retry callback if provided
      if (opts.onRetry) {
        opts.onRetry(lastError, attempt);
      }
      
      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }
  
  // All attempts failed
  throw new RetryError(
    `Function failed after ${opts.maxAttempts} attempts. Last error: ${lastError?.message}`,
    opts.maxAttempts,
    lastError!
  );
}

/**
 * Retry with different strategies
 */
export async function retryWithLinearBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  return retry(fn, {
    maxAttempts,
    initialDelay: delay,
    maxDelay: delay,
    backoffFactor: 1,
    jitter: false
  });
}

export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  return retry(fn, {
    maxAttempts,
    initialDelay,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true
  });
}

/**
 * Retry only specific errors
 */
export async function retryOnSpecificErrors<T>(
  fn: () => Promise<T>,
  retryableErrorCodes: string[],
  maxAttempts: number = 3
): Promise<T> {
  return retry(fn, {
    maxAttempts,
    retryCondition: (error) => retryableErrorCodes.some(code => 
      error.message?.includes(code) || error.name?.includes(code)
    )
  });
}

/**
 * Retry HTTP requests
 */
export async function retryHttpRequest<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  return retry(fn, {
    maxAttempts,
    retryCondition: (error) => {
      // Retry on network errors and 5xx status codes
      const isNetworkError = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'].some(code =>
        error.message?.includes(code)
      );
      
      const isServerError = error.message?.includes('5') && 
        (error.message?.includes('500') || 
         error.message?.includes('502') || 
         error.message?.includes('503') || 
         error.message?.includes('504'));
      
      return isNetworkError || isServerError;
    }
  });
}

/**
 * Circuit breaker pattern
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000,
    private readonly monitoringPeriod: number = 120000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      
      if (this.state === 'half-open') {
        this.reset();
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }

    // Reset failure count after monitoring period
    setTimeout(() => {
      this.failures = Math.max(0, this.failures - 1);
    }, this.monitoringPeriod);
  }

  private reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }
}

/**
 * Utility functions
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  let delay = options.initialDelay * Math.pow(options.backoffFactor, attempt - 1);
  delay = Math.min(delay, options.maxDelay);
  
  if (options.jitter) {
    // Add ±25% jitter
    const jitterRange = delay * 0.25;
    delay += (Math.random() * 2 - 1) * jitterRange;
  }
  
  return Math.max(0, delay);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Decorator for adding retry logic to methods
 */
export function retryable(options: Partial<RetryOptions> = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return retry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}