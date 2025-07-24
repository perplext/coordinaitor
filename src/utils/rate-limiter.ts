/**
 * Rate limiting utilities
 */

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (identifier: string) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (identifier: string) => void;
}

export interface RateLimitInfo {
  totalHits: number;
  totalHitsInWindow: number;
  remainingHits: number;
  resetTime: Date;
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly identifier: string,
    public readonly resetTime: Date,
    public readonly remainingHits: number = 0
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Token bucket rate limiter
 */
export class TokenBucketLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();

  constructor(
    private readonly capacity: number,
    private readonly refillRate: number, // tokens per second
    private readonly refillInterval: number = 1000 // milliseconds
  ) {}

  async consume(identifier: string, tokens: number = 1): Promise<boolean> {
    const now = Date.now();
    let bucket = this.buckets.get(identifier);

    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(identifier, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed / this.refillInterval) * (this.refillRate * this.refillInterval / 1000);
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Check if we have enough tokens
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  getRemainingTokens(identifier: string): number {
    const bucket = this.buckets.get(identifier);
    return bucket?.tokens || this.capacity;
  }

  reset(identifier?: string): void {
    if (identifier) {
      this.buckets.delete(identifier);
    } else {
      this.buckets.clear();
    }
  }
}

/**
 * Sliding window rate limiter
 */
export class SlidingWindowLimiter {
  private windows = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number
  ) {}

  async isAllowed(identifier: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    let requests = this.windows.get(identifier) || [];
    
    // Remove old requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if we're under the limit
    if (requests.length < this.maxRequests) {
      requests.push(now);
      this.windows.set(identifier, requests);
      return true;
    }

    return false;
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const requests = this.windows.get(identifier) || [];
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  getResetTime(identifier: string): Date {
    const requests = this.windows.get(identifier) || [];
    if (requests.length === 0) {
      return new Date();
    }
    
    const oldestRequest = Math.min(...requests);
    return new Date(oldestRequest + this.windowMs);
  }

  reset(identifier?: string): void {
    if (identifier) {
      this.windows.delete(identifier);
    } else {
      this.windows.clear();
    }
  }
}

/**
 * Fixed window rate limiter
 */
export class FixedWindowLimiter {
  private windows = new Map<string, { count: number; resetTime: number }>();

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number
  ) {}

  async isAllowed(identifier: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const resetTime = windowStart + this.windowMs;
    
    let window = this.windows.get(identifier);
    
    if (!window || window.resetTime <= now) {
      window = { count: 0, resetTime };
      this.windows.set(identifier, window);
    }

    if (window.count < this.maxRequests) {
      window.count++;
      return true;
    }

    return false;
  }

  getRemainingRequests(identifier: string): number {
    const window = this.windows.get(identifier);
    if (!window || window.resetTime <= Date.now()) {
      return this.maxRequests;
    }
    
    return Math.max(0, this.maxRequests - window.count);
  }

  getResetTime(identifier: string): Date {
    const window = this.windows.get(identifier);
    return new Date(window?.resetTime || Date.now() + this.windowMs);
  }

  reset(identifier?: string): void {
    if (identifier) {
      this.windows.delete(identifier);
    } else {
      this.windows.clear();
    }
  }
}

/**
 * Composite rate limiter that applies multiple limits
 */
export class CompositeRateLimiter {
  constructor(private readonly limiters: Array<{ limiter: any; name: string }>) {}

  async isAllowed(identifier: string): Promise<{ allowed: boolean; limitedBy?: string }> {
    for (const { limiter, name } of this.limiters) {
      const allowed = await limiter.isAllowed(identifier);
      if (!allowed) {
        return { allowed: false, limitedBy: name };
      }
    }
    
    return { allowed: true };
  }
}

/**
 * Rate limiting middleware factory
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  const limiter = new SlidingWindowLimiter(options.windowMs, options.maxRequests);

  return async (identifier: string): Promise<RateLimitInfo> => {
    const keyGen = options.keyGenerator || ((id: string) => id);
    const key = keyGen(identifier);

    const allowed = await limiter.isAllowed(key);
    
    if (!allowed) {
      if (options.onLimitReached) {
        options.onLimitReached(identifier);
      }
      
      throw new RateLimitError(
        `Rate limit exceeded for ${identifier}`,
        identifier,
        limiter.getResetTime(key),
        limiter.getRemainingRequests(key)
      );
    }

    return {
      totalHits: options.maxRequests - limiter.getRemainingRequests(key),
      totalHitsInWindow: options.maxRequests - limiter.getRemainingRequests(key),
      remainingHits: limiter.getRemainingRequests(key),
      resetTime: limiter.getResetTime(key)
    };
  };
}

/**
 * Agent-specific rate limiters
 */
export class AgentRateLimiter {
  private limiters = new Map<string, TokenBucketLimiter>();

  constructor(
    private readonly defaultCapacity: number = 10,
    private readonly defaultRefillRate: number = 1
  ) {}

  addAgent(agentId: string, capacity?: number, refillRate?: number): void {
    const limiter = new TokenBucketLimiter(
      capacity || this.defaultCapacity,
      refillRate || this.defaultRefillRate
    );
    this.limiters.set(agentId, limiter);
  }

  async canExecuteTask(agentId: string, taskWeight: number = 1): Promise<boolean> {
    const limiter = this.limiters.get(agentId);
    if (!limiter) {
      // If no specific limiter, allow the task
      return true;
    }

    return limiter.consume(agentId, taskWeight);
  }

  getRemainingCapacity(agentId: string): number {
    const limiter = this.limiters.get(agentId);
    return limiter?.getRemainingTokens(agentId) || this.defaultCapacity;
  }

  resetAgent(agentId: string): void {
    const limiter = this.limiters.get(agentId);
    limiter?.reset(agentId);
  }
}

/**
 * Adaptive rate limiter that adjusts based on system load
 */
export class AdaptiveRateLimiter {
  private currentLimit: number;
  private measurements: number[] = [];
  private lastAdjustment = Date.now();

  constructor(
    private readonly baseLimit: number,
    private readonly minLimit: number = Math.floor(baseLimit * 0.1),
    private readonly maxLimit: number = baseLimit * 2,
    private readonly adjustmentInterval: number = 30000 // 30 seconds
  ) {
    this.currentLimit = baseLimit;
  }

  async isAllowed(identifier: string, systemLoad: number): Promise<boolean> {
    this.recordMeasurement(systemLoad);
    this.adjustLimit();

    // Use sliding window with current limit
    const limiter = new SlidingWindowLimiter(60000, this.currentLimit);
    return limiter.isAllowed(identifier);
  }

  private recordMeasurement(systemLoad: number): void {
    this.measurements.push(systemLoad);
    
    // Keep only recent measurements (last 5 minutes)
    if (this.measurements.length > 300) {
      this.measurements = this.measurements.slice(-300);
    }
  }

  private adjustLimit(): void {
    const now = Date.now();
    if (now - this.lastAdjustment < this.adjustmentInterval) {
      return;
    }

    if (this.measurements.length < 10) {
      return;
    }

    const avgLoad = this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length;
    
    // Adjust limit based on system load
    if (avgLoad > 0.8) {
      // High load: decrease limit
      this.currentLimit = Math.max(this.minLimit, this.currentLimit * 0.9);
    } else if (avgLoad < 0.3) {
      // Low load: increase limit
      this.currentLimit = Math.min(this.maxLimit, this.currentLimit * 1.1);
    }

    this.currentLimit = Math.floor(this.currentLimit);
    this.lastAdjustment = now;
  }

  getCurrentLimit(): number {
    return this.currentLimit;
  }
}