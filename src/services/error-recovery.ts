import { createLogger } from '../utils/logger';
import { retry, CircuitBreaker, RetryOptions } from '../utils/retry';
import { performanceMonitor } from '../monitoring/performance';
import { EventEmitter } from 'events';

const logger = createLogger({ module: 'error-recovery' });

export interface RecoveryStrategy {
  name: string;
  canRecover(error: Error): boolean;
  recover(error: Error, context?: any): Promise<void>;
}

export interface ErrorContext {
  service: string;
  operation: string;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
}

export class ErrorRecoveryService extends EventEmitter {
  private strategies: Map<string, RecoveryStrategy> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private errorThresholds: Map<string, number> = new Map();

  constructor() {
    super();
    this.setupDefaultStrategies();
    this.startErrorMonitoring();
  }

  private setupDefaultStrategies() {
    // Database connection recovery
    this.addStrategy({
      name: 'database-recovery',
      canRecover: (error) => {
        return error.message.includes('ECONNREFUSED') ||
               error.message.includes('Connection lost') ||
               error.message.includes('PROTOCOL_CONNECTION_LOST');
      },
      recover: async (error, context) => {
        logger.info('Attempting database recovery', { error: error.message });
        
        // Implement database reconnection logic
        await this.reconnectDatabase();
        
        // Clear connection pool
        await this.clearDatabasePool();
        
        // Verify connection
        await this.verifyDatabaseConnection();
        
        this.emit('recovery:success', { strategy: 'database-recovery', error });
      },
    });

    // Redis connection recovery
    this.addStrategy({
      name: 'redis-recovery',
      canRecover: (error) => {
        return error.message.includes('Redis connection') ||
               error.message.includes('ECONNREFUSED') && error.message.includes('6379');
      },
      recover: async (error, context) => {
        logger.info('Attempting Redis recovery', { error: error.message });
        
        await this.reconnectRedis();
        
        this.emit('recovery:success', { strategy: 'redis-recovery', error });
      },
    });

    // External API recovery
    this.addStrategy({
      name: 'api-recovery',
      canRecover: (error) => {
        return error.message.includes('ETIMEDOUT') ||
               error.message.includes('ENOTFOUND') ||
               (error.message.includes('status code') && error.message.includes('5'));
      },
      recover: async (error, context) => {
        logger.info('Attempting API recovery', { error: error.message });
        
        // Switch to backup endpoint if available
        if (context?.endpoint) {
          await this.switchToBackupEndpoint(context.endpoint);
        }
        
        // Clear cache for affected endpoints
        await this.clearApiCache(context?.endpoint);
        
        this.emit('recovery:success', { strategy: 'api-recovery', error });
      },
    });

    // Memory recovery
    this.addStrategy({
      name: 'memory-recovery',
      canRecover: (error) => {
        return error.message.includes('out of memory') ||
               error.message.includes('heap out of memory');
      },
      recover: async (error, context) => {
        logger.warn('Attempting memory recovery', { error: error.message });
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Clear caches
        await this.clearAllCaches();
        
        // Reduce worker pool size
        await this.reduceWorkerPoolSize();
        
        this.emit('recovery:success', { strategy: 'memory-recovery', error });
      },
    });

    // Task failure recovery
    this.addStrategy({
      name: 'task-recovery',
      canRecover: (error) => {
        return error.message.includes('Task failed') ||
               error.message.includes('Agent error');
      },
      recover: async (error, context) => {
        logger.info('Attempting task recovery', { 
          error: error.message,
          taskId: context?.taskId 
        });
        
        if (context?.taskId) {
          // Mark task for retry
          await this.markTaskForRetry(context.taskId);
          
          // Reassign to different agent if possible
          await this.reassignTask(context.taskId);
        }
        
        this.emit('recovery:success', { strategy: 'task-recovery', error });
      },
    });
  }

  addStrategy(strategy: RecoveryStrategy) {
    this.strategies.set(strategy.name, strategy);
    logger.info('Added recovery strategy', { name: strategy.name });
  }

  async handleError(error: Error, context: ErrorContext): Promise<boolean> {
    const errorKey = this.getErrorKey(error);
    this.incrementErrorCount(errorKey);

    logger.error('Handling error', error, context);

    // Check if circuit breaker is open
    const circuitBreaker = this.getCircuitBreaker(context.service);
    if (circuitBreaker.getState() === 'open') {
      logger.warn('Circuit breaker is open', { service: context.service });
      return false;
    }

    // Find applicable recovery strategies
    const applicableStrategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.canRecover(error));

    if (applicableStrategies.length === 0) {
      logger.warn('No recovery strategy found for error', { error: error.message });
      return false;
    }

