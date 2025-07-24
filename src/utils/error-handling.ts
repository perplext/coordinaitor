/**
 * Error handling utilities
 */

export interface ErrorContext {
  operation: string;
  userId?: string;
  taskId?: string;
  agentId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SerializableError {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  statusCode?: number;
  context?: ErrorContext;
  cause?: SerializableError;
}

/**
 * Custom error classes
 */
export class BaseError extends Error {
  public readonly context?: ErrorContext;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: ErrorContext
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 400, true, context);
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication failed', context?: ErrorContext) {
    super(message, 401, true, context);
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string = 'Insufficient permissions', context?: ErrorContext) {
    super(message, 403, true, context);
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string, context?: ErrorContext) {
    super(`${resource} not found`, 404, true, context);
  }
}

export class ConflictError extends BaseError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 409, true, context);
  }
}

export class RateLimitError extends BaseError {
  constructor(message: string = 'Rate limit exceeded', context?: ErrorContext) {
    super(message, 429, true, context);
  }
}

export class ExternalServiceError extends BaseError {
  constructor(service: string, message: string, context?: ErrorContext) {
    super(`${service} service error: ${message}`, 502, true, context);
  }
}

export class TimeoutError extends BaseError {
  constructor(operation: string, timeout: number, context?: ErrorContext) {
    super(`Operation '${operation}' timed out after ${timeout}ms`, 408, true, context);
  }
}

export class ConfigurationError extends BaseError {
  constructor(message: string, context?: ErrorContext) {
    super(`Configuration error: ${message}`, 500, false, context);
  }
}

export class BusinessLogicError extends BaseError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 422, true, context);
  }
}

/**
 * Error serialization utilities
 */
export function serializeError(error: Error): SerializableError {
  const serialized: SerializableError = {
    name: error.name,
    message: error.message,
    stack: error.stack
  };

  if (error instanceof BaseError) {
    serialized.statusCode = error.statusCode;
    serialized.context = error.context;
  }

  // Handle additional properties
  if ('code' in error) {
    serialized.code = (error as any).code;
  }

  if ('statusCode' in error && typeof (error as any).statusCode === 'number') {
    serialized.statusCode = (error as any).statusCode;
  }

  // Handle nested errors
  if ('cause' in error && error.cause instanceof Error) {
    serialized.cause = serializeError(error.cause);
  }

  return serialized;
}

export function deserializeError(serialized: SerializableError): Error {
  const error = new Error(serialized.message);
  error.name = serialized.name;
  error.stack = serialized.stack;

  // Restore additional properties
  if (serialized.code !== undefined) {
    (error as any).code = serialized.code;
  }

  if (serialized.statusCode !== undefined) {
    (error as any).statusCode = serialized.statusCode;
  }

  if (serialized.context) {
    (error as any).context = serialized.context;
  }

  if (serialized.cause) {
    (error as any).cause = deserializeError(serialized.cause);
  }

  return error;
}

/**
 * Error classification utilities
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  
  // Consider known operational error types
  const operationalErrors = [
    'ValidationError',
    'AuthenticationError',
    'AuthorizationError',
    'NotFoundError',
    'ConflictError',
    'RateLimitError',
    'TimeoutError'
  ];
  
  return operationalErrors.includes(error.name);
}

export function isRetryableError(error: Error): boolean {
  const retryableCodes = [
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'NETWORK_ERROR',
    'TIMEOUT'
  ];
  
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  
  const hasRetryableCode = retryableCodes.some(code => 
    error.message?.includes(code) || (error as any).code === code
  );
  
  const hasRetryableStatus = retryableStatusCodes.includes((error as any).statusCode);
  
  return hasRetryableCode || hasRetryableStatus;
}

export function getErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
  if (error instanceof BaseError) {
    if (error.statusCode >= 500) {
      return error.isOperational ? 'high' : 'critical';
    } else if (error.statusCode >= 400) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  // Default classification based on error name
  const highSeverityErrors = ['TypeError', 'ReferenceError', 'SyntaxError'];
  if (highSeverityErrors.includes(error.name)) {
    return 'critical';
  }
  
  return 'medium';
}

/**
 * Error aggregation utilities
 */
export class ErrorAggregator {
  private errors: Error[] = [];

  add(error: Error): void {
    this.errors.push(error);
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): Error[] {
    return [...this.errors];
  }

  getErrorCount(): number {
    return this.errors.length;
  }

  clear(): void {
    this.errors = [];
  }

  throwIfHasErrors(message: string = 'Multiple errors occurred'): void {
    if (this.hasErrors()) {
      const aggregateError = new AggregateError(this.errors, message);
      throw aggregateError;
    }
  }

  getFirstError(): Error | null {
    return this.errors[0] || null;
  }

