import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { errorRecovery } from '../services/error-recovery';
import { performanceMonitor } from '../monitoring/performance';

const logger = createLogger({ module: 'error-recovery-middleware' });

export interface ErrorResponse {
  error: string;
  message: string;
  errorId?: string;
  statusCode: number;
  timestamp: string;
  path?: string;
  method?: string;
  recoverable?: boolean;
  retryAfter?: number;
}

// Custom error classes
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public recoverable: boolean = false,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(
    message: string,
    public errors?: Record<string, string[]>
  ) {
    super(400, message, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(401, message, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, message, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends ApiError {
  constructor(retryAfter: number = 60) {
    super(429, 'Too many requests', 'RATE_LIMIT_ERROR', true, retryAfter);
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Service temporarily unavailable', retryAfter: number = 300) {
    super(503, message, 'SERVICE_UNAVAILABLE', true, retryAfter);
  }
}

// Error handler middleware
export async function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Log error
  logger.error('Request error', err, {
    errorId,
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body,
    headers: req.headers,
    user: req.user?.id,
    organizationId: req.organizationId,
  });

  // Record error metrics
  performanceMonitor.incrementCounter('errors_total', {
    type: err.name,
    path: req.route?.path || req.path,
  });

  // Attempt recovery for certain errors
  if (isRecoverableError(err)) {
    const recovered = await errorRecovery.handleError(err, {
      service: 'api',
      operation: `${req.method} ${req.path}`,
      userId: req.user?.id,
      organizationId: req.organizationId,
      metadata: {
        errorId,
        headers: req.headers,
      },
    });

    if (recovered) {
      // Retry the request after recovery
      logger.info('Error recovered, retrying request', { errorId });
      return next();
    }
  }

  // Determine status code
  let statusCode = 500;
  let recoverable = false;
  let retryAfter: number | undefined;
  
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    recoverable = err.recoverable;
    retryAfter = err.retryAfter;
  } else if ((err as any).statusCode) {
    statusCode = (err as any).statusCode;
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred',
    errorId,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    recoverable,
    retryAfter,
  };

  // Add validation errors if present
  if (err instanceof ValidationError && err.errors) {
    (errorResponse as any).errors = err.errors;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    (errorResponse as any).stack = err.stack;
  }

  // Set retry header if applicable
  if (retryAfter) {
    res.setHeader('Retry-After', retryAfter);
  }

  // Send response
  res.status(statusCode).json(errorResponse);
}

// Async error wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Not found handler
export function notFoundHandler(req: Request, res: Response) {
  const error = new NotFoundError('Route');
  errorHandler(error, req, res, () => {});
}

// Timeout handler
export function timeoutHandler(timeout: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      const error = new ServiceUnavailableError('Request timeout');
      errorHandler(error, req, res, () => {});
    }, timeout);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
}

// Helper functions
function isRecoverableError(error: Error): boolean {
  const recoverablePatterns = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'Connection lost',
    'Redis connection',
  ];

  return recoverablePatterns.some(pattern => 
    error.message.includes(pattern) || error.name.includes(pattern)
  );
}

// Validation middleware factory
export function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    const validation = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      
      validation.error.errors.forEach((err: any) => {
        const path = err.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(err.message);
      });

      throw new ValidationError('Validation failed', errors);
    }

    next();
  };
}

// Circuit breaker middleware
export function circuitBreakerMiddleware(
  serviceName: string,
  options?: {
    failureThreshold?: number;
    recoveryTimeout?: number;
  }
) {
  const circuitBreaker = new (require('../utils/retry').CircuitBreaker)(
    options?.failureThreshold,
    options?.recoveryTimeout
  );

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await circuitBreaker.execute(async () => {
        next();
      });
    } catch (error) {
      if (error.message === 'Circuit breaker is open') {
        throw new ServiceUnavailableError(
          `${serviceName} is temporarily unavailable`,
          options?.recoveryTimeout ? options.recoveryTimeout / 1000 : 60
        );
      }
      throw error;
    }
  };
}