    // Try recovery strategies
    for (const strategy of applicableStrategies) {
      try {
        await circuitBreaker.execute(async () => {
          await strategy.recover(error, context);
        });
        
        logger.info('Recovery successful', { 
          strategy: strategy.name,
          error: error.message 
        });
        
        this.resetErrorCount(errorKey);
        return true;
      } catch (recoveryError) {
        logger.error('Recovery strategy failed', recoveryError, {
          strategy: strategy.name,
          originalError: error.message,
        });
      }
    }

    return false;
  }

  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    try {
      return await retry(operation, {
        ...options,
        onRetry: async (error, attempt) => {
          logger.info('Retrying operation', {
            ...context,
            attempt,
            error: error.message,
          });
          
          // Try recovery between retries
          await this.handleError(error, context);
        },
      });
    } catch (error) {
      // Final recovery attempt
      const recovered = await this.handleError(error as Error, context);
      
      if (recovered) {
        // Retry once more after recovery
        return await operation();
      }
      
      throw error;
    }
  }

  private getCircuitBreaker(service: string): CircuitBreaker {
    if (!this.circuitBreakers.has(service)) {
      this.circuitBreakers.set(service, new CircuitBreaker());
    }
    return this.circuitBreakers.get(service)!;
  }

  private getErrorKey(error: Error): string {
    return `${error.name}:${error.message.split(' ').slice(0, 3).join(' ')}`;
  }

  private incrementErrorCount(errorKey: string) {
    const count = (this.errorCounts.get(errorKey) || 0) + 1;
    this.errorCounts.set(errorKey, count);
    
    const threshold = this.errorThresholds.get(errorKey) || 10;
    if (count >= threshold) {
      this.emit('error:threshold-exceeded', { errorKey, count, threshold });
    }
  }

  private resetErrorCount(errorKey: string) {
    this.errorCounts.delete(errorKey);
  }

  private startErrorMonitoring() {
    // Reset error counts periodically
    setInterval(() => {
      this.errorCounts.clear();
    }, 300000); // 5 minutes
  }

  // Recovery implementation methods
  private async reconnectDatabase(): Promise<void> {
    // Implementation would reconnect to database
    logger.info('Reconnecting to database');
  }

  private async clearDatabasePool(): Promise<void> {
    // Implementation would clear connection pool
    logger.info('Clearing database connection pool');
  }

  private async verifyDatabaseConnection(): Promise<void> {
    // Implementation would verify connection
    logger.info('Verifying database connection');
  }

  private async reconnectRedis(): Promise<void> {
    // Implementation would reconnect to Redis
    logger.info('Reconnecting to Redis');
  }

  private async switchToBackupEndpoint(endpoint: string): Promise<void> {
    // Implementation would switch to backup endpoint
    logger.info('Switching to backup endpoint', { endpoint });
  }

  private async clearApiCache(endpoint?: string): Promise<void> {
    // Implementation would clear API cache
    logger.info('Clearing API cache', { endpoint });
  }

  private async clearAllCaches(): Promise<void> {
    // Implementation would clear all caches
    logger.info('Clearing all caches');
  }

  private async reduceWorkerPoolSize(): Promise<void> {
    // Implementation would reduce worker pool size
    logger.info('Reducing worker pool size');
  }

  private async markTaskForRetry(taskId: string): Promise<void> {
    // Implementation would mark task for retry
    logger.info('Marking task for retry', { taskId });
  }

  private async reassignTask(taskId: string): Promise<void> {
    // Implementation would reassign task
    logger.info('Reassigning task', { taskId });
  }

  getStatus() {
    return {
      strategies: Array.from(this.strategies.keys()),
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([service, cb]) => ({
        service,
        state: cb.getState(),
        failures: cb.getFailureCount(),
      })),
      errorCounts: Object.fromEntries(this.errorCounts),
      uptime: process.uptime(),
    };
  }
}

// Singleton instance
export const errorRecovery = new ErrorRecoveryService();

// Graceful degradation decorator
export function gracefulDegradation(fallbackValue?: any) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        logger.warn('Method failed, using fallback', {
          method: propertyKey,
          error: (error as Error).message,
        });
        
        if (typeof fallbackValue === 'function') {
          return fallbackValue(error, ...args);
        }
        
        return fallbackValue;
      }
    };

    return descriptor;
  };
}

// Auto-recovery decorator
export function autoRecover(context: Partial<ErrorContext> = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const fullContext: ErrorContext = {
        service: target.constructor.name,
        operation: propertyKey,
        ...context,
      };

      return errorRecovery.executeWithRecovery(
        () => originalMethod.apply(this, args),
        fullContext
      );
    };

    return descriptor;
  };
}