  getErrorsByType<T extends Error>(type: new (...args: any[]) => T): T[] {
    return this.errors.filter(error => error instanceof type) as T[];
  }
}

/**
 * Error wrapping utilities
 */
export function wrapError(error: Error, message: string, context?: ErrorContext): BaseError {
  const wrappedError = new BaseError(message, 500, true, context);
  (wrappedError as any).cause = error;
  return wrappedError;
}

export function wrapAsyncError<T>(
  promise: Promise<T>,
  message: string,
  context?: ErrorContext
): Promise<T> {
  return promise.catch(error => {
    throw wrapError(error instanceof Error ? error : new Error(String(error)), message, context);
  });
}

/**
 * Error handling decorators
 */
export function handleErrors(
  fallbackValue?: any,
  shouldRethrow: boolean = true
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        // Log error (you'd integrate with your logging system here)
        console.error(`Error in ${propertyKey}:`, error);
        
        if (shouldRethrow) {
          throw error;
        }
        
        return fallbackValue;
      }
    };

    return descriptor;
  };
}

/**
 * Error context utilities
 */
export function createErrorContext(
  operation: string,
  additionalContext: Partial<ErrorContext> = {}
): ErrorContext {
  return {
    operation,
    timestamp: new Date(),
    ...additionalContext
  };
}

export function enrichError(error: Error, context: ErrorContext): BaseError {
  if (error instanceof BaseError) {
    return new BaseError(
      error.message,
      error.statusCode,
      error.isOperational,
      { ...error.context, ...context }
    );
  }
  
  return new BaseError(error.message, 500, true, context);
}

/**
 * Error recovery utilities
 */
export class ErrorRecoveryManager {
  private recoveryStrategies = new Map<string, (error: Error) => Promise<any>>();

  registerStrategy(errorType: string, strategy: (error: Error) => Promise<any>): void {
    this.recoveryStrategies.set(errorType, strategy);
  }

  async attemptRecovery(error: Error): Promise<any> {
    const strategy = this.recoveryStrategies.get(error.name) || 
                    this.recoveryStrategies.get(error.constructor.name);
    
    if (strategy) {
      try {
        return await strategy(error);
      } catch (recoveryError) {
        // Recovery failed, throw original error
        throw error;
      }
    }
    
    // No recovery strategy available
    throw error;
  }

  hasRecoveryStrategy(error: Error): boolean {
    return this.recoveryStrategies.has(error.name) || 
           this.recoveryStrategies.has(error.constructor.name);
  }
}

/**
 * Error metrics utilities
 */
export interface ErrorMetrics {
  errorCount: number;
  errorRate: number; // errors per minute
  errorsByType: Map<string, number>;
  errorsBySeverity: Map<string, number>;
  lastError?: Date;
  averageErrorsPerHour: number;
}

export class ErrorMetricsCollector {
  private errors: { error: Error; timestamp: Date }[] = [];
  private readonly maxErrors = 1000;

  recordError(error: Error): void {
    this.errors.push({ error, timestamp: new Date() });
    
    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
  }

  getMetrics(timeWindowMs: number = 3600000): ErrorMetrics { // Default: 1 hour
    const now = Date.now();
    const cutoff = now - timeWindowMs;
    
    const recentErrors = this.errors.filter(e => e.timestamp.getTime() > cutoff);
    
    const errorsByType = new Map<string, number>();
    const errorsBySeverity = new Map<string, number>();
    
    recentErrors.forEach(({ error }) => {
      const type = error.name;
      const severity = getErrorSeverity(error);
      
      errorsByType.set(type, (errorsByType.get(type) || 0) + 1);
      errorsBySeverity.set(severity, (errorsBySeverity.get(severity) || 0) + 1);
    });
    
    const errorCount = recentErrors.length;
    const errorRate = (errorCount / (timeWindowMs / 60000)); // per minute
    const lastError = recentErrors.length > 0 ? 
      recentErrors[recentErrors.length - 1].timestamp : undefined;
    
    return {
      errorCount,
      errorRate,
      errorsByType,
      errorsBySeverity,
      lastError,
      averageErrorsPerHour: (errorCount / (timeWindowMs / 3600000))
    };
  }

  reset(): void {
    this.errors = [];
  }
}

/**
 * Global error handler utilities
 */
export function setupGlobalErrorHandlers(
  onError: (error: Error) => void,
  onUnhandledRejection: (reason: any, promise: Promise<any>) => void
): void {
  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    onError(error);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    onUnhandledRejection(reason, promise);
  });
}

/**
 * Utility functions
 */
export function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    return `[Unable to stringify: ${error.message}]`;
  }
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object') {
    return safeStringify(error);
  }
  
  return 'Unknown error';
}